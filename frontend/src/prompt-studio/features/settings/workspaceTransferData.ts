import { createProfileExportBundle, serializeExportBundle } from "../../services";
import type { AppSettings, ExportBundle, ProfileLibrary, WizardDraft } from "../../schemas";

export interface CreateWorkspaceTransferInput {
  readonly library: ProfileLibrary;
  readonly settings: AppSettings;
  readonly draft: WizardDraft | null;
  readonly exportedAt: string;
  readonly bundleId?: string;
}

export function createWorkspaceBundleId(exportedAt: string): string {
  return `workspace_${exportedAt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")}`;
}

export function createWorkspaceTransfer(input: CreateWorkspaceTransferInput): Readonly<{
  bundle: ExportBundle;
  filename: string;
  contents: string;
}> {
  const bundle = createProfileExportBundle({
    library: input.library,
    bundleId: input.bundleId ?? createWorkspaceBundleId(input.exportedAt),
    exportedAt: input.exportedAt,
    appSettings: input.settings,
    wizardDrafts: input.draft ? [input.draft] : [],
  });

  return {
    bundle,
    filename: `pixelforge-workspace-${input.exportedAt.slice(0, 10)}.json`,
    contents: serializeExportBundle(bundle),
  };
}

export function selectLatestWizardDraft(drafts: readonly WizardDraft[]): WizardDraft | null {
  return drafts.reduce<WizardDraft | null>(
    (latest, draft) => (latest === null || draft.savedAt > latest.savedAt ? draft : latest),
    null,
  );
}
