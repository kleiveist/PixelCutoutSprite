import { describe, expect, it } from "vitest";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Artwork Wizard transient session state", () => {
  it("keeps every raw Artwork field while an invalid edit remains transient", () => {
    const rawValues = {
      projectName: "Sturmobservatorium",
      category: "artwork",
      subtype: "environmentConcept",
      artworkPurpose: "productionReference",
      artworkMotif: "environment",
      artworkDescription: "Altes Observatorium",
      artworkSceneDescription: "Forscherin im Sturm",
      artworkComposition: "scene",
      artworkCompositionDetails: "Drei räumliche Ebenen",
      artworkFormat: "landscape",
      artworkBackground: "complete",
      artworkBackgroundDetails: "Berge und Blitze",
      artworkFocus: "scale",
      artworkLightingDrama: "gloomy",
      artworkLightingDetails: "Kühles Umgebungslicht",
      artworkDetailLevel: "productionConcept",
      artworkExtraDetails: "Keine Schrift",
    } as const satisfies WizardRawCoreFormValues;

    const captured = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });
    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
