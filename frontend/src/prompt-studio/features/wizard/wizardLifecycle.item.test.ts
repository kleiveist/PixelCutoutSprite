import { describe, expect, it } from "vitest";
import { parseWizardDraft } from "../../schemas";
import { resolveWizardCoreStep } from "./wizardLifecycle";

describe("Item Wizard lifecycle", () => {
  it("resumes a persisted Item directly at its category editor", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_item_resume",
      projectName: "Schmiedehammer",
      route: "wizard/editor",
      currentStep: "itemDetails",
      baseProfileId: "base_world_80",
      category: "item",
      subtype: "tool",
      answers: { itemClass: "tool", primaryMaterial: "metal" },
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T12:00:00.000Z",
    });

    expect(resolveWizardCoreStep(draft)).toEqual({
      stepId: "itemDetails",
      usedFallback: false,
    });
  });

  it("rejects an impossible Item direction step on resume", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_item_direction",
      projectName: "Schmiedehammer",
      route: "wizard/editor",
      currentStep: "directions",
      baseProfileId: "base_world_80",
      category: "item",
      subtype: "tool",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: "2026-09-03T12:00:00.000Z",
    });

    expect(resolveWizardCoreStep(draft)).toMatchObject({
      stepId: "baseProfile",
      usedFallback: true,
      unknownStep: "directions",
    });
  });
});
