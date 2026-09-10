import type { PartId } from "../shared/image/contracts";
import { partDefinition } from "../shared/image/parts";
import type { SaveQueue, SessionIdentity } from "../shared/storage";
import {
  type CutoutClient,
  type LoadedCutout,
  type PartEdit,
  type GenerationTarget,
  type GeneratedCutout,
} from "./client";
import {
  applyStroke,
  BoundedHistory,
  pixelCount,
  validateRuns,
  type MaskTool,
  type Runs,
} from "./masks";
import {
  DEFAULT_SELECTION_PARAMETERS,
  SelectionParametersSchema,
  type SelectionParameters,
} from "./assistance";

export interface CutoutState {
  readonly loaded: LoadedCutout | null;
  readonly pixels: Uint8ClampedArray | null;
  readonly parts: readonly PartEdit[];
  readonly activePartId: PartId;
  readonly editSerial: number;
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly saving: boolean;
  readonly error: string | null;
  readonly notice: string;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly refineProgress: number | null;
  readonly refineAdvice: string;
  readonly generationTarget: GenerationTarget | null;
  readonly generated: GeneratedCutout | null;
}
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** One source owner per mounted vault session; only this owner queues durable mask writes. */
export class CutoutController {
  private state: CutoutState = {
    loaded: null,
    pixels: null,
    parts: [],
    activePartId: "head",
    editSerial: 0,
    dirty: false,
    busy: false,
    saving: false,
    error: null,
    notice: "",
    canUndo: false,
    canRedo: false,
    refineProgress: null,
    refineAdvice:
      "Die Auswahlhilfe arbeitet lokal. Sie erkennt keine anatomischen Teile ohne sichtbare Grenzen.",
    generationTarget: null,
    generated: null,
  };
  private readonly listeners = new Set<() => void>();
  private readonly histories = new Map<PartId, BoundedHistory<PartEdit>>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private pendingSave: Promise<void> | null = null;
  private openEpoch = 0;
  private selectionKey = "";
  private opening: Promise<void> | null = null;
  private disposed = false;
  private refinement: { id: string; started: boolean } | null = null;
  constructor(
    readonly session: SessionIdentity,
    readonly writable: boolean,
    private readonly client: CutoutClient,
    private readonly queue: SaveQueue,
  ) {}
  getSnapshot = (): CutoutState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private update(patch: Partial<CutoutState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    const history = this.histories.get(this.state.activePartId);
    this.state = {
      ...this.state,
      canUndo: history?.canUndo ?? false,
      canRedo: history?.canRedo ?? false,
    };
    this.listeners.forEach((listener) => listener());
  }
  attach(): () => void {
    return this.queue.registerBeforeFlush(async () => {
      await this.cancelAssistance();
      await this.flush();
    });
  }
  dispose(): void {
    void this.cancelAssistance();
    this.disposed = true;
    this.openEpoch++;
    clearTimeout(this.timer);
    this.listeners.clear();
    this.histories.clear();
    this.state = { ...this.state, pixels: null };
  }

  async open(relativePath: string, sha256: string, set = false): Promise<void> {
    const key = `${set ? "set" : "image"}:${relativePath}\n${sha256}`;
    if (this.disposed || key === this.selectionKey) return this.opening ?? undefined;
    await this.cancelAssistance();
    await this.flush();
    const epoch = ++this.openEpoch;
    this.selectionKey = key;
    this.update({ busy: true, error: null, notice: "Quellbild und Masken werden geprüft …" });
    this.opening = this.queue
      .enqueue(this.session, async (context) => {
        context.assertCurrent();
        const loaded = set
          ? await this.client.openSet(this.session, relativePath, sha256)
          : await this.client.open(this.session, relativePath, sha256, this.writable);
        context.assertCurrent();
        const pixels = await this.client.pixels(this.session, loaded);
        context.assertCurrent();
        if (this.disposed || epoch !== this.openEpoch) return;
        if (pixels.length !== loaded.project.source.width * loaded.project.source.height * 4)
          throw new Error("Die Bilddaten sind unvollständig.");
        this.histories.clear();
        this.update({
          loaded,
          pixels,
          activePartId: loaded.project.activePartId,
          parts: loaded.project.parts.map((part) => ({
            partId: part.partId,
            status: part.status,
            reason: part.reason ?? null,
            mask: loaded.masks[part.partId]!,
            selectionParameters: SelectionParametersSchema.parse(
              part.selectionParameters ?? DEFAULT_SELECTION_PARAMETERS,
            ),
          })),
          busy: false,
          dirty: false,
          editSerial: 0,
          generationTarget: null,
          generated: null,
          notice: this.writable
            ? "Masken werden automatisch gespeichert."
            : "Schreibgeschützt · Masken können betrachtet, aber nicht verändert werden.",
        });
      })
      .catch((error: unknown) => {
        if (epoch === this.openEpoch) {
          this.selectionKey = "";
          this.update({
            busy: false,
            error: message(error),
            notice: "Der zuletzt gültige Arbeitsstand bleibt erhalten.",
          });
        }
      })
      .finally(() => {
        if (epoch === this.openEpoch) this.opening = null;
      });
    return this.opening;
  }

  private changed(patch: Partial<CutoutState>): void {
    void this.cancelAssistance();
    this.update({
      ...patch,
      dirty: true,
      editSerial: this.state.editSerial + 1,
      error: null,
      generationTarget: null,
      notice: "Änderungen noch nicht gespeichert …",
    });
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.flush().catch(() => undefined);
    }, 500);
  }
  active(): PartEdit | undefined {
    return this.state.parts.find((part) => part.partId === this.state.activePartId);
  }
  private history(id: PartId): BoundedHistory<PartEdit> {
    let history = this.histories.get(id);
    if (!history) {
      history = new BoundedHistory<PartEdit>(1024 * 1024, 48);
      this.histories.set(id, history);
    }
    return history;
  }
  selectPart(id: PartId): void {
    if (!this.state.parts.some((part) => part.partId === id) || this.state.busy) return;
    if (this.writable) this.changed({ activePartId: id });
    else this.update({ activePartId: id });
  }
  private fitsBudget(part: PartEdit): boolean {
    const parts = this.state.parts.map((current) =>
      current.partId === part.partId ? part : current,
    );
    const counts = parts.map(
      ({ mask }) =>
        mask.draft.length +
        mask.confirmed.length +
        mask.roi.length +
        mask.positive.length +
        mask.negative.length +
        mask.protected.length,
    );
    if (counts.some((count) => count > 500_000) || counts.reduce((a, b) => a + b, 0) > 1_000_000) {
      this.update({
        error: "Das Maskenbudget ist erreicht. Bitte kleinere oder einfachere Auswahlen verwenden.",
      });
      return false;
    }
    return true;
  }
  private replace(part: PartEdit, recordHistory = true): void {
    const old = this.active();
    if (!this.writable || this.state.busy || !old || !this.fitsBudget(part)) return;
    const parts = this.state.parts.map((current) =>
      current.partId === part.partId ? part : current,
    );
    if (recordHistory) this.history(old.partId).push(old);
    this.changed({ parts });
  }
  stroke(tool: MaskTool, runs: Runs): void {
    const active = this.active();
    if (!active || runs.length === 0 || tool === "pan") return;
    const mask = applyStroke(active.mask, tool, runs);
    this.replace({ ...active, mask, status: "editing", reason: null });
  }
  confirm(): void {
    const active = this.active(),
      pixels = this.state.pixels;
    if (!active || !pixels) return;
    const visible = active.mask.draft.some(([start, length]) => {
      for (let i = start; i < start + length; i++) if (pixels[i * 4 + 3]! > 0) return true;
      return false;
    });
    if (!visible) {
      this.update({
        error: "Die Auswahl enthält keine sichtbaren Pixel. Bitte zuerst einen Bereich markieren.",
      });
      return;
    }
    this.replace({
      ...active,
      status: "confirmed",
      reason: null,
      mask: { ...active.mask, confirmed: active.mask.draft },
    });
  }
  markAbsent(reason: string): void {
    const active = this.active();
    if (!active) return;
    if (partDefinition(active.partId).required && !reason.trim()) {
      this.update({ error: "Bitte begründe, weshalb dieser Pflichtteil nicht vorhanden ist." });
      return;
    }
    this.replace({
      ...active,
      status: partDefinition(active.partId).required ? "not_present" : "disabled",
      reason: reason.trim().slice(0, 500) || null,
    });
  }
  clear(): void {
    const active = this.active();
    if (!active) return;
    this.replace({
      ...active,
      status: "editing",
      reason: null,
      mask: { ...active.mask, draft: [], roi: [], positive: [], negative: [], protected: [] },
    });
  }
  undo(): void {
    const current = this.active();
    if (!current || !this.writable || this.state.busy) return;
    const previous = this.history(current.partId).undo(current, (part) => this.fitsBudget(part));
    if (previous) this.replace(previous, false);
  }
  redo(): void {
    const current = this.active();
    if (!current || !this.writable || this.state.busy) return;
    const next = this.history(current.partId).redo(current, (part) => this.fitsBudget(part));
    if (next) this.replace(next, false);
  }
  selectedPixels(): number {
    return pixelCount(this.active()?.mask.draft ?? []);
  }

  chooseAccessory(id: "belt_accessory" | "sword"): void {
    if (!this.writable || this.state.busy) return;
    const current = this.state.parts.find((part) =>
      ["belt_accessory", "sword"].includes(part.partId),
    );
    if (!current || current.partId === id) return;
    // The single accessory mask is reclassified, never silently discarded.
    this.histories.delete(id);
    this.histories.delete(current.partId);
    this.changed({
      parts: this.state.parts.map((part) => (part === current ? { ...part, partId: id } : part)),
      activePartId: this.state.activePartId === current.partId ? id : this.state.activePartId,
    });
  }
  generationIssues(): readonly string[] {
    const issues = this.state.parts
      .filter((part) =>
        partDefinition(part.partId).required
          ? !["confirmed", "not_present"].includes(part.status)
          : part.status === "editing",
      )
      .map((part) => partDefinition(part.partId).label);
    if (!this.state.parts.some((part) => part.status === "confirmed"))
      issues.push("Mindestens ein bestätigter Teil");
    return issues;
  }
  async prepareGeneration(): Promise<void> {
    if (!this.writable || this.state.busy || !this.state.loaded) return;
    const issues = this.generationIssues();
    if (issues.length) {
      this.update({ error: `Noch offen: ${issues.join(", ")}` });
      return;
    }
    await this.cancelAssistance();
    this.update({ busy: true, error: null, generationTarget: null });
    try {
      await this.flush();
      const loaded = this.state.loaded!;
      await this.queue.enqueue(this.session, async (context) => {
        const target = await this.client.previewGeneration(
          this.session,
          loaded.projectPath,
          loaded.sha256,
        );
        context.assertCurrent();
        this.update({
          generationTarget: target,
          notice:
            "Ausgabeziel geprüft. Erzeugen veröffentlicht PNGs, Masken, Snapshot und Manifest zusammen.",
        });
      });
    } catch (error: unknown) {
      this.update({ error: message(error) });
    } finally {
      this.update({ busy: false });
    }
  }
  async generate(padding: number): Promise<void> {
    if (!this.writable || this.state.busy || !this.state.loaded || !this.state.generationTarget)
      return;
    if (!Number.isInteger(padding) || padding < 0 || padding > 64) {
      this.update({ error: "Padding muss zwischen 0 und 64 Quellpixeln liegen." });
      return;
    }
    await this.cancelAssistance();
    this.update({
      busy: true,
      error: null,
      notice: "Teile werden erzeugt und vollständig geprüft …",
    });
    try {
      await this.flush();
      const loaded = this.state.loaded!,
        target = this.state.generationTarget!;
      await this.queue.enqueue(this.session, async (context) => {
        const generated = await this.client.generate(this.session, {
          projectPath: loaded.projectPath,
          expectedRevision: loaded.project.revision,
          expectedSha256: loaded.sha256,
          directory: target.directory,
          padding,
        });
        context.assertCurrent();
        if (
          generated.loaded.project.id !== loaded.project.id ||
          generated.loaded.project.source.sha256 !== loaded.project.source.sha256 ||
          generated.directory !== target.directory
        )
          throw new Error("Ausgabe gehört nicht zum geöffneten Schnittprojekt.");
        this.update({
          loaded: generated.loaded,
          generated,
          generationTarget: null,
          dirty: false,
          notice: `${generated.partCount} PNG-Teile erfolgreich geprüft · ${generated.complete ? "vollständig" : "bewusst unvollständig"} · ${generated.directory}. Im Data Folder aktualisieren und diesen Ordner im PixelSpriteStudio auswählen.`,
        });
      });
    } catch (error: unknown) {
      this.update({
        error: message(error),
        generationTarget: null,
        notice:
          "Kein bestätigter Ausgabeerfolg. Arbeitsstand bleibt erhalten; Konflikt prüfen, nach einem Abbruch den Vault erneut öffnen.",
      });
    } finally {
      this.update({ busy: false });
    }
  }

  setSelectionParameters(parameters: SelectionParameters): void {
    const active = this.active();
    if (active)
      this.replace({ ...active, selectionParameters: SelectionParametersSchema.parse(parameters) });
  }
  cancelAssistance = async (): Promise<void> => {
    const job = this.refinement;
    if (!job) return;
    this.refinement = null;
    this.update({
      refineProgress: null,
      refineAdvice: "Auswahlhilfe abgebrochen; die bisherige Maske bleibt erhalten.",
    });
    if (job.started) await this.client.cancelRefine(this.session, job.id).catch(() => undefined);
  };
  async assist(): Promise<void> {
    if (
      !this.writable ||
      this.state.busy ||
      this.refinement ||
      !this.active() ||
      !this.state.loaded
    )
      return;
    const job = { id: `refine-${crypto.randomUUID()}`, started: false };
    this.refinement = job;
    this.update({
      refineProgress: 0,
      error: null,
      refineAdvice: "Lokale Auswahl wird vorbereitet …",
    });
    try {
      await this.flush();
      if (this.refinement !== job || this.disposed) return;
      const snapshot = this.state,
        active = this.active()!,
        loaded = snapshot.loaded!;
      const id = await this.client.startRefine(this.session, {
        jobId: job.id,
        projectPath: loaded.projectPath,
        sourceHash: loaded.project.source.sha256,
        partId: active.partId,
        maskRevision: snapshot.editSerial,
        mask: active.mask,
        parameters: active.selectionParameters,
      });
      job.started = true;
      if (id !== job.id) throw new Error("Ungültige Kennung des Auswahlauftrags.");
      if (this.refinement !== job || this.disposed) {
        await this.client.cancelRefine(this.session, job.id).catch(() => undefined);
        return;
      }
      while (this.refinement === job && !this.disposed) {
        const status = await this.client.refineProgress(this.session, job.id);
        if (this.refinement !== job || this.disposed) return;
        if (
          status.jobId !== job.id ||
          status.sourceHash !== loaded.project.source.sha256 ||
          status.partId !== active.partId ||
          status.maskRevision !== snapshot.editSerial ||
          this.state.editSerial !== snapshot.editSerial ||
          this.state.activePartId !== active.partId ||
          this.state.loaded?.project.source.sha256 !== status.sourceHash
        ) {
          await this.cancelAssistance();
          this.update({
            refineAdvice:
              "Veraltetes Auswahlergebnis verworfen; aktuelle Bearbeitung bleibt erhalten.",
          });
          return;
        }
        this.update({ refineProgress: status.progress });
        if (status.status === "failed")
          throw new Error(status.error ?? "Lokale Auswahl fehlgeschlagen.");
        if (status.status === "cancelled") {
          await this.cancelAssistance();
          return;
        }
        if (status.status === "completed") {
          const result = status.result;
          if (!result) throw new Error("Das Auswahlergebnis ist unvollständig.");
          if (result.draft) {
            if (
              !validateRuns(
                result.draft,
                loaded.project.source.width * loaded.project.source.height,
              )
            )
              throw new Error("Das Auswahlergebnis liegt außerhalb der Quelle.");
          }
          this.refinement = null;
          if (result.draft) {
            this.replace({
              ...active,
              status: "editing",
              reason: null,
              mask: { ...active.mask, draft: result.draft },
            });
          }
          this.update({
            refineProgress: null,
            refineAdvice: `${result.uncertain ? "Manuelle Prüfung nötig. " : ""}${result.advice} (${result.elapsedMs} ms)`,
          });
          return;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      }
    } catch (error: unknown) {
      if (this.refinement === job) {
        this.refinement = null;
        if (job.started) void this.client.cancelRefine(this.session, job.id).catch(() => undefined);
        this.update({
          refineProgress: null,
          error: message(error),
          refineAdvice: "Auswahlhilfe fehlgeschlagen; die bisherige Maske bleibt erhalten.",
        });
      }
    }
  }

  async continueFromSnapshot(): Promise<void> {
    if (!this.writable || this.state.busy || !this.state.loaded?.project.source.originalPath)
      return;
    await this.cancelAssistance();
    clearTimeout(this.timer);
    if (this.pendingSave) await this.pendingSave.catch(() => undefined);
    this.update({ busy: true, dirty: true, generationTarget: null });
    try {
      await this.flush(true);
      this.update({
        notice:
          "Gespeicherter Snapshot aktiv · Originalverknüpfung ausdrücklich gelöst. Masken bleiben erhalten.",
      });
    } catch {
      // flush already retains the edits and presents the concrete failure.
    } finally {
      this.update({ busy: false });
    }
  }

  flush = async (detachOriginal = false): Promise<void> => {
    clearTimeout(this.timer);
    if (this.pendingSave) await this.pendingSave;
    while (!this.disposed && this.writable && this.state.dirty && this.state.loaded) {
      const snapshot = this.state,
        loaded = snapshot.loaded!;
      this.update({ saving: true });
      this.pendingSave = this.queue
        .enqueue(this.session, async (context) => {
          const saved = await this.client.save(this.session, {
            projectPath: loaded.projectPath,
            expectedRevision: loaded.project.revision,
            expectedSha256: loaded.sha256,
            activePartId: snapshot.activePartId,
            ...(detachOriginal ? { detachOriginal: true } : {}),
            parts: snapshot.parts,
          });
          context.assertCurrent();
          if (this.disposed) return;
          const dirty = snapshot.editSerial !== this.state.editSerial;
          this.update({
            loaded: saved,
            dirty,
            saving: false,
            error: null,
            notice: dirty
              ? "Weitere Änderungen warten auf Speicherung …"
              : `Gespeichert · Revision ${saved.project.revision}`,
          });
        })
        .catch((error: unknown) => {
          this.update({
            saving: false,
            error: message(error),
            notice:
              "Nicht gespeichert · Arbeitsstand bleibt erhalten. Erneut speichern oder den Konflikt beheben.",
          });
          throw error;
        });
      try {
        await this.pendingSave;
      } finally {
        this.pendingSave = null;
      }
    }
  };
}
