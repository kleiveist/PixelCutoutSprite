import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import { resolveWizardCoreStep } from "./wizardLifecycle";

describe("Artwork Wizard lifecycle", () => {
  it("resumes a persisted Artwork directly at its free-composition editor", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_artwork_resume",
      projectName: "Sturmobservatorium",
      route: "wizard/editor",
      currentStep: "artworkDetails",
      baseProfileId: "base_world_80",
      category: "artwork",
      subtype: "environmentConcept",
      answers: {
        motif: "environment",
        composition: "scene",
        lightingDrama: "gloomy",
      },
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T13:00:00.000Z",
    });

    expect(resolveWizardCoreStep(draft)).toEqual({
      stepId: "artworkDetails",
      usedFallback: false,
    });
  });

  it("rejects impossible Artwork direction and animation steps on resume", () => {
    for (const currentStep of ["directions", "animation"] as const) {
      const draft = parseWizardDraft({
        schemaVersion: 2,
        kind: "wizardDraft",
        draftId: `draft_artwork_${currentStep}`,
        projectName: "Sturmobservatorium",
        route: "wizard/editor",
        currentStep,
        baseProfileId: "base_world_80",
        category: "artwork",
        subtype: "environmentConcept",
        answers: {},
        validation: { errors: [], warnings: [] },
        savedAt: "2026-09-03T13:00:00.000Z",
      });

      expect(resolveWizardCoreStep(draft)).toMatchObject({
        stepId: "baseProfile",
        usedFallback: true,
        unknownStep: currentStep,
      });
    }
  });
});
