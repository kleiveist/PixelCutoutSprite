import { describe, expect, it } from "vitest";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Item Wizard transient session state", () => {
  it("keeps every raw Item field while an invalid edit remains transient", () => {
    const rawValues = {
      projectName: "Schmiedehammer",
      category: "item",
      subtype: "tool",
      itemClass: "tool",
      itemPurpose: "practical",
      itemPresentation: "equipped",
      itemWearPosition: "hand",
      itemIconSize: 7,
      itemSize: "medium",
      itemDescription: "Schwerer Hammer",
      itemPrimaryMaterial: "metal",
      itemSecondaryMaterial: "wood",
      itemMaterialDetails: "Stahl und Esche",
      itemCondition: "used",
      itemFunctionDetails: "Zum Schmieden",
      itemSignificance: "common",
      itemMeaningDetails: "Meisterzeichen",
      itemSilhouette: "Breiter Kopf",
      itemReadability: "silhouetteFirst",
      itemGlowMode: "none",
      itemShadowMode: "contact",
      itemVariantCount: 2,
      itemExtraDetails: "Zentriert",
    } as const satisfies WizardRawCoreFormValues;

    const captured = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });
    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
