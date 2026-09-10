import { useEffect, useMemo, useState, useSyncExternalStore, type ComponentProps } from "react";
import { useActiveVault } from "../shared/vault";
import { useDataFolder } from "../shared/data-folder";
import { Modal, ModalHost } from "../shared/dialogs";
import { partDefinition } from "../shared/image/parts";
import { CutoutWelcome } from "./CutoutWelcome";
import { nativeCutoutClient, type CutoutClient } from "./client";
import { CutoutController } from "./controller";
import { pixelCount, rectangle, type MaskTool } from "./masks";
import { MaskCanvas } from "./MaskCanvas";
import { PartToolbar, statusLabel } from "./PartToolbar";
import styles from "./CutoutEditor.module.css";

export function CutoutStudio({
  cutoutClient = nativeCutoutClient,
  ...welcome
}: ComponentProps<typeof CutoutWelcome> & { readonly cutoutClient?: CutoutClient }) {
  const { session, activeVault, saveQueue } = useActiveVault();
  const selection = useDataFolder().selections.cutout;
  const sessionId = session?.sessionId,
    generation = session?.generation,
    writable = activeVault?.mode === "read_write";
  const controller = useMemo(
    () =>
      sessionId && generation !== undefined
        ? new CutoutController({ sessionId, generation }, writable, cutoutClient, saveQueue)
        : null,
    [sessionId, generation, writable, cutoutClient, saveQueue],
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
      selection?.kind === "image" || selection?.kind === "sprite_set"
        ? selection.relativePath
        : null,
    hash =
      selection?.kind === "image"
        ? selection.sha256
        : selection?.kind === "sprite_set"
          ? selection.manifestSha256
          : null,
    isSet = selection?.kind === "sprite_set";
  useEffect(() => {
    if (controller && path && hash) void controller.open(path, hash, isSet).catch(() => undefined);
  }, [controller, path, hash, isSet]);
  return controller ? (
    <CutoutEditor controller={controller} welcome={<CutoutWelcome {...welcome} />} />
  ) : (
    <CutoutWelcome {...welcome} />
  );
}

function CutoutEditor({
  controller,
  welcome,
}: {
  readonly controller: CutoutController;
  readonly welcome: React.ReactNode;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [tool, setTool] = useState<MaskTool>("rectangle"),
    [radius, setRadius] = useState(3);
  const [rect, setRect] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const [reasonDraft, setReasonDraft] = useState<{
    key: string;
    sourceReason: string | null;
    value: string;
  } | null>(null);
  const [padding, setPadding] = useState(0);
  const [detachOpen, setDetachOpen] = useState(false);
  const { loaded, pixels } = state;
  const active = controller.active();
  // Derive a new part's value during render. A passive reset effect could run
  // after a fast first input and erase the user's freshly typed omission reason.
  const reasonKey = `${loaded?.project.id}/${active?.partId}`;
  const sourceReason = active?.reason ?? null;
  const reason =
    reasonDraft?.key === reasonKey && reasonDraft.sourceReason === sourceReason
      ? reasonDraft.value
      : (sourceReason ?? "");
  if (!loaded || !pixels || !active)
    return (
      <>
        {state.error ? (
          <p role="alert" className={styles.error}>
            {state.error}
          </p>
        ) : null}
        {state.busy ? <p role="status">Quellbild wird geladen …</p> : null}
        {welcome}
      </>
    );
  const editable = controller.writable && !state.busy;
  return (
    <section className={styles.editor} aria-label="Cutout-Maskeneditor" aria-busy={state.busy}>
      <h1>{loaded.project.source.originalPath?.split("/").at(-1) ?? "Cutout-Maskeneditor"}</h1>
      <p>
        {loaded.project.source.width} × {loaded.project.source.height} Quellpixel · Original bleibt
        unverändert · anatomische Seiten
      </p>
      <PartToolbar
        parts={state.parts}
        activePartId={state.activePartId}
        onSelect={(id) => controller.selectPart(id)}
        disabled={state.busy}
      />
      <label>
        Zubehör-Slot 17 (vorhandene Maske bleibt erhalten)
        <select
          aria-label="Zubehör-Variante"
          disabled={!editable}
          value={state.parts.some((part) => part.partId === "sword") ? "sword" : "belt_accessory"}
          onChange={(event) =>
            controller.chooseAccessory(event.target.value as "belt_accessory" | "sword")
          }
        >
          <option value="belt_accessory">Gürtel / Zubehör</option>
          <option value="sword">Schwert</option>
        </select>
      </label>
      <div className={styles.controls} role="group" aria-label="Maskenwerkzeuge">
        {(
          [
            ["rectangle", "Rechteck"],
            ["lasso", "Lasso"],
            ["positive", "Pinsel +"],
            ["negative", "Pinsel −"],
            ["protect", "Überlappung schützen"],
            ["pan", "Verschieben"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tool === id}
            disabled={id !== "pan" && !editable}
            onClick={() => setTool(id)}
          >
            {label}
          </button>
        ))}
        <label>
          Pinselradius{" "}
          <input
            type="number"
            aria-label="Pinselradius in Quellpixeln"
            min={0.5}
            max={128}
            step={0.5}
            value={radius}
            onChange={(event) =>
              setRadius(Math.max(0.5, Math.min(128, Number(event.target.value) || 0.5)))
            }
          />{" "}
          px
        </label>
        <button
          type="button"
          disabled={!editable || !state.canUndo}
          onClick={() => controller.undo()}
        >
          Rückgängig
        </button>
        <button
          type="button"
          disabled={!editable || !state.canRedo}
          onClick={() => controller.redo()}
        >
          Wiederholen
        </button>
      </div>
      <section className={styles.partStatus} aria-label="Lokale Auswahlhilfe">
        <div className={styles.controls}>
          <label>
            Alpha-Schwelle
            <input
              type="number"
              min={1}
              max={255}
              value={active.selectionParameters.alphaThreshold}
              disabled={!editable}
              onChange={(event) =>
                controller.setSelectionParameters({
                  ...active.selectionParameters,
                  alphaThreshold: Math.max(
                    1,
                    Math.min(255, Math.floor(Number(event.target.value) || 1)),
                  ),
                })
              }
            />
          </label>
          <label>
            Farbtoleranz
            <input
              type="number"
              min={0}
              max={255}
              value={active.selectionParameters.tolerance}
              disabled={!editable}
              onChange={(event) =>
                controller.setSelectionParameters({
                  ...active.selectionParameters,
                  tolerance: Math.max(
                    0,
                    Math.min(255, Math.floor(Number(event.target.value) || 0)),
                  ),
                })
              }
            />
          </label>
          <label>
            Kantengewicht
            <input
              type="number"
              min={0}
              max={8}
              value={active.selectionParameters.edgeWeight}
              disabled={!editable}
              onChange={(event) =>
                controller.setSelectionParameters({
                  ...active.selectionParameters,
                  edgeWeight: Math.max(0, Math.min(8, Math.floor(Number(event.target.value) || 0))),
                })
              }
            />
          </label>
          <button
            type="button"
            disabled={!editable || state.refineProgress !== null}
            onClick={() => {
              void controller.assist();
            }}
          >
            Auswahl verfeinern
          </button>
          {state.refineProgress !== null ? (
            <>
              <progress
                aria-label="Fortschritt der lokalen Auswahlhilfe"
                max={100}
                value={state.refineProgress}
              />
              <button
                type="button"
                onClick={() => {
                  void controller.cancelAssistance();
                }}
              >
                Auswahlhilfe abbrechen
              </button>
            </>
          ) : null}
        </div>
        <p role="status">{state.refineAdvice}</p>
        <p>
          Rechteck/Lasso begrenzt die Suche. Pinsel + markiert gewünschte Flächen, Pinsel − schließt
          Pixel aus. „Überlappung schützen“ bewahrt bewusst ergänzte sichtbare Anschlussbereiche
          auch außerhalb der ROI. Anschließend prüfen und bestätigen.
        </p>
      </section>
      <MaskCanvas
        pixels={pixels}
        size={loaded.project.source}
        sourceKey={loaded.project.source.sha256}
        partId={active.partId}
        runs={active.mask.draft}
        confirmed={active.mask.confirmed}
        positive={active.mask.positive}
        negative={active.mask.negative}
        protectedRuns={active.mask.protected}
        tool={tool}
        radius={radius}
        readOnly={!editable}
        onStroke={(kind, runs) => controller.stroke(kind, runs)}
        onConfirm={() => controller.confirm()}
        onUndo={() => controller.undo()}
        onRedo={() => controller.redo()}
      />
      <section className={styles.partStatus} aria-label="Aktiver Körperteil">
        <h2>
          {partDefinition(active.partId).label} · {statusLabel[active.status]}
        </h2>
        <p>
          {controller.selectedPixels()} markierte Quellpixel. Andere Körperteile behalten ihre
          eigenen Masken, auch bei Überlappungen.
        </p>
        <p aria-label="Maskenkanäle in Quellpixeln">
          Bestätigt: {pixelCount(active.mask.confirmed)} · Positiv:{" "}
          {pixelCount(active.mask.positive)}
          {" · "}Negativ: {pixelCount(active.mask.negative)} · Geschützte Überlappung:{" "}
          {pixelCount(active.mask.protected)}
        </p>
        <div className={styles.controls}>
          <button type="button" disabled={!editable} onClick={() => controller.confirm()}>
            Auswahl bestätigen
          </button>
          <button type="button" disabled={!editable} onClick={() => controller.clear()}>
            Entwurf leeren
          </button>
          <button
            type="button"
            disabled={!controller.writable || !state.dirty || state.saving}
            onClick={() => {
              void controller.flush().catch(() => undefined);
            }}
          >
            Jetzt speichern
          </button>
        </div>
        <fieldset className={styles.numeric} disabled={!editable}>
          <legend>Rechteck über Quellpixelkoordinaten markieren</legend>
          {(["x", "y", "width", "height"] as const).map((field) => (
            <label key={field}>
              {{ x: "X", y: "Y", width: "Breite", height: "Höhe" }[field]}
              <input
                type="number"
                min={0}
                max={
                  field === "x" || field === "width"
                    ? loaded.project.source.width
                    : loaded.project.source.height
                }
                value={rect[field]}
                onChange={(event) =>
                  setRect({
                    ...rect,
                    [field]: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                  })
                }
              />
            </label>
          ))}
          <button
            type="button"
            onClick={() =>
              controller.stroke(
                "rectangle",
                rectangle(
                  rect,
                  { x: rect.x + rect.width, y: rect.y + rect.height },
                  loaded.project.source,
                ),
              )
            }
          >
            Rechteck markieren
          </button>
        </fieldset>
        {partDefinition(active.partId).required ? (
          <label className={styles.reason}>
            Begründung für „nicht vorhanden“
            <textarea
              maxLength={500}
              value={reason}
              disabled={!editable}
              onChange={(event) =>
                setReasonDraft({ key: reasonKey, sourceReason, value: event.target.value })
              }
            />
          </label>
        ) : null}
        <div>
          <button type="button" disabled={!editable} onClick={() => controller.markAbsent(reason)}>
            {partDefinition(active.partId).required
              ? "Als nicht vorhanden markieren"
              : "Extra deaktivieren"}
          </button>
        </div>
      </section>
      <section className={styles.partStatus} aria-label="PNG-Teile erzeugen">
        <h2>PNG-Teile und Manifest</h2>
        <p>
          {
            state.parts.filter(
              (part) =>
                partDefinition(part.partId).required &&
                ["confirmed", "not_present"].includes(part.status),
            ).length
          }
          /15 Pflichtteile abgeschlossen.{" "}
          {
            state.parts.filter(
              (part) => partDefinition(part.partId).required && part.status === "not_present",
            ).length
          }{" "}
          bewusst ausgelassen. Extras bleiben optional.
        </p>
        <p>
          Originalfarben und Alpha bleiben erhalten. Überlappende halbtransparente Teile können im
          späteren Source-over-Bild deckender wirken.
        </p>
        <label>
          Transparentes Padding (Quellpixel)
          <input
            type="number"
            min={0}
            max={64}
            value={padding}
            disabled={!editable}
            onChange={(event) =>
              setPadding(Math.max(0, Math.min(64, Math.floor(Number(event.target.value) || 0))))
            }
          />
        </label>
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            void controller.prepareGeneration();
          }}
        >
          Ausgabe prüfen
        </button>
        {state.generationTarget ? (
          <div role="group" aria-label="Ausgabe bestätigen">
            <p>
              Ziel: <strong>{state.generationTarget.directory}</strong>
            </p>
            {state.generationTarget.alternative ? (
              <p>
                Der Stammordner ist bereits belegt und wird nicht übernommen. Der angebotene
                alternative Ordner ist frei.
              </p>
            ) : null}
            <p>
              {state.generationTarget.existing
                ? "Nur unveränderte, bisher verwaltete PNGs werden ersetzt; abgewählte Teile werden hashgeprüft entfernt. Eine vorhandene Szene bleibt erhalten."
                : "Hier entsteht der kanonische Teileordner mit Schnittprojekt und Quellsnapshot."}
            </p>
            <button
              type="button"
              disabled={!editable}
              onClick={() => {
                void controller.generate(padding);
              }}
            >
              PNG-Teile jetzt erzeugen
            </button>
          </div>
        ) : null}
      </section>
      {state.error ? (
        <p role="alert" className={styles.error}>
          {state.error}
        </p>
      ) : null}
      <p role="status">{state.saving ? "Masken werden gespeichert …" : state.notice}</p>
      {loaded.project.source.originalPath ? (
        <button
          type="button"
          disabled={!editable || state.saving}
          onClick={() => setDetachOpen(true)}
        >
          Mit gespeichertem Snapshot weiterarbeiten …
        </button>
      ) : (
        <p>
          Originalverknüpfung gelöst · Bearbeitung nutzt ausschließlich den gespeicherten Snapshot.
        </p>
      )}
      <ModalHost>
        <Modal
          open={detachOpen}
          title="Originalverknüpfung lösen?"
          onClose={() => setDetachOpen(false)}
        >
          <p>
            Bei einer entfernten, umbenannten oder veränderten Quelle kannst du mit dem geprüften
            Snapshot weiterarbeiten. Alle Masken einschließlich ungespeicherter Änderungen bleiben
            erhalten. Die Originaldatei wird weder verändert noch wiederhergestellt; eine spätere
            Originaländerung wird nicht übernommen.
          </p>
          <p>
            Existierende Teileordner bleiben bestehen. Für die erste Ausgabe ohne Original entsteht
            ein Ordner mit der Schnittprojekt-ID direkt im Vault; das Ziel wird vor dem Erzeugen
            angezeigt.
          </p>
          <button
            type="button"
            onClick={() => {
              setDetachOpen(false);
              void controller.continueFromSnapshot();
            }}
          >
            Snapshot verwenden und Verknüpfung lösen
          </button>
          <button type="button" onClick={() => setDetachOpen(false)}>
            Abbrechen
          </button>
        </Modal>
      </ModalHost>
    </section>
  );
}
