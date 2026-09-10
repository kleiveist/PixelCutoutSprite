import { describe, expect, it } from "vitest";

import {
  CutoutProjectEnvelopeSchema,
  GlobalSettingsSchema,
  SpritePartsEnvelopeSchema,
  SpriteSceneEnvelopeSchema,
  VaultBaseProfileSchema,
  VaultPromptDraftSchema,
  VaultPromptProfileEnvelopeSchema,
} from "./v3Contracts.schema";

const now = "2026-09-09T12:00:00.000Z";
const hash = "a".repeat(64);
const requiredParts = [
  "head",
  "torso",
  "pelvis",
  "upper_arm_l",
  "forearm_l",
  "hand_l",
  "upper_arm_r",
  "forearm_r",
  "hand_r",
  "thigh_r",
  "shin_r",
  "foot_r",
  "thigh_l",
  "shin_l",
  "foot_l",
] as const;

const base = {
  schemaVersion: 3,
  kind: "vaultBaseProfile",
  id: "base_fixture",
  revision: 1,
  name: "Basis",
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
  createdAt: now,
  updatedAt: now,
} as const;

describe("PixelStudio V3 contract envelopes", () => {
  it("accepts a complete singleton base and rejects future or corrupt envelopes", () => {
    expect(VaultBaseProfileSchema.safeParse(base).success).toBe(true);
    expect(VaultBaseProfileSchema.safeParse({ ...base, schemaVersion: 4 }).success).toBe(false);
    expect(VaultBaseProfileSchema.safeParse({ ...base, revision: 0 }).success).toBe(false);
    expect(VaultBaseProfileSchema.safeParse({ ...base, answers: {} }).success).toBe(false);
  });

  it("keeps partial draft data separate from ready profiles", () => {
    const draft = {
      schemaVersion: 3,
      kind: "vaultPromptDraft",
      draftId: "draft_fixture",
      profileId: null,
      revision: 1,
      identity: { name: "", category: null, subtype: null },
      rawValues: { unfinished: true },
      wizard: { currentStepId: "identity", completedStepIds: [] },
      createdAt: now,
      updatedAt: now,
    };
    expect(VaultPromptDraftSchema.safeParse(draft).success).toBe(true);

    const profile = {
      schemaVersion: 3,
      kind: "vaultPromptProfile",
      id: "profile_fixture",
      revision: 1,
      draftRevision: 1,
      name: "Kleif",
      folderName: "Kleif",
      category: "character",
      subtype: "hero",
      baseProfileId: null,
      catalogVersion: "v3.0",
      status: "ready",
      answers: {},
      wizard: { currentStepId: "review", completedStepIds: ["identity"] },
      outputSelection: { styles: ["classic"], languages: ["de"] },
      outputs: { status: "none", generatedFrom: null, files: [] },
      createdAt: now,
      updatedAt: now,
    };
    expect(VaultPromptProfileEnvelopeSchema.safeParse(profile).success).toBe(false);
    expect(
      VaultPromptProfileEnvelopeSchema.safeParse({ ...profile, status: "incomplete" }).success,
    ).toBe(true);
  });

  it("validates independent masks and the fixed 15-part register", () => {
    const parts = requiredParts.map((partId) => ({
      partId,
      status: "unmarked",
      maskRevision: 0,
      maskPath: null,
      maskSha256: null,
    }));
    const project = {
      schemaVersion: 1,
      kind: "cutoutProject",
      id: "cutout_fixture",
      revision: 1,
      source: {
        snapshotPath: ".source/original.png",
        sha256: hash,
        width: 96,
        height: 128,
      },
      activePartId: "head",
      parts,
      createdAt: now,
      updatedAt: now,
    };
    expect(CutoutProjectEnvelopeSchema.safeParse(project).success).toBe(true);
    expect(
      CutoutProjectEnvelopeSchema.safeParse({ ...project, parts: parts.slice(1) }).success,
    ).toBe(false);
  });

  it("enforces reconstruction coordinates and scene generation references", () => {
    const manifest = {
      schemaVersion: 1,
      kind: "spriteParts",
      setId: "set_fixture",
      generationId: "generation_fixture",
      cutoutRevision: 1,
      source: {
        snapshotPath: ".source/original.png",
        sha256: hash,
        width: 96,
        height: 128,
      },
      complete: false,
      parts: [
        {
          partId: "head",
          file: "01_head.png",
          sha256: hash,
          sourceRect: { x: 8, y: 4, width: 16, height: 20 },
          pivot: { x: 8, y: 16 },
          defaultPosition: { x: 16, y: 20 },
          defaultZ: 10,
          parentId: null,
        },
      ],
      omittedParts: requiredParts.slice(1).map((partId) => ({ partId, reason: "fixture" })),
      createdAt: now,
    };
    expect(SpritePartsEnvelopeSchema.safeParse(manifest).success).toBe(true);
    expect(
      SpritePartsEnvelopeSchema.safeParse({
        ...manifest,
        parts: [{ ...manifest.parts[0], file: "Bilder/Kleif/01_head.png" }],
      }).success,
    ).toBe(false);
    expect(
      SpritePartsEnvelopeSchema.safeParse({
        ...manifest,
        parts: [{ ...manifest.parts[0], defaultPosition: { x: 8, y: 16 } }],
      }).success,
    ).toBe(false);

    expect(
      SpriteSceneEnvelopeSchema.safeParse({
        schemaVersion: 1,
        kind: "spriteScene",
        id: "scene_fixture",
        revision: 1,
        setId: manifest.setId,
        generationId: manifest.generationId,
        blendMode: "source-over",
        pixelSnap: true,
        layers: [
          {
            partId: "head",
            position: { x: 16, y: 20 },
            pivot: { x: 8, y: 16 },
            rotationDeg: 0,
            scale: { x: 1, y: 1 },
            zIndex: 10,
            visible: true,
            locked: false,
          },
        ],
        createdAt: now,
        updatedAt: now,
      }).success,
    ).toBe(true);
  });

  it("limits global settings to UI-only values", () => {
    const settings = {
      schemaVersion: 1,
      kind: "globalSettings",
      theme: "dark",
      uiLanguage: "de",
      density: "compact",
    };
    expect(GlobalSettingsSchema.safeParse(settings).success).toBe(true);
    expect(
      GlobalSettingsSchema.safeParse({ ...settings, activeBaseProfileId: "base_fixture" }).success,
    ).toBe(false);
  });
});
