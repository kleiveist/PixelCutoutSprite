import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Badge, Surface } from "../../components/ui";
import { ThemeSwitcher } from "../../components/theme";
import type { ProfileLibrary } from "../../schemas";
import {
  inspectProfileImport,
  type InspectedProfileImport,
  type LegacyV1StorageMigrationResult,
  type OutputWorkspaceAdapter,
  type V2StorageAdapter,
} from "../../services";
import { useProfileLibrary } from "../../store/profiles";
import { useSettings } from "../../store/settings";
import { useWizardSession } from "../../store/wizard";
import { createWorkspaceTransfer, selectLatestWizardDraft } from "./workspaceTransferData";
import styles from "./SettingsView.module.css";

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const EMPTY_LIBRARY: ProfileLibrary = {
  baseProfiles: [],
  categoryProfiles: [],
  assetProfiles: [],
};

export type SettingsTransferStorage = Pick<V2StorageAdapter, "readDraft" | "writeDraft">;

export interface SettingsViewProps {
  readonly outputAdapter: OutputWorkspaceAdapter;
  readonly startupMigration: LegacyV1StorageMigrationResult;
  readonly storageAdapter: SettingsTransferStorage;
  readonly now?: () => string;
  readonly readFileText?: (file: File) => Promise<string>;
  readonly createBundleId?: (exportedAt: string) => string;
}

type TransferStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "working"; message: string }>
  | Readonly<{ kind: "success"; message: string }>
  | Readonly<{ kind: "error"; message: string }>;

interface PendingImport {
  readonly filename: string;
  readonly json: string;
  readonly inspection: InspectedProfileImport;
}

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function readBrowserFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Die ausgewählte Datei enthält keinen Text."));
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Die ausgewählte Datei konnte nicht gelesen werden."));
    });
    reader.readAsText(file);
  });
}

function profileCount(library: ProfileLibrary): number {
  return (
    library.baseProfiles.length + library.categoryProfiles.length + library.assetProfiles.length
  );
}

function migrationCounts(
  result: Extract<LegacyV1StorageMigrationResult, { status: "migrated" | "alreadyMigrated" }>,
): string {
  const { counts } = result;
  return `${counts.baseProfiles} Basis-, ${counts.categoryProfiles} Kategorie- und ${counts.assetProfiles} Assetprofil(e)`;
}

function MigrationStatus({ result }: Readonly<{ result: LegacyV1StorageMigrationResult }>) {
  if (result.status === "notNeeded") {
    return (
      <p className={styles.migrationNotice} role="status">
        Keine V1-Daten gefunden. Der V2-Workspace ist bereit.
      </p>
    );
  }

  if (result.status === "migrated" || result.status === "alreadyMigrated") {
    const warningCount =
      result.warnings.length + (result.status === "migrated" ? result.issues.length : 0);
    return (
      <div className={styles.migrationNotice} data-state="success" role="status">
        <strong>
          {result.status === "migrated"
            ? "V1-Daten wurden automatisch migriert."
            : "Die V1-Migration ist bereits abgeschlossen."}
        </strong>
        <span>{migrationCounts(result)} · Backup geprüft</span>
        {warningCount > 0 ? (
          <span>{warningCount} Hinweis(e) wurden beim Überführen protokolliert.</span>
        ) : null}
      </div>
    );
  }

  if (result.status === "unavailable") {
    return (
      <div className={styles.migrationNotice} data-state="error" role="alert">
        <strong>V1-Migration konnte nicht abgeschlossen werden.</strong>
        <span>{result.message}</span>
        {result.profilesWritten ? (
          <span>
            Profile wurden geschrieben; der Abschlussstatus konnte nicht gesichert werden.
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={styles.migrationNotice} data-state="error" role="alert">
      <strong>
        {result.status === "conflict"
          ? "V1-Daten kollidieren mit vorhandenen V2-Profilen."
          : "V1-Daten konnten nicht sicher migriert werden."}
      </strong>
      <span>Die Quelldaten bleiben unangetastet.</span>
      {result.issues.length > 0 ? (
        <ul>
          {result.issues.map((issue, index) => (
            <li key={`${issue.sourceKey}-${issue.code}-${index}`}>
              {issue.sourceKey}: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ImportInspection({ pending }: Readonly<{ pending: PendingImport }>) {
  const { inspection } = pending;
  if (inspection.status === "invalid") {
    return (
      <div className={styles.importInspection} data-state="error" role="alert">
        <strong>Importdatei ist ungültig</strong>
        <span>{inspection.message}</span>
        {inspection.issues.length > 0 ? (
          <ul>
            {inspection.issues.slice(0, 8).map((issue, index) => (
              <li key={`${issue.path}-${index}`}>
                {issue.path ? `${issue.path}: ` : ""}
                {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  const bundle = inspection.bundle;
  return (
    <div
      className={styles.importInspection}
      data-state={inspection.status === "conflict" ? "warning" : "ready"}
      role={inspection.status === "conflict" ? "alert" : "status"}
    >
      <strong>
        {inspection.status === "conflict"
          ? `${inspection.conflicts.length} ID-Konflikt(e) gefunden`
          : "Importdatei vollständig validiert"}
      </strong>
      <span>{pending.filename}</span>
      <dl className={styles.compactFacts}>
        <div>
          <dt>Profile</dt>
          <dd>
            {bundle.baseProfiles.length} / {bundle.categoryProfiles.length} /{" "}
            {bundle.assetProfiles.length}
          </dd>
        </div>
        <div>
          <dt>Einstellungen</dt>
          <dd>{bundle.appSettings ? "enthalten" : "nicht enthalten"}</dd>
        </div>
        <div>
          <dt>Entwürfe</dt>
          <dd>{bundle.wizardDrafts.length}</dd>
        </div>
        <div>
          <dt>Identisch</dt>
          <dd>{inspection.identicalProfiles.length}</dd>
        </div>
      </dl>
      {inspection.status === "conflict" ? (
        <p>
          Importieren ersetzt ausschließlich die aufgeführten IDs. Alle anderen lokalen Profile
          bleiben erhalten.
        </p>
      ) : null}
    </div>
  );
}

export function SettingsView({
  outputAdapter,
  startupMigration,
  storageAdapter,
  now = currentIsoTimestamp,
  readFileText = readBrowserFileText,
  createBundleId,
}: SettingsViewProps) {
  const { settings, restoreSettings } = useSettings();
  const { libraryResult, importProfileBundle } = useProfileLibrary();
  const { requestResume } = useWizardSession();
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [restoreImportedSettings, setRestoreImportedSettings] = useState(true);
  const [restoreImportedDraft, setRestoreImportedDraft] = useState(true);
  const [status, setStatus] = useState<TransferStatus>({ kind: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  const library =
    libraryResult.status === "valid"
      ? libraryResult.value
      : libraryResult.status === "empty"
        ? EMPTY_LIBRARY
        : null;

  useEffect(() => {
    if (status.kind === "success" || status.kind === "error") {
      statusRef.current?.focus();
    }
  }, [status]);

  const exportWorkspace = async () => {
    if (library === null) {
      setStatus({
        kind: "error",
        message:
          "Der Workspace kann erst exportiert werden, wenn die Profilbibliothek gültig und erreichbar ist.",
      });
      return;
    }

    const draftResult = storageAdapter.readDraft();
    if (draftResult.status === "invalid" || draftResult.status === "unavailable") {
      setStatus({
        kind: "error",
        message:
          draftResult.status === "invalid"
            ? "Der Workspace wurde nicht exportiert, weil der lokale Entwurf ungültig ist."
            : "Der Workspace wurde nicht exportiert, weil der lokale Entwurf nicht gelesen werden kann.",
      });
      return;
    }

    try {
      const exportedAt = now();
      const transfer = createWorkspaceTransfer({
        library,
        settings,
        draft: draftResult.status === "valid" ? draftResult.value : null,
        exportedAt,
        ...(createBundleId ? { bundleId: createBundleId(exportedAt) } : {}),
      });
      await outputAdapter.downloadTextFile({
        filename: transfer.filename,
        contents: transfer.contents,
        mimeType: "application/json;charset=utf-8",
      });
      setStatus({
        kind: "success",
        message: `Workspace mit ${profileCount(library)} Profil(en) wurde als JSON bereitgestellt.`,
      });
    } catch {
      setStatus({
        kind: "error",
        message: "Der validierte Workspace konnte nicht als JSON bereitgestellt werden.",
      });
    }
  };

  const inspectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (library === null) {
      setStatus({
        kind: "error",
        message:
          "Ein Import ist erst möglich, wenn die lokale Profilbibliothek gültig und erreichbar ist.",
      });
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      setPendingImport(null);
      setStatus({
        kind: "error",
        message: "Die Importdatei ist größer als 10 MiB und wurde nicht gelesen.",
      });
      return;
    }

    setStatus({ kind: "working", message: "Importdatei wird geprüft …" });
    try {
      const json = await readFileText(file);
      setPendingImport({
        filename: file.name,
        json,
        inspection: inspectProfileImport(json, library),
      });
      setRestoreImportedSettings(true);
      setRestoreImportedDraft(true);
      setStatus({ kind: "idle" });
    } catch {
      setPendingImport(null);
      setStatus({
        kind: "error",
        message: "Die ausgewählte Importdatei konnte nicht gelesen werden.",
      });
    }
  };

  const selectNativeImport = async () => {
    if (!outputAdapter.selectJsonFile || library === null) return;
    setStatus({ kind: "working", message: "Importdatei wird ausgewählt und geprüft …" });
    try {
      const selected = await outputAdapter.selectJsonFile();
      if (!selected) {
        setStatus({ kind: "idle" });
        return;
      }
      setPendingImport({
        filename: selected.filename,
        json: selected.contents,
        inspection: inspectProfileImport(selected.contents, library),
      });
      setRestoreImportedSettings(true);
      setRestoreImportedDraft(true);
      setStatus({ kind: "idle" });
    } catch {
      setPendingImport(null);
      setStatus({
        kind: "error",
        message: "Die ausgewählte Importdatei konnte nicht gelesen werden.",
      });
    }
  };

  const applyImport = () => {
    if (!pendingImport || pendingImport.inspection.status === "invalid") return;

    const conflictStrategy =
      pendingImport.inspection.status === "conflict"
        ? { conflictStrategy: "replaceExisting" as const }
        : {};
    const result = importProfileBundle(pendingImport.json, conflictStrategy);
    if (result.status === "conflict") {
      setPendingImport({
        ...pendingImport,
        inspection: result,
      });
      setStatus({
        kind: "error",
        message:
          "Die lokalen Profile haben sich geändert. Prüfe die aktualisierten Konflikte und bestätige erneut.",
      });
      return;
    }
    if (result.status !== "imported") {
      setStatus({
        kind: "error",
        message: result.message,
      });
      return;
    }

    const followUpErrors: string[] = [];
    if (restoreImportedSettings && result.workspaceData.appSettings) {
      const settingsResult = restoreSettings(result.workspaceData.appSettings);
      if (settingsResult.status !== "ok") {
        followUpErrors.push("Einstellungen konnten nicht wiederhergestellt werden");
      }
    }
    if (restoreImportedDraft && result.workspaceData.wizardDrafts.length > 0) {
      const latestDraft = selectLatestWizardDraft(result.workspaceData.wizardDrafts);
      const draftResult = latestDraft
        ? storageAdapter.writeDraft(latestDraft)
        : { status: "ok" as const };
      if (draftResult.status !== "ok") {
        followUpErrors.push("der neueste Entwurf konnte nicht wiederhergestellt werden");
      } else if (latestDraft) {
        requestResume(latestDraft.draftId);
      }
    }

    const count =
      result.counts.baseProfiles + result.counts.categoryProfiles + result.counts.assetProfiles;
    if (followUpErrors.length > 0) {
      setStatus({
        kind: "error",
        message: `${count} Profil(e) wurden importiert; ${followUpErrors.join(" und ")}.`,
      });
      return;
    }

    setPendingImport(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setStatus({
      kind: "success",
      message: `${count} Profil(e) importiert. ${result.identicalProfiles.length} identische Profil(e) blieben unverändert.`,
    });
  };

  const actionableInspection =
    pendingImport?.inspection.status === "ready" || pendingImport?.inspection.status === "conflict"
      ? pendingImport.inspection
      : null;

  return (
    <div className={styles.view}>
      <Surface
        as="section"
        className={styles.hero}
        tone="raised"
        aria-labelledby="settings-view-title"
      >
        <div>
          <Badge tone="accent">Lokaler Workspace · V2</Badge>
          <p className={styles.eyebrow}>Einstellungen &amp; Datentransfer</p>
          <h1 id="settings-view-title">Das Studio passend konfigurieren.</h1>
          <p className={styles.description}>
            Darstellung, Profile und dein letzter Entwurf bleiben lokal. Sichere den vollständigen
            Workspace als validiertes JSON oder stelle ihn kontrolliert wieder her.
          </p>
        </div>
        <dl className={styles.heroFacts} aria-label="Workspace-Status">
          <div>
            <dt>Profile</dt>
            <dd>{library ? profileCount(library) : "–"}</dd>
          </div>
          <div>
            <dt>Theme</dt>
            <dd>{settings.theme}</dd>
          </div>
          <div>
            <dt>Speicher</dt>
            <dd>{library ? "bereit" : "gesperrt"}</dd>
          </div>
        </dl>
      </Surface>

      <Surface
        as="section"
        className={styles.transferPanel}
        tone="soft"
        aria-labelledby="appearance-title"
      >
        <div className={styles.panelHeading}>
          <span className={styles.sectionIndex}>01</span>
          <h2 id="appearance-title">Darstellung</h2>
        </div>
        <p>Die Darstellung gilt ausschließlich für den eingebetteten Prompt-Generator.</p>
        <ThemeSwitcher />
      </Surface>

      <section className={styles.section} aria-labelledby="migration-title">
        <div className={styles.sectionHeading}>
          <p className={styles.sectionIndex}>01 · Migration</p>
          <h2 id="migration-title">V1 → V2</h2>
          <p>
            Beim Start werden vorhandene V1-Daten vor dem ersten V2-Lesezugriff geprüft, gesichert
            und idempotent migriert.
          </p>
        </div>
        <MigrationStatus result={startupMigration} />
      </section>

      <div className={styles.transferGrid}>
        <Surface
          as="section"
          className={styles.transferPanel}
          tone="soft"
          aria-labelledby="export-title"
        >
          <div className={styles.panelHeading}>
            <span className={styles.sectionIndex}>02</span>
            <h2 id="export-title">Workspace exportieren</h2>
          </div>
          <p>
            Enthält alle Basis-, Kategorie- und Assetprofile, die aktuellen App-Einstellungen und –
            falls vorhanden – den letzten Entwurf.
          </p>
          <button type="button" onClick={() => void exportWorkspace()} disabled={library === null}>
            Workspace als JSON exportieren
          </button>
        </Surface>

        <Surface
          as="section"
          className={styles.transferPanel}
          tone="soft"
          aria-labelledby="import-title"
        >
          <div className={styles.panelHeading}>
            <span className={styles.sectionIndex}>03</span>
            <h2 id="import-title">Workspace importieren</h2>
          </div>
          <p>
            JSON wird zuerst vollständig validiert. Abweichende Profile mit derselben ID werden nur
            nach deiner ausdrücklichen Bestätigung ersetzt.
          </p>
          <div className={styles.fileField}>
            {outputAdapter.selectJsonFile ? (
              <button
                type="button"
                onClick={() => void selectNativeImport()}
                disabled={library === null}
              >
                V2-JSON über nativen Dialog auswählen
              </button>
            ) : (
              <>
                <label htmlFor="workspace-json-file">PixelForge-V2-JSON auswählen</label>
                <input
                  ref={fileInputRef}
                  id="workspace-json-file"
                  type="file"
                  accept="application/json,.json"
                  aria-describedby="workspace-json-file-help"
                  onChange={(event) => void inspectFile(event)}
                  disabled={library === null}
                />
              </>
            )}
            <small id="workspace-json-file-help">Maximal 10 MiB · bleibt vollständig lokal</small>
          </div>

          {pendingImport ? <ImportInspection pending={pendingImport} /> : null}

          {actionableInspection ? (
            <fieldset className={styles.restoreOptions}>
              <legend>Zusätzliche Workspace-Daten</legend>
              {actionableInspection.bundle.appSettings ? (
                <label>
                  <input
                    type="checkbox"
                    checked={restoreImportedSettings}
                    onChange={(event) => setRestoreImportedSettings(event.target.checked)}
                  />
                  App-Einstellungen übernehmen
                </label>
              ) : null}
              {actionableInspection.bundle.wizardDrafts.length > 0 ? (
                <label>
                  <input
                    type="checkbox"
                    checked={restoreImportedDraft}
                    onChange={(event) => setRestoreImportedDraft(event.target.checked)}
                  />
                  Neuesten Entwurf übernehmen
                </label>
              ) : null}
            </fieldset>
          ) : null}

          {actionableInspection ? (
            <button
              className={
                actionableInspection.status === "conflict" ? styles.dangerAction : undefined
              }
              type="button"
              onClick={applyImport}
            >
              {actionableInspection.status === "conflict"
                ? "Konflikte ersetzen und importieren"
                : "Geprüften Workspace importieren"}
            </button>
          ) : null}
        </Surface>
      </div>

      {status.kind !== "idle" ? (
        <div
          ref={statusRef}
          className={styles.transferStatus}
          data-state={status.kind}
          role={status.kind === "error" ? "alert" : "status"}
          tabIndex={-1}
        >
          {status.message}
        </div>
      ) : null}
    </div>
  );
}
