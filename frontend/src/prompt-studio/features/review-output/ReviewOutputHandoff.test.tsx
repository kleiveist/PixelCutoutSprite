import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PromptGeneratorRoot } from "../../app";
import { parseWizardDraft, type ProfileLibrary, type WizardDraft } from "../../schemas";
import { createV2StorageAdapter, type OutputWorkspaceAdapter } from "../../services";
import { MemoryStorage } from "../../test/memoryStorage";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import { createWizardDraftFromAssetProfile } from "../wizard";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

function createReviewDraft(library: ProfileLibrary): SelectedWizardDraft {
  const assetProfile = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  if (!assetProfile) throw new Error("Expected the smith Asset fixture.");
  const baseProfile = library.baseProfiles.find(
    (profile) => profile.id === assetProfile.baseProfileId,
  );
  const categoryProfile = library.categoryProfiles.find(
    (profile) => profile.id === assetProfile.categoryProfileId,
  );
  const result = createWizardDraftFromAssetProfile({
    draftId: parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_output_handoff",
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    }).draftId,
    savedAt: PROFILE_FIXTURE_TIMESTAMP,
    assetProfile,
    ...(baseProfile ? { baseProfile } : {}),
    ...(categoryProfile ? { categoryProfile } : {}),
  });
  if (result.status !== "created" || !("category" in result.draft)) {
    throw new Error("Expected a selected review draft.");
  }
  return result.draft;
}

function setupWorkspace(
  handoffAvailability:
    Readonly<{ available: true }> | Readonly<{ available: false; reason: string }>,
  onHandoff = vi.fn(async () => undefined),
) {
  const library = createProfileLibraryFixture();
  const storageAdapter = createV2StorageAdapter(new MemoryStorage());
  expect(storageAdapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  expect(storageAdapter.writeDraft(createReviewDraft(library))).toEqual({ status: "ok" });
  const outputAdapter: OutputWorkspaceAdapter = {
    copyText: vi.fn(async () => undefined),
    downloadTextFile: vi.fn(async () => undefined),
  };

  render(
    <PromptGeneratorRoot
      view="output"
      onNavigate={() => undefined}
      storageAdapter={storageAdapter}
      outputAdapter={outputAdapter}
      handoffAvailability={handoffAvailability}
      onHandoff={onHandoff}
    />,
  );
  return { onHandoff, outputAdapter };
}

describe("review output Cutout handoff", () => {
  it("keeps copy/export available but disables handoff without a writable area", async () => {
    setupWorkspace({
      available: false,
      reason: "Öffne zuerst einen Vault und wähle eine Area aus.",
    });

    expect(await screen.findByRole("button", { name: "Kopieren" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "MD exportieren" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "JSON exportieren" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "In PixelCutoutSprite übernehmen" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "In PixelCutoutSprite übernehmen" })).toHaveAttribute(
      "title",
      "Öffne zuerst einen Vault und wähle eine Area aus.",
    );
  });

  it("hands a versioned prompt DTO to the host", async () => {
    const { onHandoff } = setupWorkspace({ available: true });

    fireEvent.click(await screen.findByRole("button", { name: "In PixelCutoutSprite übernehmen" }));

    await waitFor(() => expect(onHandoff).toHaveBeenCalledOnce());
    expect(onHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: 1,
        category: "character",
        prompt: expect.any(String),
        negativePrompt: expect.any(String),
        technicalPrompt: expect.any(String),
        profileReferences: expect.arrayContaining(["asset_smith_80"]),
        createdAt: expect.any(String),
      }),
    );
  });
});
