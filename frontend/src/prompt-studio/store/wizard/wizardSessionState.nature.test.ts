import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Nature Wizard raw session state", () => {
  it("keeps every invalid visible Nature value while the last valid Draft remains unchanged", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_nature_raw",
      projectName: "Windbaum",
      route: "wizard/editor",
      currentStep: "natureDetails",
      baseProfileId: "base_world_80",
      category: "nature",
      subtype: "tree",
      answers: {
        plantType: "tree",
        species: "Eiche",
        climate: "temperate",
        footprint: { widthTiles: 3, depthTiles: 2 },
        animationType: "wind",
      },
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-06T10:00:00.000Z",
    });
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const rawValues: WizardRawCoreFormValues = {
      projectName: "Windbaum",
      category: "nature",
      subtype: "tree",
      baseProfileId: "base_world_80",
      naturePlantType: "mushroom",
      natureSpecies: "Sichtbarer ungültiger Zwischenstand",
      natureDescription: "Der Rohzustand bleibt vollständig erhalten.",
      natureClimate: "snow",
      natureSeason: "winter",
      natureAge: "ancient",
      natureSilhouette: "gnarled",
      natureTrunkThickness: "massive",
      natureTrunkShape: "hollow",
      natureTrunkDetails: "Aufgerissene Rinde",
      natureCrownShape: "irregular",
      natureCrownDensity: "sparse",
      natureFoliageDetails: "Einzelne vereiste Blattgruppen",
      natureRootVisibility: "exposed",
      natureRootDetails: "Wurzeln brechen durch den Schnee",
      natureMossCoverage: "heavy",
      natureMushroomGrowth: "abundant",
      natureSnowCover: "heavy",
      natureVineGrowth: "entangled",
      natureFootprintWidthTiles: 4,
      natureFootprintDepthTiles: undefined,
      natureGrounding: "snowy",
      natureVariantCount: 12,
      natureExtraDetails: "Bleibt bis zur Korrektur im Formular.",
      animationType: "wind",
    };

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });

    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(captured.activeDraft).toBe(draft);
    expect(captured.baselineDraft).toBe(draft);
    if (captured.activeDraft === null || !("category" in captured.activeDraft)) {
      throw new Error("Expected the selected Nature Draft to remain active.");
    }
    expect(captured.activeDraft.answers).toEqual({
      plantType: "tree",
      species: "Eiche",
      climate: "temperate",
      footprint: { widthTiles: 3, depthTiles: 2 },
      animationType: "wind",
    });
    expect(captured.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
