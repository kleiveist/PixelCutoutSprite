import { useEffect, useState } from "react";

import {
  vaultClient,
  type OpenVault,
  type VaultClient,
  type VaultInspection,
} from "../../api/vault-client";

interface VaultWelcomeProps {
  client?: VaultClient;
  onOpened: (vault: OpenVault) => void;
}

export function VaultWelcome({ client = vaultClient, onOpened }: VaultWelcomeProps) {
  const [inspection, setInspection] = useState<VaultInspection | null>(null);
  const [recents, setRecents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const result = await client.inspect(path);
      setInspection(result);
      if (result.state === "empty") onOpened(await client.initialize(path));
      if (result.state === "valid") onOpened(await client.open(path));
    });
  }

  async function confirmForeignVault(): Promise<void> {
    if (inspection?.state !== "foreign") return;
    await run(async () => {
      onOpened(await client.initialize(inspection.path, inspection.confirmation_token));
    });
  }

  async function reopen(path: string): Promise<void> {
    await run(async () => onOpened(await client.open(path)));
  }

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
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
