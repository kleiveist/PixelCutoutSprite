import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Building Wizard raw session state", () => {
  it("keeps invalid visible architecture values while the last valid Draft remains unchanged", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_building_raw",
      projectName: "Nordtor",
      route: "wizard/editor",
      currentStep: "buildingDetails",
      baseProfileId: "base_world_80",
      category: "building",
      subtype: "gate",
      answers: {
        buildingType: "gate",
        purpose: "Bewachter Eingang",
        primaryMaterial: "stone",
        footprint: { widthTiles: 4, depthTiles: 2 },
        mappingMode: "modularSet",
        modular: true,
        animationType: "openClose",
      },
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-07T10:00:00.000Z",
    });
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const rawValues: WizardRawCoreFormValues = {
      projectName: "Nordtor",
      category: "building",
      subtype: "gate",
      baseProfileId: "base_world_80",
      buildingType: "residential",
      buildingPurpose: "Sichtbarer ungültiger Zwischenstand",
      buildingDescription: "Torbau im Umbau",
      buildingPlanShape: "rectangular",
      buildingSize: "large",
      buildingFootprintWidthTiles: 5,
      buildingFootprintDepthTiles: undefined,
      buildingHeightPixels: 192,
      buildingFloors: 2,
      buildingPrimaryMaterial: "stone",
      buildingSecondaryMaterial: "wood",
      buildingMaterialDetails: "Kalkstein und Eichenbohlen",
      buildingRoofShape: "gable",
      buildingRoofPitch: "steep",
      buildingRoofMaterial: "slate",
      buildingRoofCondition: "weathered",
      buildingRoofDetails: "Zwei kleine Giebel",
      buildingFacadeStyle: "fortified",
      buildingFacadeDetails: "Zinnen und Pfeiler",
      buildingDoorCount: 1,
      buildingDoorType: "reinforced",
      buildingDoorPosition: "Zentral",
      buildingDoorState: "closed",
      buildingWindowCount: 4,
      buildingWindowShape: "narrowSlit",
      buildingWindowLighting: "warmLit",
      buildingWindowDetails: "Paarweise",
      buildingCondition: "weathered",
      buildingOccupancy: "active",
      buildingEnvironment: "city",
      buildingMappingMode: "modularSet",
      buildingCollisionMode: "walkableEntrance",
      buildingModular: true,
      buildingLighting: "visibleSources",
      buildingLightSourceDetails: "Laternen am Durchgang",
      buildingExtraDetails: "Bleibt bis zur Korrektur im Formular.",
      animationType: "openClose",
    };

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });

    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(captured.activeDraft).toBe(draft);
    expect(captured.baselineDraft).toBe(draft);
    if (captured.activeDraft === null || !("category" in captured.activeDraft)) {
      throw new Error("Expected the selected Building Draft to remain active.");
    }
    expect(captured.activeDraft.answers).toEqual({
      buildingType: "gate",
      purpose: "Bewachter Eingang",
      primaryMaterial: "stone",
      footprint: { widthTiles: 4, depthTiles: 2 },
      mappingMode: "modularSet",
      modular: true,
      animationType: "openClose",
    });
    expect(captured.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
