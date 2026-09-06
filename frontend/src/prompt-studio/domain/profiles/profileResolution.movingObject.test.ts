import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../assets";
import {
  parseAssetProfile,
  parseCategoryProfile,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type MovingObjectAnswers,
} from "../../schemas";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { createCompatibilityKey, resolveProfile } from "./index";

const TIMESTAMP = "2026-09-04T10:00:00.000Z";

function baseFixture(): BaseProfile {
  const base = createProfileLibraryFixture().baseProfiles.find(
    (profile) => profile.id === "base_world_80",
  );
  if (!base) throw new Error("Expected the shared Base-profile fixture.");
  return base;
}

function cartCategory(base: BaseProfile, defaults: MovingObjectAnswers): CategoryProfile {
  return parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_atomic_cart",
    name: "Atomic cart defaults",
    baseProfileId: base.id,
    category: "movingObject",
    subtype: "cart",
    iconId: "moving-cart",
    capabilities: resolveCapabilities("movingObject", "cart"),
    overrides: {},
    defaults,
    tags: [],
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
}

function cartAsset(
  base: BaseProfile,
  category: CategoryProfile,
  answers: MovingObjectAnswers,
): AssetProfile {
  return parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_atomic_cart",
    name: "Atomic cart",
    baseProfileId: base.id,
    categoryProfileId: category.id,
    compatibilityKey: createCompatibilityKey(base.values, {
      category: "movingObject",
      subtype: "cart",
    }),
    category: "movingObject",
    subtype: "cart",
    iconId: "moving-cart",
    badgeIconIds: [],
    capabilities: resolveCapabilities("movingObject", "cart"),
    overrides: {},
    answers,
    tags: [],
    favorite: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
}

function resolvedAnswers(
  base: BaseProfile,
  category: CategoryProfile,
  asset: AssetProfile,
): MovingObjectAnswers {
  const result = resolveProfile({
    baseProfile: base,
    categoryProfile: category,
    assetProfile: asset,
  });
  expect(result.status).toBe("resolved");
  if (result.status !== "resolved" || result.profile.categoryData.category !== "movingObject") {
    throw new Error("Expected resolved moving-object answers.");
  }
  return result.profile.categoryData.answers;
}

describe("moving-object profile animation resolution", () => {
  it("lets an Asset-level legacy pair atomically replace inherited canonical sequences", () => {
    const base = baseFixture();
    const category = cartCategory(base, {
      purpose: "Inherited cargo cart",
      directionCount: 4,
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "move", frames: 6 },
      ],
    });
    const asset = cartAsset(base, category, {
      purpose: "Local messenger cart",
      directionCount: 8,
      animationType: "rotate",
      framesPerDirection: 3,
    });

    const answers = resolvedAnswers(base, category, asset);

    expect(answers).toMatchObject({
      purpose: "Local messenger cart",
      directionCount: 8,
      animationType: "rotate",
      framesPerDirection: 3,
    });
    expect(answers).not.toHaveProperty("animationSequences");
  });

  it("lets canonical Asset sequences atomically replace inherited and same-level legacy fields", () => {
    const base = baseFixture();
    const category = cartCategory(base, {
      purpose: "Inherited cargo cart",
      directionCount: 4,
      animationType: "move",
      framesPerDirection: 6,
    });
    const asset = cartAsset(base, category, {
      purpose: "Local messenger cart",
      directionCount: 8,
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "pulse", frames: 4 },
      ],
      animationType: "rotate",
      framesPerDirection: 9,
    });

    const answers = resolvedAnswers(base, category, asset);

    expect(answers).toMatchObject({
      purpose: "Local messenger cart",
      directionCount: 8,
      animationSequences: [
        { type: "idle", frames: 2 },
        { type: "pulse", frames: 4 },
      ],
    });
    expect(answers).not.toHaveProperty("animationType");
    expect(answers).not.toHaveProperty("framesPerDirection");
    expect(Object.isFrozen(answers)).toBe(true);
    expect(Object.isFrozen(answers.animationSequences)).toBe(true);
    expect(Object.isFrozen(answers.animationSequences?.[0])).toBe(true);
  });

  it("prefers canonical Category sequences when legacy fields coexist at that same level", () => {
    const base = baseFixture();
    const category = cartCategory(base, {
      purpose: "Inherited cargo cart",
      directionCount: 4,
      animationSequences: [{ type: "move", frames: 5 }],
      animationType: "idle",
      framesPerDirection: 2,
    });
    const asset = cartAsset(base, category, {
      purpose: "Local messenger cart",
    });

    const answers = resolvedAnswers(base, category, asset);

    expect(answers).toMatchObject({
      purpose: "Local messenger cart",
      directionCount: 4,
      animationSequences: [{ type: "move", frames: 5 }],
    });
    expect(answers).not.toHaveProperty("animationType");
    expect(answers).not.toHaveProperty("framesPerDirection");
  });
});
