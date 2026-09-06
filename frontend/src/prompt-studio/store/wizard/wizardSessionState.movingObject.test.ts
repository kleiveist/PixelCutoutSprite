import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./index";

const movingObjectDraft = parseWizardDraft({
  schemaVersion: 2,
  kind: "wizardDraft",
  draftId: "draft_raw_floating_crystal",
  projectName: "Pulsierender Kristall",
  route: "wizard/editor",
  currentStep: "animation",
  baseProfileId: "base_world_80",
  category: "movingObject",
  subtype: "floatingCrystal",
  answers: {
    objectClass: "floatingObject",
    movementType: "hover",
    footprint: { widthTiles: 1, depthTiles: 1 },
    animationSequences: [{ type: "pulse", frames: 4 }],
  },
  validation: { errors: [], warnings: [] },
  savedAt: "2026-09-04T10:00:00.000Z",
});

describe("moving-object Wizard raw snapshots", () => {
  it("keeps all transient moving-object fields while an invalid edit leaves the valid persisted Draft untouched", () => {
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft: movingObjectDraft,
      mode: "hydrate-persisted",
    });
    const rawValues = {
      projectName: "Pulsierender Kristall",
      category: "movingObject",
      subtype: "floatingCrystal",
      baseProfileId: "base_world_80",
      movingObjectClass: "floatingObject",
      movingObjectPurpose: "Magischer Wegweiser",
      movingObjectBasicShape: "Facettierter schmaler Kristall",
      movingObjectDescription: "Schwebt ruhig über seinem Anker.",
      movingObjectFootprintWidthTiles: 0,
      movingObjectFootprintDepthTiles: 1,
      movingObjectHeightPixels: 80,
      movingObjectAnchorMode: "footprintCenter",
      movementType: "hover",
      movingObjectMechanism: "magicDrive",
      movingObjectMaterial: "magic",
      movingObjectMaterialDetails: "Durchscheinendes violettes Kristallgitter",
      movingObjectCondition: "used",
      movingObjectLightingBehavior: "emissive",
      movingObjectShadowMode: "contact",
      movingObjectExtraDetails: "Keine Richtungsansichten erzeugen.",
      movingObjectAnimationFrames: { pulse: 17 },
    } as const satisfies WizardRawCoreFormValues;

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });

    expect(captured.activeDraft).toBe(movingObjectDraft);
    expect(captured.baselineDraft).toBe(movingObjectDraft);
    expect(captured.draftPersisted).toBe(true);
    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(selectWizardSessionDirty(captured)).toBe(true);
    expect(captured.activeDraft).toMatchObject({
      answers: {
        footprint: { widthTiles: 1, depthTiles: 1 },
        animationSequences: [{ type: "pulse", frames: 4 }],
      },
    });
  });
});
