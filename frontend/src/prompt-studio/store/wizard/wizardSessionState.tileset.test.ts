import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardRawCoreFormValues,
} from "./wizardSessionState";

describe("Tileset Wizard raw session state", () => {
  it("keeps invalid visible Atlas values while the last valid Draft remains unchanged", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_tileset_raw",
      projectName: "Wiesen-Autotile",
      route: "wizard/editor",
      currentStep: "tilesetDetails",
      baseProfileId: "base_world_80",
      category: "tileset",
      subtype: "autotile",
      answers: {
        tilesetType: "autotile",
        edgeSet: "cardinalAndDiagonal",
        cornerSet: "innerAndOuter",
        transitionMode: "bidirectional",
        tileableAxes: "both",
        atlasLayout: "fixedColumns",
        atlasTileCount: 47,
        atlasColumns: 8,
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
      projectName: "Wiesen-Autotile",
      category: "tileset",
      subtype: "autotile",
      baseProfileId: "base_world_80",
      tileSize: 32,
      pixelDensity: "modernHd",
      tilesetType: "edge",
      tilesetUsage: "transition",
      tilesetDescription: "Sichtbarer ungültiger Zwischenstand",
      tilesetEdgeSet: "cardinalAndDiagonal",
      tilesetEdgeDetails: "Acht Nachbarschaftszustände",
      tilesetCornerSet: "innerAndOuter",
      tilesetTransitionMode: "bidirectional",
      tilesetSourceMaterial: "Gras",
      tilesetTargetMaterial: "Erde",
      tilesetSeamMode: "matchedEdges",
      tilesetSeamDetails: "Gegenkanten bleiben identisch",
      tileableAxes: "both",
      tilesetRepeatMode: "nonRepeating",
      tilesetVariantCount: 6,
      tilesetVariantKinds: ["clean", "damaged"],
      tilesetAtlasLayout: "fixedColumns",
      tilesetAtlasTileCount: 47,
      tilesetAtlasColumns: undefined,
      tilesetAtlasGutterPixels: 1,
      tilesetAtlasMarginPixels: 2,
      tilesetExtraDetails: "Bleibt bis zur Korrektur im Formular.",
    };

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: rawValues,
    });

    expect(captured.rawCoreFormValues).toEqual(rawValues);
    expect(captured.activeDraft).toBe(draft);
    expect(captured.baselineDraft).toBe(draft);
    if (captured.activeDraft === null || !("category" in captured.activeDraft)) {
      throw new Error("Expected the selected Tileset Draft to remain active.");
    }
    expect(captured.activeDraft.answers).toEqual({
      tilesetType: "autotile",
      edgeSet: "cardinalAndDiagonal",
      cornerSet: "innerAndOuter",
      transitionMode: "bidirectional",
      tileableAxes: "both",
      atlasLayout: "fixedColumns",
      atlasTileCount: 47,
      atlasColumns: 8,
    });
    expect(captured.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });
});
