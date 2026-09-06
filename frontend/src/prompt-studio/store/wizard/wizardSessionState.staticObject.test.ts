import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("static-object Wizard raw session state", () => {
  it("keeps every invalid visible value while the last valid Draft remains unchanged", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_static_object_raw",
      projectName: "Kartentruhe",
      route: "wizard/editor",
      currentStep: "staticObjectDetails",
      baseProfileId: "base_world_80",
      category: "staticObject",
      subtype: "chest",
      answers: {
        objectClass: "container",
        purpose: "interactive",
        primaryMaterial: "wood",
        footprint: { widthTiles: 2, depthTiles: 1 },
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
      projectName: "Kartentruhe",
      category: "staticObject",
      subtype: "chest",
      baseProfileId: "base_world_80",
      staticObjectClass: "furniture",
      staticObjectPurpose: "interactive",
      staticObjectBasicShape: "boxy",
      staticObjectProportion: "compact",
      staticObjectSymmetry: "bilateral",
      staticObjectDescription: "Sichtbarer ungültiger Zwischenstand",
      staticObjectPrimaryMaterial: "wood",
      staticObjectSecondaryMaterial: "metal",
      staticObjectMaterialDetails: "Eiche und dunkles Eisen",
      staticObjectCondition: "weathered",
      staticObjectDetailElements: "Schloss und Griffe",
      staticObjectContents: "Karten und Münzen",
      staticObjectInteraction: "open",
      staticObjectFootprintWidthTiles: 3,
      staticObjectFootprintDepthTiles: undefined,
      staticObjectShadowMode: "contact",
      staticObjectVariantCount: 12,
      staticObjectExtraDetails: "Bleibt bis zur Korrektur im Formular.",
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
      throw new Error("Expected the selected static-object Draft to remain active.");
    }
    expect(captured.activeDraft.answers).toEqual({
      objectClass: "container",
      purpose: "interactive",
      primaryMaterial: "wood",
      footprint: { widthTiles: 2, depthTiles: 1 },
      animationType: "openClose",
    });
    expect(captured.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
