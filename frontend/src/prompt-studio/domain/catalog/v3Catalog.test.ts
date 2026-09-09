import { describe, expect, it } from "vitest";

import { ASSET_CATEGORY_IDS, ASSET_SUBTYPES } from "../assets";
import { WizardCoreFormSchema } from "../../features/wizard/wizardSteps";
import {
  REQUIRED_V3_SUBTYPES,
  V3_TYPE_CATALOG,
  WIZARD_FIELD_PAGE_MAP,
  profileDocumentPath,
  reserveProfileFolderName,
  validateProfileFolderName,
} from ".";

describe("V3 catalogs and P28 inventory", () => {
  it("keeps all nine categories, every old subtype, and every required example", () => {
    expect(V3_TYPE_CATALOG.map((entry) => entry.id)).toEqual(ASSET_CATEGORY_IDS);
    for (const category of ASSET_CATEGORY_IDS) {
      expect(V3_TYPE_CATALOG.find((entry) => entry.id === category)?.subtypes).toEqual(
        ASSET_SUBTYPES[category],
      );
      expect(ASSET_SUBTYPES[category]).toEqual(
        expect.arrayContaining([...REQUIRED_V3_SUBTYPES[category]]),
      );
    }
  });

  it("maps every existing wizard field to a stable page", () => {
    expect(Object.keys(WIZARD_FIELD_PAGE_MAP).sort()).toEqual(
      Object.keys(WizardCoreFormSchema.shape).sort(),
    );
    expect(Object.values(WIZARD_FIELD_PAGE_MAP)).not.toContain(undefined);
  });

  it("derives the normative folder and reserves case-insensitive collisions", () => {
    expect(profileDocumentPath("character", "hero", "Kleif")).toBe(
      ".PixelPrompt/Charakter/Held/Kleif/Kleif-profile.json",
    );
    expect(reserveProfileFolderName("Kleif", "profile_abcdef12", ["kleif"])).toBe(
      "Kleif--profilea",
    );
    expect(() => validateProfileFolderName("CON.json")).toThrow(/nicht zulässig/);
    expect(() => validateProfileFolderName("../Kleif")).toThrow(/nicht zulässig/);
  });
});
