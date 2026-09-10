import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps } from "react";
import { useActiveVault } from "../shared/vault";
import { DataFolderWorkspace, useDataFolder } from "../shared/data-folder";
import { partDefinition } from "../shared/image/parts";
import { useRasterTextures } from "../shared/canvas/useRasterTextures";
import { Modal, ModalHost } from "../shared/dialogs";
import { SpriteStudioWelcome } from "./SpriteStudioWelcome";
import { SpriteController } from "./controller";
import { nativeSpriteClient, type SpriteClient, type SpriteAsset } from "./client";
import { SpriteCanvas } from "./SpriteCanvas";
import { SpriteLayers } from "./SpriteLayers";
import { SpriteTransforms } from "./SpriteTransforms";
import styles from "./SpriteStudio.module.css";

export function SpriteStudio({
  spriteClient = nativeSpriteClient,
  ...welcome
}: ComponentProps<typeof SpriteStudioWelcome> & { readonly spriteClient?: SpriteClient }) {
  const { session, activeVault, saveQueue } = useActiveVault(),
    selection = useDataFolder().selections.sprite;
  const sessionId = session?.sessionId,
    generation = session?.generation,
    writable = activeVault?.mode === "read_write";
  const controller = useMemo(
    () =>
      sessionId && generation !== undefined
        ? new SpriteController({ sessionId, generation }, writable, spriteClient, saveQueue)
        : null,
    [sessionId, generation, writable, spriteClient, saveQueue],
  );
  const owner = useMemo(() => ({ controller, leases: 0 }), [controller]);
  useEffect(() => {
    owner.leases++;
    const detach = owner.controller?.attach();
    return () => {
      detach?.();
      owner.leases--;
      queueMicrotask(() => {
        if (!owner.leases) owner.controller?.dispose();
      });
    };
  }, [owner]);
  const path =
    selection?.kind === "sprite_set" || selection?.kind === "legacy_set"
      ? selection.relativePath
      : null;
  const hash =
    selection?.kind === "sprite_set"
      ? selection.manifestSha256
      : selection?.kind === "legacy_set"
        ? selection.documentSha256
        : null;
  const kind = selection?.kind === "legacy_set" ? "legacy" : "manifest";
  useEffect(() => {
    if (controller && path && hash) void controller.open(path, kind, hash);
  }, [controller, path, kind, hash, selection]);
  return controller ? (
    <SpriteEditor controller={controller} welcome={<SpriteStudioWelcome {...welcome} />} />
  ) : (
    <DataFolderWorkspace
      module="sprite"
      viewSlot={{
        content: (
          <section aria-label="Sprite-View">
            <h2>View</h2>
            <p>Öffne einen Vault und wähle im Dateien-Register einen Teileordner.</p>
          </section>
        ),
      }}
    >
      <SpriteStudioWelcome {...welcome} />
    </DataFolderWorkspace>
  );
}
const NO_ASSETS: readonly SpriteAsset[] = [];
function SpriteEditor({
  controller,
  welcome,
}: {
  readonly controller: SpriteController;
  readonly welcome: React.ReactNode;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [confirmation, setConfirmation] = useState<"reset" | "discard" | null>(null);
  const textures = useRasterTextures(state.loaded?.assets ?? NO_ASSETS, state.pixels);
  const { loaded, scene } = state;
  return (
    <DataFolderWorkspace
      module="sprite"
      viewSlot={{
        content: <SpriteLayers controller={controller} state={state} textures={textures} />,
      }}
    >
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.inputError ? (
        <p role="alert" className={styles.error}>
          {state.inputError} Schließen und Auswahlwechsel sind bis zur Korrektur gesperrt.
        </p>
      ) : null}
      {state.pending ? (
        <section className={styles.editor} aria-label="Teilegeneration abgleichen">
          <h2>Neue Teilegeneration prüfen</h2>
          <p>
            {state.pending.loaded.directory} ·{" "}
            {state.pending.loaded.reconciliation?.previousGenerationId} →{" "}
            {state.pending.loaded.scene.generationId}
          </p>
          <p>
            Noch nicht übernommen. Vorhandene Positionen, Rotation, Skalierung, Sichtbarkeit und
            Sperren bleiben nach stabilen Part-IDs erhalten. Neue Teile erhalten Manifest-Defaults;
            fehlende Teile werden entfernt.
          </p>
          <ul>
            <li>
              Neu:{" "}
              {state.pending.loaded.reconciliation?.addedParts
                .map((id) => partDefinition(id).label)
                .join(", ") || "keine"}
            </li>
            <li>
              Entfernt:{" "}
              {state.pending.loaded.reconciliation?.removedParts
                .map((id) => partDefinition(id).label)
                .join(", ") || "keine"}
            </li>
            <li>
              Geometrie prüfen:{" "}
              {state.pending.loaded.reconciliation?.geometryChangedParts
                .map((id) => {
                  const part = state.pending!.loaded.manifest?.parts.find(
                    (part) => part.partId === id,
                  );
                  return `${partDefinition(id).label}${part ? ` · neuer Ausschnitt (${part.sourceRect.x}, ${part.sourceRect.y}), ${part.sourceRect.width} × ${part.sourceRect.height} px` : ""}`;
                })
                .join("; ") || "unverändert"}
            </li>
          </ul>
          {state.pending.loaded.reconciliation?.sourceChanged ? (
            <p className={styles.warning}>
              Die Quelle hat sich geändert. Numerische Transformationen bleiben erhalten, eine
              passende Anatomie/Geometrie ist nicht garantiert. Nach Übernahme ausdrücklich
              kontrollieren.
            </p>
          ) : null}
          {state.pending.loaded.reconciliation?.geometryUnknown ? (
            <p className={styles.warning}>
              Kein passender alter Geometriebeleg vorhanden. Bisherige Zahlenwerte bleiben erhalten;
              Ausschnitte müssen manuell geprüft werden.
            </p>
          ) : (
            <p>
              Bei identischer Quelle wird ein verschobener Ausschnittursprung durch den lokalen
              Pivot ausgeglichen.
            </p>
          )}
          <p>
            Bestätigen speichert die neue Szene und beginnt eine neue Undo-History. PNGs und
            Manifest werden nicht geändert.
          </p>
          <div className={styles.controls}>
            <button
              type="button"
              disabled={!controller.writable || state.busy}
              onClick={() => {
                void controller.acceptReconciliation();
              }}
            >
              Abgleich bestätigen und speichern
            </button>
            <button
              type="button"
              disabled={state.busy}
              onClick={() => controller.cancelReconciliation()}
            >
              Abgleich abbrechen
            </button>
          </div>
        </section>
      ) : null}
      {loaded && scene ? (
        <section
          className={styles.editor}
          aria-label="Sprite-Kompositionseditor"
          aria-busy={state.busy}
        >
          <h1>
            {loaded.directory} ·{" "}
            {loaded.manualAlignment ? "manuell ausrichten" : "Sprite-Zusammenstellung"}
          </h1>
          <p>
            {loaded.assets.length} Teile · {scene.generationId}
            {loaded.manifest && !loaded.manifest.complete ? " · bewusst unvollständig" : ""}
          </p>
          {loaded.warnings.map((warning, index) => (
            <p key={index} className={styles.warning}>
              {warning}
            </p>
          ))}
          <SpriteCanvas
            loaded={loaded}
            scene={scene}
            pixels={state.pixels}
            textures={textures}
            selected={state.selected}
            onSelect={(id) => controller.select(id)}
            onBeginMove={(id) => controller.beginMove(id)}
            onMove={(delta) => controller.previewMove(delta)}
            onEndMove={() => controller.finishMove()}
            onCancelMove={() => controller.cancelMove()}
            onNudge={(delta) => {
              const layer = scene.layers.find((layer) => layer.partId === state.selected);
              if (layer)
                controller.updateLayer(layer.partId, {
                  position: { x: layer.position.x + delta.x, y: layer.position.y + delta.y },
                });
            }}
            onUndo={() => controller.undo()}
            onRedo={() => controller.redo()}
          />
          <div className={styles.controls}>
            <button
              type="button"
              disabled={!controller.editable || !!state.inputError || !state.canUndo}
              onClick={() => controller.undo()}
            >
              Szene rückgängig
            </button>
            <button
              type="button"
              disabled={!controller.editable || !!state.inputError || !state.canRedo}
              onClick={() => controller.redo()}
            >
              Szene wiederholen
            </button>
            <button
              type="button"
              disabled={!controller.editable || !!state.inputError}
              onClick={() => setConfirmation("reset")}
            >
              Originalanordnung wiederherstellen
            </button>
            <button
              type="button"
              disabled={!controller.editable || !!state.inputError || !state.dirty || state.saving}
              onClick={() => {
                void controller.flush().catch(() => undefined);
              }}
            >
              Szene jetzt sichern
            </button>
          </div>
          <SpriteTransforms controller={controller} state={state} />
          <button
            type="button"
            disabled={state.busy}
            onClick={() => {
              void controller.refresh();
            }}
          >
            Teile erneut prüfen
          </button>
          {(state.dirty || state.inputError) && state.error ? (
            <button
              type="button"
              disabled={state.busy || state.saving}
              onClick={() => setConfirmation("discard")}
            >
              Lokale Änderungen verwerfen und Dateistand laden
            </button>
          ) : null}
          {!controller.writable ? (
            <p>Schreibgeschützter Vault: Ansicht und Auswahl sind erlaubt, Änderungen nicht.</p>
          ) : null}
          <p role="status">{state.notice}</p>
        </section>
      ) : (
        <>
          {state.busy ? <p role="status">Sprite-Teile werden geladen …</p> : null}
          {welcome}
        </>
      )}
      <ModalHost>
        <Modal
          open={confirmation !== null}
          title={
            confirmation === "reset"
              ? "Originalanordnung wiederherstellen?"
              : "Lokale Änderungen verwerfen?"
          }
          onClose={() => setConfirmation(null)}
        >
          <p>
            {confirmation === "reset"
              ? "Setzt Position, Pivot, Rotation, Skalierung, Ebenen, Sichtbarkeit und Sperren auf die aktuellen Manifest-Defaults. Rückgängig ist möglich. Bei Legacy-Sets sind dies nur manuelle Startpositionen."
              : "Verwirft die lokale Szenenbearbeitung ausdrücklich und lädt die geprüften Dateien erneut. Externe Dateien bleiben unverändert."}
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirmation === "reset") controller.restoreOriginal();
              else void controller.refresh(true);
              setConfirmation(null);
            }}
          >
            {confirmation === "reset"
              ? "Originalanordnung jetzt wiederherstellen"
              : "Änderungen ausdrücklich verwerfen"}
          </button>
          <button type="button" onClick={() => setConfirmation(null)}>
            Abbrechen
          </button>
        </Modal>
      </ModalHost>
    </DataFolderWorkspace>
  );
}
