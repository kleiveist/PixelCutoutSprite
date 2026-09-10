import { useEffect, useState } from "react";

import {
  vaultClient,
  type OpenVault,
  type VaultClient,
  type VaultInspection,
} from "./vault-client";
import { classifyNativeError } from "../storage/nativeErrors";

interface VaultWelcomeProps {
  client?: VaultClient;
  currentVault?: OpenVault | null;
  onOpened: (vault: OpenVault) => void | Promise<void>;
  beforeOpen?: () => Promise<void>;
}

export function VaultWelcome({
  client = vaultClient,
  currentVault = null,
  onOpened,
  beforeOpen,
}: VaultWelcomeProps) {
  const [inspection, setInspection] = useState<VaultInspection | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockRemovalArmed, setLockRemovalArmed] = useState(false);

  useEffect(() => {
    void client
      .recent()
      .then(setRecents)
      .catch(() => setRecents([]));
  }, [client]);

  async function chooseVault(): Promise<void> {
    await run(async () => {
      const path = await client.chooseDirectory();
      if (!path) return;
      if (currentVault?.path === path && currentVault.mode === "read_write") {
        await onOpened(currentVault);
        return;
      }
      const result = await client.inspect(path);
      setInspection(result);
      setLockRemovalArmed(false);
      if (result.state === "empty") await activate(await client.initialize(path));
      if (result.state === "valid" && !result.writer_present)
        await activate(await client.open(path));
    });
  }

  async function confirmForeignVault(): Promise<void> {
    if (inspection?.state !== "foreign") return;
    await run(async () => {
      await activate(await client.initialize(inspection.path, inspection.confirmation_token));
    });
  }

  async function reopen(path: string): Promise<void> {
    await run(async () => {
      if (currentVault?.path === path && currentVault.mode === "read_write") {
        await onOpened(currentVault);
        return;
      }
      const result = await client.inspect(path);
      setInspection(result);
      setLockRemovalArmed(false);
      if (result.state === "valid" && !result.writer_present) {
        await activate(await client.open(path));
      }
    });
  }

  async function openReadOnly(): Promise<void> {
    if (inspection?.state !== "valid") return;
    await run(async () => await activate(await client.open(inspection.path)));
  }

  async function recoverConfirmedCrash(): Promise<void> {
    if (inspection?.state !== "valid" || !inspection.lock_recovery) return;
    const path = inspection.path;
    const confirmationToken = inspection.lock_recovery.confirmation_token;
    setBusy(true);
    setError(null);
    try {
      await beforeOpen?.();
      await client.recoverOrphanedLock(path, confirmationToken);
      await activate(await client.open(path));
    } catch (reason) {
      const failure = classifyNativeError(reason);
      try {
        setInspection(await client.inspect(path));
        setError(`${failure.message} The current lock state was refreshed; review it again.`);
      } catch {
        setError(failure.message);
      }
      setLockRemovalArmed(false);
    } finally {
      setBusy(false);
    }
  }

  async function activate(opened: OpenVault): Promise<void> {
    try {
      await onOpened(opened);
    } catch (reason) {
      if (opened.session_id !== currentVault?.session_id) await client.close(opened.session_id);
      throw reason;
    }
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await beforeOpen?.();
      await action();
    } catch (reason) {
      setError(classifyNativeError(reason).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vault-actions">
      <button className="primary-button" type="button" disabled={busy} onClick={chooseVault}>
        {busy ? "Checking vault…" : "Choose vault"} <span aria-hidden="true">→</span>
      </button>
      <span className="shortcut-hint">Local JSON + PNG · no cloud</span>

      {inspection?.state === "foreign" && (
        <section className="vault-notice" aria-labelledby="foreign-vault-title">
          <strong id="foreign-vault-title">Initialize this existing folder?</strong>
          <p>
            It contains {inspection.entry_count} existing{" "}
            {inspection.entry_count === 1 ? "entry" : "entries"}. They remain untouched; Studio adds
            only its named metadata folder.
          </p>
          <button type="button" disabled={busy} onClick={confirmForeignVault}>
            Initialize without replacing files
          </button>
        </section>
      )}

      {inspection?.state === "valid" && inspection.writer_present && (
        <section className="vault-notice" aria-labelledby="writer-lock-title">
          <strong id="writer-lock-title">This vault already has a writer</strong>
          <p>
            Open it read-only while that app is active. Remove the lock only after verifying that
            its owner process has ended; elapsed time alone never expires a writer lock.
          </p>
          {inspection.lock_recovery?.owner && (
            <p>
              Recorded owner: process {inspection.lock_recovery.owner.process_id} · instance{" "}
              <code>{inspection.lock_recovery.owner.instance_id}</code>
            </p>
          )}
          {inspection.lock_recovery?.damaged && (
            <p role="status">The lock metadata is damaged, so its owner could not be identified.</p>
          )}
          <button type="button" disabled={busy} onClick={openReadOnly}>
            Open read-only
          </button>
          {!lockRemovalArmed ? (
            <button
              type="button"
              disabled={busy || !inspection.lock_recovery}
              onClick={() => setLockRemovalArmed(true)}
            >
              I verified the previous app stopped
            </button>
          ) : (
            <div
              className="vault-lock-confirmation"
              role="group"
              aria-labelledby="lock-removal-confirmation-title"
            >
              <strong id="lock-removal-confirmation-title">Final confirmation</strong>
              <p>
                Removing a live writer lock could allow two apps to modify this vault. Continue only
                if the recorded process is no longer running.
              </p>
              <button type="button" disabled={busy} onClick={recoverConfirmedCrash}>
                Remove recorded lock and open
              </button>
              <button type="button" disabled={busy} onClick={() => setLockRemovalArmed(false)}>
                Keep lock
              </button>
            </div>
          )}
        </section>
      )}

      {inspection?.state === "damaged" && (
        <p className="vault-error" role="alert">
          This vault needs repair and was not modified: {inspection.message}
        </p>
      )}
      {error && (
        <p className="vault-error" role="alert">
          {error}
        </p>
      )}
      {recents.length > 0 && (
        <div className="recent-vaults" aria-label="Recent vaults">
          <span>Recent</span>
          {recents.map((path) => (
            <button type="button" key={path} disabled={busy} onClick={() => reopen(path)}>
              {path}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
