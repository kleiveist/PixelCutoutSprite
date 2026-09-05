import { useState } from "react";

import {
  vaultClient,
  type OpenVault,
  type RecoveryCandidate,
  type RecoveryStatus,
  type VaultClient,
} from "../../api/vault-client";
import { classifyNativeError, downloadRecoveryCopy, type EditorRecoveryCopy } from "../editing";

interface RecoveryPanelProps {
  vault: OpenVault;
  client?: VaultClient;
  onRecovered: (status: RecoveryStatus) => void;
  onCloseVault?: () => void;
  editorRecoveryCopy?: EditorRecoveryCopy | null;
}

export function RecoveryPanel({
  vault,
  client = vaultClient,
  onRecovered,
  onCloseVault,
  editorRecoveryCopy = null,
}: RecoveryPanelProps) {
  const [busyTransaction, setBusyTransaction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const candidates = vault.recovery ?? [];
  if (candidates.length === 0) return null;

  async function recover(
    candidate: RecoveryCandidate,
    choice: "resume" | "rollback",
  ): Promise<void> {
    setBusyTransaction(candidate.transaction_id);
    setError(null);
    try {
      onRecovered(await client.recover(vault.session_id, candidate.transaction_id, choice));
    } catch (reason) {
      setError(classifyNativeError(reason).message);
    } finally {
      setBusyTransaction(null);
    }
  }

  async function refresh(): Promise<void> {
    setBusyTransaction("refresh");
    setError(null);
    try {
      onRecovered(await client.listRecovery(vault.session_id));
    } catch (reason) {
      setError(classifyNativeError(reason).message);
    } finally {
      setBusyTransaction(null);
    }
  }

  return (
    <section
      className="vault-notice recovery-panel"
      aria-labelledby="recovery-title"
      aria-busy={busyTransaction !== null}
    >
      <span className="phase-tag">VAULT RECOVERY</span>
      <h1 id="recovery-title">Interrupted file operations need a decision</h1>
      <p>
        Studio has not opened a workspace. Resolve every journal by resuming its remaining steps or
        restoring its backup first.
      </p>
      {!vault.recovery_writable && (
        <p role="status">
          This session cannot write recovery changes. Close it and reopen the vault as the active
          recovery writer to continue.
        </p>
      )}
      {editorRecoveryCopy && (
        <p role="status">
          The interrupted editor state is still available in memory. Save a separate recovery copy
          before rolling the file transaction back if you want to keep those edits.{" "}
          <button
            type="button"
            disabled={busyTransaction !== null}
            onClick={() =>
              downloadRecoveryCopy(editorRecoveryCopy.fileName, editorRecoveryCopy.value)
            }
          >
            Save interrupted editor copy
          </button>
        </p>
      )}
      <ul>
        {candidates.map((candidate) => {
          const busy = busyTransaction === candidate.transaction_id;
          return (
            <li key={candidate.transaction_id}>
              <div>
                <strong>{purposeLabel(candidate.purpose)}</strong>
                <span>
                  {candidate.project} · {candidate.journal} · {candidate.state.replaceAll("_", " ")}{" "}
                  · {candidate.completed_steps}/{candidate.total_steps} steps ·{" "}
                  <code>{candidate.transaction_id}</code>
                </span>
                {candidate.issue && <span role="status">{candidate.issue}</span>}
              </div>
              <button
                type="button"
                disabled={
                  !vault.recovery_writable || busyTransaction !== null || !candidate.can_resume
                }
                onClick={() => void recover(candidate, "resume")}
              >
                {busy ? "Recovering…" : "Resume"}
              </button>
              <button
                type="button"
                disabled={
                  !vault.recovery_writable || busyTransaction !== null || !candidate.can_rollback
                }
                onClick={() => void recover(candidate, "rollback")}
              >
                {busy ? "Recovering…" : "Restore backup"}
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p role="alert">Recovery failed without discarding the journal: {error}</p>}
      <button type="button" disabled={busyTransaction !== null} onClick={() => void refresh()}>
        Refresh recovery state
      </button>
      {onCloseVault && (
        <button type="button" disabled={busyTransaction !== null} onClick={onCloseVault}>
          Close vault
        </button>
      )}
    </section>
  );
}

function purposeLabel(purpose: RecoveryCandidate["purpose"]): string {
  return purpose.replaceAll("_", " ").replace(/^./, (character) => character.toUpperCase());
}
