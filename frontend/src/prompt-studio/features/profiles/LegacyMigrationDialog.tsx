import { useEffect, useMemo, useState } from "react";

import {
  convertLegacyPromptSnapshot,
  readLegacyMigrationInventory,
  type LegacyMigrationInventory,
} from "../../services";
import { useVaultPrompt } from "../../store/vault";
import { Modal } from "../../../shared/dialogs";
import styles from "./VaultProfileView.module.css";

export interface LegacyMigrationDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly now?: () => string;
  readonly readInventory?: typeof readLegacyMigrationInventory;
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

export function LegacyMigrationDialog({
  open,
  onClose,
  now = currentTimestamp,
  readInventory = readLegacyMigrationInventory,
}: LegacyMigrationDialogProps) {
  const { index, writable, applyMigration } = useVaultPrompt();
  const [inventory, setInventory] = useState<LegacyMigrationInventory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"loading" | "ready" | "applying" | "complete" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setInventory(null);
    setSelectedId(null);
    setConfirmed(false);
    setError(null);
    setPreviewTime(now());
    setStatus("loading");
    void readInventory().then(
      (result) => {
        if (!current) return;
        setInventory(result);
        setSelectedId(
          result.items.find((item) => item.convertible)?.sourceId ??
            result.items[0]?.sourceId ??
            null,
        );
        setStatus("ready");
      },
      (reason: unknown) => {
        if (!current) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      },
    );
    return () => {
      current = false;
    };
  }, [now, open, readInventory]);

  const selected = inventory?.items.find((item) => item.sourceId === selectedId) ?? null;
  const preview = useMemo(
    () =>
      selected?.convertible && selected.snapshot
        ? convertLegacyPromptSnapshot({
            sourceId: selected.sourceId,
            sourceHash: selected.sourceHash,
            sourceSnapshot: selected.sourceSnapshot,
            snapshot: selected.snapshot,
            migratedAt: previewTime,
            target: index,
          })
        : null,
    [index, previewTime, selected],
  );

  const apply = (): void => {
    if (!confirmed || !preview?.applicable || !preview.bundle || !writable) return;
    setStatus("applying");
    setError(null);
    void applyMigration(preview.bundle).then(
      () => setStatus("complete"),
      (reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
        setStatus("error");
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      canDismiss={status !== "applying"}
      title="Legacy-Daten in diesen Vault übernehmen"
      className={styles.migrationDialog}
      closeLabel="Migrationsdialog schließen"
    >
      <div className={styles.migrationContent}>
        <p>
          Die Vorschau liest alte AppData- und Browserbestände, verändert sie aber nicht. Erst die
          ausdrückliche Bestätigung veröffentlicht einen geprüften Dateisatz im aktuellen Vault.
        </p>
        {status === "loading" ? (
          <p role="status">Altbestände werden schreibgeschützt inventarisiert…</p>
        ) : null}
        {inventory?.issues.map((issue) => (
          <p key={`${issue.sourceId}:${issue.code}`} role="alert">
            {issue.sourceId}: {issue.message}
          </p>
        ))}
        {inventory && inventory.items.length === 0 ? (
          <p role="status">Keine erreichbaren Altbestände gefunden.</p>
        ) : null}
        {inventory && inventory.items.length > 0 ? (
          <fieldset className={styles.sourceList}>
            <legend>Quelle für die Vorschau</legend>
            {inventory.items.map((item) => (
              <label key={item.sourceId}>
                <input
                  type="radio"
                  name="legacy-source"
                  checked={selectedId === item.sourceId}
                  onChange={() => {
                    setSelectedId(item.sourceId);
                    setConfirmed(false);
                  }}
                />
                <span>
                  <strong>{item.sourceId}</strong>
                  <small>
                    {item.sourceKind} · SHA-256 {item.sourceHash.slice(0, 12)}…
                  </small>
                </span>
              </label>
            ))}
          </fieldset>
        ) : null}
        {selected && !selected.convertible ? (
          <p role="alert">
            Dieser Altbestand ist nicht schema-gültig und kann deshalb nicht veröffentlicht werden.
          </p>
        ) : null}
        {preview ? (
          <section className={styles.migrationPreview} aria-label="Migrationsvorschau">
            <h3>Vorschau</h3>
            <dl>
              <div>
                <dt>Basisprofile</dt>
                <dd>{preview.bundle?.baseProfile ? 1 : 0}</dd>
              </div>
              <div>
                <dt>Assetprofile</dt>
                <dd>{preview.bundle?.profiles.length ?? 0}</dd>
              </div>
              <div>
                <dt>Entwürfe</dt>
                <dd>{preview.bundle?.draft ? 1 : 0}</dd>
              </div>
            </dl>
            {preview.warnings.map((warning) => (
              <p key={`${warning.code}:${warning.message}`} role="note">
                {warning.message}
              </p>
            ))}
            {preview.conflicts.map((conflict) => (
              <p key={`${conflict.code}:${conflict.sourceId ?? "all"}`} role="alert">
                {conflict.message}
              </p>
            ))}
            {preview.applicable ? (
              <label className={styles.confirmMigration}>
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.currentTarget.checked)}
                />
                <span>Ich bestätige die Veröffentlichung dieser Vorschau im aktuellen Vault.</span>
              </label>
            ) : null}
          </section>
        ) : null}
        {status === "complete" ? (
          <p className={styles.migrationSuccess} role="status">
            Migration veröffentlicht und aus dem Vault wieder eingelesen. Die Quelle blieb
            unverändert.
          </p>
        ) : null}
        {error ? <p role="alert">Migration nicht angewendet: {error}</p> : null}
        <div className={styles.formActions}>
          <button type="button" disabled={status === "applying"} onClick={onClose}>
            {status === "complete" ? "Schließen" : "Abbrechen"}
          </button>
          {status !== "complete" ? (
            <button
              type="button"
              className="primary-button"
              disabled={!confirmed || !preview?.applicable || !writable || status === "applying"}
              onClick={apply}
            >
              {status === "applying" ? "Veröffentlicht…" : "Bestätigt migrieren"}
            </button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
