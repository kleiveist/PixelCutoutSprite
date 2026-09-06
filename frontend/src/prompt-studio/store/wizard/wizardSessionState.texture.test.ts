import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Texture Wizard raw session state", () => {
  it("keeps every invalid visible Texture value transient while the last valid Draft remains unchanged", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_texture_raw",
      projectName: "Eichenplanken",
      route: "wizard/editor",
      currentStep: "textureDetails",
      baseProfileId: "base_world_80",
      category: "texture",
      subtype: "wood",
      answers: {
        materialType: "wood",
        usage: "floor",
        seamless: true,
        structure: "medium",
      },
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-05T10:00:00.000Z",
    });
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const rawValues: WizardRawCoreFormValues = {
      projectName: "Eichenplanken",
      category: "texture",
      subtype: "wood",
      baseProfileId: "base_world_80",
      textureMaterialType: "stone",
      textureUsage: "wall",
      textureDescription: "Sichtbarer ungültiger Zwischenstand",
      seamless: false,
      textureStructure: "coarse",
      textureCondition: "damaged",
      textureSurface: "jointed",
      textureMoisture: "wet",
      textureIcing: "iceCrusted",
      textureLighting: "worldAligned",
      textureOrientation: "vertical",
      textureExtraDetails: "Bleibt bis zur Korrektur im Formular erhalten.",
    };

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });

    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(captured.activeDraft).toBe(draft);
    expect(captured.baselineDraft).toBe(draft);
    if (captured.activeDraft === null || !("category" in captured.activeDraft)) {
      throw new Error("Expected the selected Texture Draft to remain active.");
    }
    expect(captured.activeDraft.answers).toEqual({
      materialType: "wood",
      usage: "floor",
      seamless: true,
      structure: "medium",
    });
    expect(captured.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
