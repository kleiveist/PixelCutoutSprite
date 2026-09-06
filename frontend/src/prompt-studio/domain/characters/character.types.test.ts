import { describe, expect, it } from "vitest";
import {
  CHARACTER_AGE_IDS,
  CHARACTER_ANIMATION_ACTION_IDS,
  CHARACTER_BODY_BUILD_IDS,
  CHARACTER_CONDITION_IDS,
  CHARACTER_EXPRESSION_IDS,
  CHARACTER_EYE_VISIBILITY_IDS,
  CHARACTER_GENDER_PRESENTATION_IDS,
  CHARACTER_HEADWEAR_CONDITION_IDS,
  CHARACTER_PALETTE_SOURCE_IDS,
  CHARACTER_POSTURE_IDS,
  CHARACTER_RELATIVE_HEIGHT_IDS,
  CHARACTER_WEALTH_IDS,
  DEFAULT_CHARACTER_ANIMATION_FRAMES,
  NON_HUMANOID_CHARACTER_SUBTYPES,
  NPC_CONTEXT_CHARACTER_SUBTYPES,
  isHumanoidCharacterSubtype,
  isNpcContextSubtype,
} from "./index";

describe("character taxonomy", () => {
  it("publishes immutable canonical value catalogs", () => {
    const catalogs = [
      CHARACTER_GENDER_PRESENTATION_IDS,
      CHARACTER_AGE_IDS,
      CHARACTER_RELATIVE_HEIGHT_IDS,
      CHARACTER_BODY_BUILD_IDS,
      CHARACTER_POSTURE_IDS,
      CHARACTER_EYE_VISIBILITY_IDS,
      CHARACTER_HEADWEAR_CONDITION_IDS,
      CHARACTER_CONDITION_IDS,
      CHARACTER_EXPRESSION_IDS,
      CHARACTER_PALETTE_SOURCE_IDS,
      CHARACTER_WEALTH_IDS,
      CHARACTER_ANIMATION_ACTION_IDS,
      NPC_CONTEXT_CHARACTER_SUBTYPES,
      NON_HUMANOID_CHARACTER_SUBTYPES,
    ];

    expect(catalogs.every(Object.isFrozen)).toBe(true);
    expect(CHARACTER_ANIMATION_ACTION_IDS).toEqual([
      "idle",
      "walk",
      "run",
      "attack",
      "use",
      "talk",
      "interact",
      "hurt",
      "special",
    ]);
    expect(DEFAULT_CHARACTER_ANIMATION_FRAMES.walk).toBe(5);
    expect(
      CHARACTER_ANIMATION_ACTION_IDS.every(
        (action) => DEFAULT_CHARACTER_ANIMATION_FRAMES[action] >= 1,
      ),
    ).toBe(true);
    expect(Object.isFrozen(DEFAULT_CHARACTER_ANIMATION_FRAMES)).toBe(true);
  });

  it("identifies NPC-context and non-humanoid character subtypes centrally", () => {
    expect(isNpcContextSubtype("npc")).toBe(true);
    expect(isNpcContextSubtype("artisan")).toBe(true);
    expect(isNpcContextSubtype("hero")).toBe(false);
    expect(isNpcContextSubtype("animal")).toBe(false);

    expect(isHumanoidCharacterSubtype("hero")).toBe(true);
    expect(isHumanoidCharacterSubtype("npc")).toBe(true);
    expect(isHumanoidCharacterSubtype("animal")).toBe(false);
    expect(isHumanoidCharacterSubtype("creature")).toBe(false);
  });
});
