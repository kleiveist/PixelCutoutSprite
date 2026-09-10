import { describe, expect, it } from "vitest";

import {
  VaultBaseProfileSchema,
  VaultPromptDraftSchema,
  parseWizardDraft,
  type VaultBaseProfile,
} from "../schemas";
import type { PromptVaultIndex } from "./vaultPromptRepository";
import {
  createVaultCompatibilityStorage,
  hydrateWizardVaultDocument,
  projectWizardToVault,
} from "./vaultWizardBridge";

const timestamp = "2026-09-09T12:00:00.000Z";
const base = VaultBaseProfileSchema.parse({
  schemaVersion: 3,
  kind: "vaultBaseProfile",
  id: "base_fixture",
  revision: 1,
  name: "Weltbasis",
  values: {
    pixelDensity: "classicHd",
    styleProfile: "both",
    tileSize: 32,
    characterHeight: 64,
    perspectiveType: "threeQuarter",
    cameraAngle: 45,
    cameraDirection: "southToNorth",
    projectionType: "orthographic",
    outlineStyle: "dark",
    paletteMode: "natural",
    backgroundMode: "transparent",
    alphaPadding: 2,
    nearestNeighbor: true,
    lightingDefaults: { policy: "adaptive", notes: "" },
  },
  locks: {},
  createdAt: timestamp,
  updatedAt: timestamp,
});

function index(value: VaultBaseProfile | null = base): PromptVaultIndex {
  return {
    baseProfile: value
      ? {
          relativePath: ".PixelPrompt/basisprofil.json",
          value,
          revision: value.revision,
          sha256: "a".repeat(64),
        }
      : null,
    profiles: [],
    drafts: [],
    issues: [],
  };
}

describe("vault wizard bridge", () => {
  it("journals incomplete identity with the lossless V2 draft embedded", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_incomplete",
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: timestamp,
    });

    const projected = projectWizardToVault(
      draft,
      { projectName: "Noch ohne Typ" },
      index(),
      () => timestamp,
    );

    expect(projected.kind).toBe("draft");
    if (projected.kind !== "draft") throw new Error("Expected a draft projection.");
    expect(projected.value.identity).toEqual({
      name: "Noch ohne Typ",
      category: null,
      subtype: null,
    });
    expect(projected.value.rawValues.legacyV2Draft).toEqual(draft);
  });

  it("promotes the valid last wizard step and hydrates it again from V3 files", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_oak_floor",
      projectName: "Eichenboden",
      route: "wizard/editor",
      currentStep: "textureDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "wood",
      answers: {
        materialType: "wood",
        usage: "floor",
        subjectDescription: "Alte Eichenplanken",
        seamless: true,
        structure: "medium",
      },
      validation: { errors: [], warnings: [] },
      savedAt: timestamp,
    });
    const raw = {
      projectName: "Eichenboden",
      category: "texture" as const,
      subtype: "wood" as const,
      baseProfileId: base.id,
      pixelDensity: "classicHd" as const,
      styleProfile: "both" as const,
      tileSize: 32,
      characterHeight: 64,
      perspectiveType: "threeQuarter" as const,
      cameraAngle: 45 as const,
      cameraDirection: "southToNorth" as const,
      projectionType: "orthographic" as const,
      outlineStyle: "dark" as const,
      paletteMode: "natural" as const,
      backgroundMode: "transparent" as const,
      alphaPadding: 2,
      nearestNeighbor: true,
      lightingPolicy: "adaptive" as const,
      lightingNotes: "",
      textureMaterialType: "wood" as const,
      textureUsage: "floor" as const,
      textureDescription: "Alte Eichenplanken",
      seamless: true,
      textureStructure: "medium" as const,
    };

    const projected = projectWizardToVault(draft, raw, index(), () => timestamp);

    expect(projected.kind).toBe("profile");
    if (projected.kind !== "profile") throw new Error("Expected a profile projection.");
    expect(projected.value.status).toBe("ready");
    expect(projected.value.outputSelection).toEqual({
      styles: ["classic", "dark"],
      languages: ["en", "de"],
    });

    // P43: a fresh editing-session ID must not create a same-name profile copy.
    const loadedIndex: PromptVaultIndex = {
      ...index(),
      profiles: [
        {
          value: projected.value,
          relativePath: ".PixelPrompt/Textur/Holz/Eichenboden/Eichenboden-profile.json",
          revision: projected.value.revision,
          sha256: "b".repeat(64),
        },
      ],
    };
    const working = hydrateWizardVaultDocument(projected.value, loadedIndex, {
      draftId: "draft_fresh_dashboard_session",
    });
    const edited = projectWizardToVault(
      working.draft,
      { ...working.rawValues, projectName: "Eichenboden geändert" },
      loadedIndex,
      () => timestamp,
    );
    expect(edited.kind).toBe("profile");
    if (edited.kind !== "profile") throw new Error("Expected an edited canonical profile");
    expect(edited.value.id).toBe(projected.value.id);
    expect(edited.value.name).toBe("Eichenboden geändert");

    const hydrated = createVaultCompatibilityStorage({
      ...index(),
      profiles: [
        {
          relativePath: ".PixelPrompt/Textur/Holz/Eichenboden/Eichenboden-profile.json",
          value: projected.value,
          revision: projected.value.revision,
          sha256: "b".repeat(64),
        },
      ],
    });
    expect(hydrated.readDraft()).toMatchObject({
      status: "valid",
      value: { draftId: "draft_oak_floor", projectName: "Eichenboden" },
    });
    expect(hydrated.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: { baseProfiles: [{ id: base.id }], assetProfiles: [{ id: draft.draftId }] },
    });
  });

  it("keeps a later invalid portable name in the draft journal without moving the profile", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_oak_floor",
      projectName: "Eichenboden",
      route: "wizard/editor",
      currentStep: "textureDetails",
      baseProfileId: base.id,
      category: "texture",
      subtype: "wood",
      answers: { materialType: "wood", usage: "floor", seamless: true },
      validation: { errors: [], warnings: [] },
      savedAt: timestamp,
    });
    const first = projectWizardToVault(
      draft,
      {
        projectName: "Eichenboden",
        category: "texture",
        subtype: "wood",
        baseProfileId: base.id,
      },
      index(),
      () => timestamp,
    );
    if (first.kind !== "profile") throw new Error("Expected a profile projection.");
    const current = {
      ...index(),
      profiles: [
        {
          relativePath: ".PixelPrompt/Textur/Holz/Eichenboden/Eichenboden-profile.json",
          value: first.value,
          revision: first.value.revision,
          sha256: "b".repeat(64),
        },
      ],
    };

    const invalid = projectWizardToVault(
      draft,
      {
        projectName: "CON",
        category: "texture",
        subtype: "wood",
        baseProfileId: base.id,
      },
      current,
      () => timestamp,
    );

    expect(invalid.kind).toBe("draft");
    if (invalid.kind !== "draft") throw new Error("Expected a draft projection.");
    expect(invalid.value.profileId).toBe(first.value.id);
    expect(invalid.value.rawValues.projectName).toBe("CON");
    expect(current.profiles[0]?.value.folderName).toBe("Eichenboden");
  });

  it("hydrates a native V3 draft without a legacy payload at the exact catalog page", () => {
    const vaultDraft = VaultPromptDraftSchema.parse({
      schemaVersion: 3,
      kind: "vaultPromptDraft",
      draftId: "draft_native_v3",
      profileId: null,
      revision: 4,
      identity: { name: "Unfertige Waldfigur", category: "character", subtype: "npc" },
      rawValues: {
        projectName: "Unfertige Waldfigur",
        category: "character",
        subtype: "npc",
        role: "halb beschriebene Hüterin",
        hair: "noch offen",
      },
      wizard: {
        currentStepId: "catalog/character/body",
        completedStepIds: ["identity", "catalog/character/identity"],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const vaultIndex: PromptVaultIndex = {
      ...index(),
      drafts: [
        {
          relativePath: ".PixelPrompt/.drafts/draft_native_v3.json",
          value: vaultDraft,
          revision: vaultDraft.revision,
          sha256: "c".repeat(64),
        },
      ],
    };

    const hydrated = hydrateWizardVaultDocument(vaultDraft, vaultIndex);

    expect(hydrated.migratedStep).toBe(false);
    expect(hydrated.draft).toMatchObject({
      currentStep: "catalog/character/body",
      catalogVersion: "v3.0",
      completedStepIds: ["identity", "catalog/character/identity"],
      category: "character",
      subtype: "npc",
      baseProfileId: base.id,
    });
    expect(hydrated.rawValues).toMatchObject({
      role: "halb beschriebene Hüterin",
      hair: "noch offen",
      baseProfileId: base.id,
    });
  });
});
