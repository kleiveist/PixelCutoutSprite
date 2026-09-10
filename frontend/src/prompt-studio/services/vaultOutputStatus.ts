import type { VaultBaseProfile, VaultPromptProfile } from "../schemas";
import { VAULT_PROMPT_GENERATOR_VERSION } from "./vaultPromptGenerator";

export function vaultOutputsAreCurrent(
  profile: VaultPromptProfile,
  base: VaultBaseProfile | null,
): boolean {
  const source = profile.outputs.generatedFrom;
  return (
    profile.status === "ready" &&
    profile.outputs.status === "fresh" &&
    base !== null &&
    profile.baseProfileId === base.id &&
    source?.baseRevision === base.revision &&
    source.draftRevision === profile.draftRevision &&
    source.generatorVersion === VAULT_PROMPT_GENERATOR_VERSION &&
    profile.outputs.files.length > 0
  );
}

export function vaultProfileStatus(
  profile: VaultPromptProfile,
  base: VaultBaseProfile | null,
): string {
  if (profile.outputs.status === "error") return "Ausgabefehler";
  if (profile.status === "incomplete") return "Entwurf · unvollständig";
  if (vaultOutputsAreCurrent(profile, base)) return "Ausgaben aktuell";
  return profile.outputs.files.length ? "Ausgaben veraltet" : "Ausgaben ausstehend";
}
