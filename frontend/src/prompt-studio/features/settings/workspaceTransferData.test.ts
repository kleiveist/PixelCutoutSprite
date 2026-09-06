import { describe, expect, it } from "vitest";
import { parseAppSettings, parseWizardDraft } from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import {
  createWorkspaceBundleId,
  createWorkspaceTransfer,
  selectLatestWizardDraft,
} from "./workspaceTransferData";

const exportedAt = "2026-09-03T12:34:56.000Z";

function draft(draftId: string, savedAt: string) {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId,
    projectName: "Transfer test",
    route: "wizard/project",
    currentStep: "project",
    validation: { errors: [], warnings: [] },
    savedAt,
  });
}

describe("workspace transfer data", () => {
  it("creates a stable validated full-workspace JSON file", () => {
    const library = createProfileLibraryFixture();
    const settings = parseAppSettings({
      schemaVersion: 2,
      kind: "appSettings",
      theme: "dark",
      locale: "de",
      startView: "dashboard",
      activeBaseProfileId: library.baseProfiles[0]?.id ?? null,
      updatedAt: exportedAt,
    });
    const activeDraft = draft("draft_export", exportedAt);

    const result = createWorkspaceTransfer({
      library,
      settings,
      draft: activeDraft,
      exportedAt,
    });

    expect(result.filename).toBe("pixelforge-workspace-2026-09-03.json");
    expect(result.bundle.bundleId).toBe("workspace_2026_09_03t12_34_56_000z");
    expect(result.bundle.baseProfiles).toEqual(library.baseProfiles);
    expect(result.bundle.categoryProfiles).toEqual(library.categoryProfiles);
    expect(result.bundle.assetProfiles).toEqual(library.assetProfiles);
    expect(result.bundle.appSettings).toEqual(settings);
    expect(result.bundle.wizardDrafts).toEqual([activeDraft]);
    expect(JSON.parse(result.contents)).toEqual(result.bundle);
    expect(result.contents.endsWith("\n")).toBe(true);
  });

  it("selects the newest imported draft without mutating input order", () => {
    const first = draft("draft_first", "2026-09-03T10:00:00.000Z");
    const latest = draft("draft_latest", "2026-09-03T12:00:00.000Z");
    const middle = draft("draft_middle", "2026-09-03T11:00:00.000Z");
    const drafts = [first, latest, middle] as const;

    expect(selectLatestWizardDraft(drafts)).toBe(latest);
    expect(drafts).toEqual([first, latest, middle]);
    expect(selectLatestWizardDraft([])).toBeNull();
    expect(createWorkspaceBundleId("2026-09-03T00:00:00.000Z")).toMatch(/^[a-z0-9][a-z0-9_]*$/);
  });
});
