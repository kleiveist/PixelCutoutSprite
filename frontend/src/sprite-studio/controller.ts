import type { PartId, SpriteSceneEnvelope } from "../shared/image/contracts";
import type { SaveQueue, SaveTaskContext, SessionIdentity } from "../shared/storage";
import {
  LoadedSpriteSchema,
  type LoadedSprite,
  type SpriteClient,
  type SpritePixels,
  type SpriteSourceKind,
  type SaveSpriteRequest,
} from "./client";
import { backToFront, type SpriteLayer } from "./geometry";
import { checkedScene, originalLayers, reconcileMemory } from "./editing";

interface PendingSprite {
  readonly loaded: LoadedSprite;
  readonly pixels: SpritePixels;
}
export interface SpriteState {
  readonly loaded: LoadedSprite | null;
  readonly pixels: SpritePixels;
  readonly scene: SpriteSceneEnvelope | null;
  readonly selected: PartId | null;
  readonly busy: boolean;
  readonly saving: boolean;
  readonly dirty: boolean;
  readonly error: string | null;
  readonly notice: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly pending: PendingSprite | null;
  readonly inputError: string | null;
  readonly formVersion: number;
}
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
export class SpriteController {
  private state: SpriteState = {
    loaded: null,
    pixels: new Map(),
    scene: null,
    selected: null,
    busy: false,
    saving: false,
    dirty: false,
    error: null,
    notice: "",
    canUndo: false,
    canRedo: false,
    pending: null,
    inputError: null,
    formVersion: 0,
  };
  private inputErrors = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private epoch = 0;
  private serial = 0;
  private disposed = false;
  private key = "";
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingSave: Promise<void> | null = null;
  private history: SpriteSceneEnvelope[] = [];
  private future: SpriteSceneEnvelope[] = [];
  private moving: { scene: SpriteSceneEnvelope; id: PartId } | null = null;
  constructor(
    readonly session: SessionIdentity,
    readonly writable: boolean,
    private readonly client: SpriteClient,
    private readonly queue: SaveQueue,
  ) {}
  getSnapshot = (): SpriteState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<SpriteState>): void {
    if (this.disposed) return;
    this.state = {
      ...this.state,
      ...patch,
      canUndo: this.history.length > 0,
      canRedo: this.future.length > 0,
    };
    this.listeners.forEach((listener) => listener());
  }
  attach(): () => void {
    return this.queue.registerBeforeFlush(async () => {
      this.cancelMove();
      await this.flush();
    });
  }
  dispose(): void {
    this.disposed = true;
    this.epoch++;
    clearTimeout(this.timer);
    this.listeners.clear();
    this.history = [];
    this.future = [];
    this.moving = null;
    this.state = { ...this.state, pixels: new Map(), pending: null };
  }
  select(id: PartId): void {
    if (!this.state.inputError && this.state.scene?.layers.some((layer) => layer.partId === id))
      this.update({ selected: id });
  }
  setInputError(field: string, error: string | null): void {
    if (error) this.inputErrors.set(field, error);
    else this.inputErrors.delete(field);
    this.update({ inputError: this.inputErrors.values().next().value ?? null });
    clearTimeout(this.timer);
    if (!this.state.inputError && this.state.dirty)
      this.timer = setTimeout(() => {
        void this.flush().catch(() => undefined);
      }, 500);
  }
  get editable(): boolean {
    return (
      this.writable &&
      !this.state.busy &&
      !this.state.pending &&
      !!this.state.scene &&
      !this.disposed
    );
  }
  private remember(scene: SpriteSceneEnvelope): void {
    this.history.push(scene);
    // Only small immutable scene snapshots, never PNG/RGBA buffers.
    while (this.history.length > 48 || JSON.stringify(this.history).length * 2 > 1024 * 1024)
      this.history.shift();
    this.future = [];
  }
  private changed(scene: SpriteSceneEnvelope): void {
    this.serial++;
    this.update({
      scene,
      dirty: true,
      error: null,
      notice: "Szenenänderungen noch nicht gespeichert …",
    });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 500);
  }
  private edit(scene: SpriteSceneEnvelope): void {
    if (!this.editable || this.moving || !this.state.scene) return;
    try {
      const next = checkedScene(scene);
      if (JSON.stringify(next) === JSON.stringify(this.state.scene)) return;
      this.remember(this.state.scene);
      this.changed(next);
    } catch (error) {
      this.update({ error: message(error) });
    }
  }
  updateLayer(id: PartId, patch: Partial<Omit<SpriteLayer, "partId">>): void {
    const scene = this.state.scene,
      layer = scene?.layers.find((layer) => layer.partId === id);
    if (
      !scene ||
      !layer ||
      (layer.locked && Object.keys(patch).some((key) => key !== "locked" && key !== "visible"))
    )
      return;
    const next = { ...layer, ...patch };
    if (patch.position && scene.pixelSnap)
      next.position = { x: Math.round(next.position.x), y: Math.round(next.position.y) };
    this.edit({
      ...scene,
      layers: scene.layers.map((layer) => (layer.partId === id ? next : layer)),
    });
  }
  setPixelSnap(pixelSnap: boolean): void {
    if (this.state.scene) this.edit({ ...this.state.scene, pixelSnap });
  }
  reorder(id: PartId, target: PartId): void {
    const scene = this.state.scene;
    if (!scene || id === target || scene.layers.find((layer) => layer.partId === id)?.locked)
      return;
    const layers = backToFront(scene.layers).reverse(),
      from = layers.findIndex((layer) => layer.partId === id),
      to = layers.findIndex((layer) => layer.partId === target);
    if (from < 0 || to < 0) return;
    const [layer] = layers.splice(from, 1);
    layers.splice(to, 0, layer!);
    this.edit({
      ...scene,
      layers: layers.map((layer, index) => ({ ...layer, zIndex: (layers.length - index) * 10 })),
    });
  }
  moveOrder(id: PartId, direction: "front" | "back"): void {
    const layers = backToFront(this.state.scene?.layers ?? []).reverse(),
      index = layers.findIndex((layer) => layer.partId === id),
      target = layers[index + (direction === "front" ? -1 : 1)];
    if (target) this.reorder(id, target.partId);
  }
  restoreOriginal(): void {
    if (!this.state.inputError && this.state.scene && this.state.loaded)
      this.edit({
        ...this.state.scene,
        pixelSnap: true,
        layers: originalLayers(this.state.loaded),
      });
  }
  undo(): void {
    if (
      !this.editable ||
      this.moving ||
      this.state.inputError ||
      !this.state.scene ||
      !this.history.length
    )
      return;
    this.future.push(this.state.scene);
    const previous = this.history.pop()!;
    this.changed({ ...this.state.scene, pixelSnap: previous.pixelSnap, layers: previous.layers });
  }
  redo(): void {
    if (
      !this.editable ||
      this.moving ||
      this.state.inputError ||
      !this.state.scene ||
      !this.future.length
    )
      return;
    const next = this.future.pop()!;
    this.history.push(this.state.scene);
    this.changed({ ...this.state.scene, pixelSnap: next.pixelSnap, layers: next.layers });
  }
  beginMove(id: PartId): boolean {
    const scene = this.state.scene;
    if (
      !this.editable ||
      this.state.inputError ||
      !scene ||
      !scene.layers.some((layer) => layer.partId === id && !layer.locked)
    )
      return false;
    this.cancelMove();
    clearTimeout(this.timer);
    this.moving = { scene, id };
    this.update({
      selected: id,
      notice: "Verschiebe-Vorschau · Loslassen übernimmt, Escape verwirft.",
    });
    return true;
  }
  previewMove(delta: { x: number; y: number }): void {
    const move = this.moving;
    if (!move || !this.editable) return;
    const scene = {
      ...move.scene,
      layers: move.scene.layers.map((layer) => {
        if (layer.partId !== move.id) return layer;
        const x = layer.position.x + delta.x,
          y = layer.position.y + delta.y;
        return {
          ...layer,
          position: {
            x: move.scene.pixelSnap ? Math.round(x) : x,
            y: move.scene.pixelSnap ? Math.round(y) : y,
          },
        };
      }),
    };
    try {
      this.update({ scene: checkedScene(scene) });
    } catch {
      this.cancelMove();
    }
  }
  finishMove(): void {
    const move = this.moving,
      scene = this.state.scene;
    this.moving = null;
    if (!move || !scene) return;
    if (JSON.stringify(scene.layers) !== JSON.stringify(move.scene.layers)) {
      this.remember(move.scene);
      this.changed(scene);
    } else {
      this.update({
        notice: this.state.dirty ? "Ungespeicherte Änderungen." : "Keine Änderung an der Szene.",
      });
      if (this.state.dirty) void this.flush().catch(() => undefined);
    }
  }
  cancelMove(): void {
    const move = this.moving;
    this.moving = null;
    if (move) this.update({ scene: move.scene, notice: "Verschiebe-Vorschau verworfen." });
  }
  private request(
    loaded: LoadedSprite,
    scene: SpriteSceneEnvelope,
    acceptGeneration: boolean,
  ): SaveSpriteRequest {
    return {
      directory: loaded.directory,
      sourceKind: loaded.sourceKind,
      expectedDocumentSha256: loaded.documentSha256,
      expectedSceneSha256: loaded.sceneSha256,
      expectedBasisSha256: loaded.basisSha256,
      expectedRevision: loaded.sceneSha256 ? loaded.scene.revision : null,
      acceptGeneration,
      scene: { ...scene, revision: loaded.scene.revision },
    };
  }
  async flush(): Promise<void> {
    clearTimeout(this.timer);
    if (this.disposed) return;
    if (this.state.inputError) throw new Error(this.state.inputError);
    if (this.pendingSave) {
      await this.pendingSave;
      if (this.state.dirty) await this.flush();
      return;
    }
    const { loaded, scene } = this.state;
    if (!this.state.dirty || !loaded || !scene) return;
    if (!this.writable) throw new Error("Die Szene ist schreibgeschützt.");
    if (this.state.pending)
      throw new Error("Bitte zuerst den offenen Generationsabgleich bestätigen oder abbrechen.");
    if (this.moving) this.cancelMove();
    const serial = this.serial,
      snapshot = this.state.scene!;
    this.update({ saving: true, error: null, notice: "Szene wird im Vault gespeichert …" });
    this.pendingSave = this.queue
      .enqueue(this.session, async (context) => {
        context.assertCurrent();
        const saved = LoadedSpriteSchema.parse(
          await this.client.save(this.session, this.request(loaded, snapshot, false)),
        );
        context.assertCurrent();
        if (this.disposed) return;
        this.validateReceipt(loaded, saved, snapshot);
        this.update({
          // A scene-only save cannot change textures. Retain these references
          // so autosave does not allocate another set of large RGBA canvases.
          loaded: { ...saved, assets: loaded.assets, manifest: loaded.manifest },
          scene:
            serial === this.serial && !this.moving
              ? saved.scene
              : {
                  ...this.state.scene!,
                  revision: saved.scene.revision,
                  createdAt: saved.scene.createdAt,
                  updatedAt: saved.scene.updatedAt,
                },
          dirty: serial !== this.serial,
          notice:
            serial === this.serial
              ? "Szene gespeichert · PNGs und Manifest unverändert."
              : "Weitere Änderungen warten auf Speicherung.",
        });
      })
      .catch((error: unknown) => {
        if (!this.disposed)
          this.update({
            error: message(error),
            dirty: true,
            notice:
              "Nicht gespeichert. Lokale Änderungen bleiben erhalten; nichts wird als erfolgreich gemeldet.",
          });
        throw error;
      })
      .finally(() => {
        this.pendingSave = null;
        this.update({ saving: false });
      });
    await this.pendingSave;
    if (this.state.dirty) await this.flush();
  }
  private validateReceipt(
    before: LoadedSprite,
    saved: LoadedSprite,
    scene: SpriteSceneEnvelope,
  ): void {
    if (
      saved.directory !== before.directory ||
      saved.sourceKind !== before.sourceKind ||
      saved.documentSha256 !== before.documentSha256 ||
      JSON.stringify(saved.assets) !== JSON.stringify(before.assets) ||
      JSON.stringify(saved.manifest) !== JSON.stringify(before.manifest) ||
      !saved.sceneSha256 ||
      !saved.basisSha256 ||
      saved.reconciliation ||
      saved.scene.revision !== (before.sceneSha256 ? before.scene.revision + 1 : 1) ||
      saved.scene.id !== scene.id ||
      saved.scene.pixelSnap !== scene.pixelSnap ||
      JSON.stringify(saved.scene.layers) !== JSON.stringify(scene.layers)
    )
      throw new Error("Die Speicherbestätigung passt nicht zur angeforderten Szene.");
  }
  private async fetch(
    directory: string,
    kind: SpriteSourceKind,
    hash: string,
    context: SaveTaskContext,
    epoch: number,
  ): Promise<PendingSprite | null> {
    const loaded = LoadedSpriteSchema.parse(
      await this.client.open(this.session, directory, kind, hash),
    );
    if (
      loaded.directory !== directory ||
      loaded.sourceKind !== kind ||
      loaded.documentSha256 !== hash
    )
      throw new Error("Die Sprite-Antwort gehört zu einer anderen Auswahl.");
    const pixels = new Map<string, Uint8ClampedArray>();
    for (let i = 0; i < loaded.assets.length; i += 2) {
      context.assertCurrent();
      if (this.disposed || epoch !== this.epoch) return null;
      const chunk = await Promise.all(
        loaded.assets.slice(i, i + 2).map(async (asset) => {
          const rgba = await this.client.pixels(this.session, loaded, asset.partId);
          if (rgba.length !== asset.width * asset.height * 4)
            throw new Error("Teile-Pixeldaten sind unvollständig.");
          return [asset.partId, rgba] as const;
        }),
      );
      chunk.forEach(([id, rgba]) => pixels.set(id, rgba));
    }
    const final = LoadedSpriteSchema.parse(
      await this.client.open(this.session, directory, kind, hash),
    );
    context.assertCurrent();
    if (this.disposed || epoch !== this.epoch) return null;
    if (
      final.directory !== directory ||
      final.sourceKind !== kind ||
      final.documentSha256 !== hash ||
      final.sceneSha256 !== loaded.sceneSha256 ||
      final.basisSha256 !== loaded.basisSha256
    )
      throw new Error("Das Set oder die Szene wurde während des Ladens geändert.");
    return { loaded, pixels };
  }
  private activate({ loaded, pixels }: PendingSprite): void {
    this.history = [];
    this.future = [];
    this.serial = 0;
    this.key = `${loaded.directory}:${loaded.sourceKind}:${loaded.documentSha256}`;
    this.update({
      loaded,
      pixels,
      scene: loaded.scene,
      selected: loaded.scene.layers.some((layer) => layer.partId === this.state.selected)
        ? this.state.selected
        : (backToFront(loaded.scene.layers).at(-1)?.partId ?? null),
      pending: null,
      busy: false,
      dirty: false,
      error: null,
      formVersion: this.state.formVersion + 1,
      notice: loaded.sceneSha256
        ? "Gespeicherte Szene geladen · PNGs bleiben unverändert."
        : loaded.manualAlignment
          ? "Manuelles Ausrichten erforderlich · keine ursprünglichen Offsets vorhanden."
          : "Originalanordnung aus dem Manifest geladen · Originalposition = Ausschnittursprung + Pivot.",
    });
  }
  async open(
    directory: string,
    kind: SpriteSourceKind,
    hash: string,
    force = false,
  ): Promise<void> {
    const key = `${directory}:${kind}:${hash}`;
    if (this.disposed || (key === this.key && !force)) return;
    const epoch = ++this.epoch;
    this.key = key;
    try {
      await this.flush();
      if (this.disposed || epoch !== this.epoch) return;
      this.update({
        busy: true,
        error: null,
        notice: "Teile, Hashes und vorhandene Szene werden geprüft …",
      });
      await this.queue.enqueue(this.session, async (context) => {
        const next = await this.fetch(directory, kind, hash, context, epoch);
        if (!next) return;
        if (next.loaded.reconciliation)
          this.update({
            pending: next,
            busy: false,
            notice: "Neue Generation gefunden; noch nicht übernommen oder gespeichert.",
          });
        else this.activate(next);
      });
    } catch (error) {
      if (epoch === this.epoch) {
        this.key = "";
        this.update({
          busy: false,
          error: message(error),
          notice: "Die zuletzt gültige Szene bleibt erhalten.",
        });
      }
    }
  }
  async refresh(discardLocal = false): Promise<void> {
    const previous = this.state.loaded ?? this.state.pending?.loaded;
    if (!previous || this.disposed || this.state.busy) return;
    if (this.state.inputError && !discardLocal) {
      this.update({ error: this.state.inputError });
      return;
    }
    if (discardLocal) {
      this.inputErrors.clear();
      this.update({ inputError: null });
    }
    this.cancelMove();
    clearTimeout(this.timer);
    if (this.pendingSave) await this.pendingSave.catch(() => undefined);
    const epoch = ++this.epoch;
    this.update({ busy: true, error: null });
    try {
      await this.queue.enqueue(this.session, async (context) => {
        const current = LoadedSpriteSchema.parse(
          await this.client.current(this.session, previous.directory, previous.sourceKind),
        );
        if (current.directory !== previous.directory || current.sourceKind !== previous.sourceKind)
          throw new Error("Die Prüfung gehört zu einem anderen Ordner.");
        const next = await this.fetch(
          current.directory,
          current.sourceKind,
          current.documentSha256,
          context,
          epoch,
        );
        if (!next) return;
        if (!discardLocal && this.state.dirty && next.loaded.sceneSha256 !== previous.sceneSha256)
          throw new Error(
            "Die Szene wurde extern geändert. Lokale Änderungen bleiben erhalten; vor dem Neuladen ausdrücklich verwerfen oder externe Datei wiederherstellen.",
          );
        const oldScene = this.state.scene;
        if (
          !discardLocal &&
          oldScene &&
          (current.documentSha256 !== previous.documentSha256 ||
            current.scene.generationId !== oldScene.generationId)
        ) {
          const merged = reconcileMemory(previous, oldScene, next.loaded);
          this.update({
            pending: {
              ...next,
              loaded: { ...next.loaded, scene: merged.scene, reconciliation: merged.change },
            },
            busy: false,
            notice:
              "Abgleich vorbereitet: auch ungespeicherte Transformationen bleiben bis zur Bestätigung erhalten.",
          });
        } else if (next.loaded.reconciliation) this.update({ pending: next, busy: false });
        else if (!discardLocal && this.state.dirty) {
          this.update({
            busy: false,
            notice: "Dateien unverändert; lokale Bearbeitung bleibt erhalten.",
          });
        } else this.activate(next);
      });
    } catch (error) {
      if (epoch === this.epoch)
        this.update({
          busy: false,
          error: message(error),
          notice: "Prüfung fehlgeschlagen; die bisherige Szene bleibt erhalten.",
        });
    }
  }
  cancelReconciliation(): void {
    this.key = "";
    this.update({ pending: null, notice: "Abgleich abgebrochen. Keine Datei geändert." });
  }
  async acceptReconciliation(): Promise<void> {
    const pending = this.state.pending;
    if (!pending || !this.writable || this.disposed || this.state.busy) return;
    const epoch = ++this.epoch;
    clearTimeout(this.timer);
    this.update({ busy: true, error: null });
    try {
      await this.queue.enqueue(this.session, async (context) => {
        const saved = LoadedSpriteSchema.parse(
          await this.client.save(
            this.session,
            this.request(pending.loaded, pending.loaded.scene, true),
          ),
        );
        context.assertCurrent();
        if (epoch !== this.epoch || this.disposed) return;
        this.validateReceipt(pending.loaded, saved, pending.loaded.scene);
        this.activate({ loaded: saved, pixels: pending.pixels });
        this.update({
          notice: "Generationsabgleich gespeichert. History beginnt für diese Teilegeneration neu.",
        });
      });
    } catch (error) {
      if (epoch === this.epoch)
        this.update({
          busy: false,
          error: message(error),
          notice: "Abgleich nicht gespeichert; vorheriger Arbeitsstand bleibt erhalten.",
        });
    }
  }
}
