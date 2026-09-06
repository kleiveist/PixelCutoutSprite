import { describe, expect, it } from "vitest";
import { StableIdSchema, parseWizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardDraftsStructurallyEqual,
  wizardSessionReducer,
} from "./index";

describe("wizard start session", () => {
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_blacksmith_001",
    projectName: "Dorfschmied",
    route: "wizard/project",
    currentStep: "project",
    validation: { errors: [], warnings: [] },
    savedAt: "2026-09-02T12:00:00.000Z",
  });
  const editedDraft = parseWizardDraft({
    ...draft,
    projectName: "Dorfschmied überarbeitet",
    savedAt: "2026-09-02T12:05:00.000Z",
  });
  const selectedProfileDraft = parseWizardDraft({
    ...draft,
    route: "wizard/profile",
    category: "character",
    subtype: "npc",
    answers: {},
  });

  it("keeps a selected category without inventing a subtype", () => {
    expect(
      wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
        type: "startRequested",
        intent: { kind: "newAsset", category: "texture" },
      }),
    ).toEqual({
      startIntent: { kind: "newAsset", category: "texture" },
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 1,
    });
  });

  it("clears a stale category for a generic new-asset start", () => {
    const selected = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "startRequested",
      intent: { kind: "newAsset", category: "character" },
    });

    expect(
      wizardSessionReducer(selected, {
        type: "startRequested",
        intent: { kind: "newAsset", category: null },
      }),
    ).toEqual({
      startIntent: { kind: "newAsset", category: null },
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 2,
    });
  });

  it("carries only validated profile and draft identifiers", () => {
    const profileId = StableIdSchema.parse("asset_blacksmith_001");
    const draftId = StableIdSchema.parse("draft_blacksmith_001");
    const profileStart = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "startRequested",
      intent: { kind: "profile", assetProfileId: profileId },
    });
    const resumed = wizardSessionReducer(profileStart, {
      type: "startRequested",
      intent: { kind: "resume", draftId },
    });

    expect(profileStart).toEqual({
      startIntent: { kind: "profile", assetProfileId: profileId },
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 1,
    });
    expect(resumed).toEqual({
      startIntent: { kind: "resume", draftId },
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 2,
    });
  });

  it("increments every requested session and clears the active draft", () => {
    const activated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-transient",
    });
    const intent = { kind: "newAsset", category: "texture" } as const;
    const firstRequest = wizardSessionReducer(activated, {
      type: "startRequested",
      intent,
    });
    const repeatedRequest = wizardSessionReducer(firstRequest, {
      type: "startRequested",
      intent,
    });

    expect(firstRequest).toEqual({
      startIntent: intent,
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 1,
    });
    expect(repeatedRequest).toEqual({
      startIntent: intent,
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 2,
    });
  });

  it("hydrates a persisted draft without changing the session revision", () => {
    const requested = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "startRequested",
      intent: { kind: "resume", draftId: draft.draftId },
    });
    const activated = wizardSessionReducer(requested, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });

    expect(activated).toEqual({
      startIntent: { kind: "resume", draftId: draft.draftId },
      activeDraft: draft,
      baselineDraft: draft,
      draftPersisted: true,
      rawCoreFormValues: null,
      sessionRevision: 1,
    });
    expect(selectWizardSessionDirty(activated)).toBe(false);
  });

  it("derives dirty state structurally across edit, failed-save, revert, and save", () => {
    const equivalentDraft = parseWizardDraft(JSON.parse(JSON.stringify(draft)) as unknown);
    expect(equivalentDraft).not.toBe(draft);
    expect(wizardDraftsStructurallyEqual(equivalentDraft, draft)).toBe(true);

    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const edited = wizardSessionReducer(hydrated, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "edit",
    });

    expect(selectWizardSessionDirty(edited)).toBe(true);
    expect(edited.baselineDraft).toBe(draft);
    expect(edited.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty({ ...edited })).toBe(true);

    const reverted = wizardSessionReducer(edited, {
      type: "draftActivated",
      draft: equivalentDraft,
      mode: "edit",
    });
    expect(selectWizardSessionDirty(reverted)).toBe(false);
    expect(reverted.draftPersisted).toBe(true);

    const saved = wizardSessionReducer(edited, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "saved",
    });
    expect(saved.baselineDraft).toBe(editedDraft);
    expect(saved.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(saved)).toBe(false);
  });

  it("distinguishes a clean transient hydration from a persisted draft", () => {
    const transient = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-transient",
    });
    const edited = wizardSessionReducer(transient, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "edit",
    });

    expect(selectWizardSessionDirty(transient)).toBe(false);
    expect(transient.draftPersisted).toBe(false);
    expect(selectWizardSessionDirty(edited)).toBe(true);
    expect(edited.draftPersisted).toBe(false);
  });

  it.each([
    ["an empty selected-profile name", ""],
    ["a project name beyond the schema limit", "x".repeat(121)],
  ])("keeps %s as a dirty raw form snapshot", (_label, projectName) => {
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft: selectedProfileDraft,
      mode: "hydrate-persisted",
    });

    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: { projectName },
    });

    expect(captured.activeDraft).toBe(selectedProfileDraft);
    expect(captured.baselineDraft).toBe(selectedProfileDraft);
    expect(captured.draftPersisted).toBe(true);
    expect(captured.rawCoreFormValues).toEqual({ projectName });
    expect(selectWizardSessionDirty(captured)).toBe(true);
  });

  it("clears raw form values on valid activation, save, and a new start", () => {
    const hydrated = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const captured = wizardSessionReducer(hydrated, {
      type: "rawCoreFormValuesCaptured",
      values: { projectName: "x".repeat(121) },
    });
    const activated = wizardSessionReducer(captured, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "edit",
    });

    expect(activated.rawCoreFormValues).toBeNull();

    const capturedBeforeSave = wizardSessionReducer(activated, {
      type: "rawCoreFormValuesCaptured",
      values: { projectName: "" },
    });
    const saved = wizardSessionReducer(capturedBeforeSave, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "saved",
    });

    expect(saved.rawCoreFormValues).toBeNull();

    const recaptured = wizardSessionReducer(saved, {
      type: "rawCoreFormValuesCaptured",
      values: { projectName: "" },
    });
    const restarted = wizardSessionReducer(recaptured, {
      type: "startRequested",
      intent: { kind: "newAsset", category: null },
    });

    expect(restarted.rawCoreFormValues).toBeNull();
    expect(selectWizardSessionDirty(restarted)).toBe(false);
  });

  it("clears only a matching pending profile request", () => {
    const profileId = StableIdSchema.parse("asset_blacksmith_001");
    const requested = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "startRequested",
      intent: { kind: "profile", assetProfileId: profileId },
    });

    expect(
      wizardSessionReducer(requested, {
        type: "profileRequestCleared",
        assetProfileId: StableIdSchema.parse("asset_other"),
      }),
    ).toBe(requested);
    expect(
      wizardSessionReducer(requested, {
        type: "profileRequestCleared",
        assetProfileId: profileId,
      }),
    ).toEqual({
      startIntent: null,
      activeDraft: null,
      baselineDraft: null,
      draftPersisted: false,
      rawCoreFormValues: null,
      sessionRevision: 1,
    });
  });

  it("clears a matching profile request without discarding its active dirty draft", () => {
    const profileId = StableIdSchema.parse("asset_blacksmith_001");
    const requested = wizardSessionReducer(INITIAL_WIZARD_SESSION_STATE, {
      type: "startRequested",
      intent: { kind: "profile", assetProfileId: profileId },
    });
    const hydrated = wizardSessionReducer(requested, {
      type: "draftActivated",
      draft,
      mode: "hydrate-persisted",
    });
    const dirty = wizardSessionReducer(hydrated, {
      type: "draftActivated",
      draft: editedDraft,
      mode: "edit",
    });

    const cleared = wizardSessionReducer(dirty, {
      type: "profileRequestCleared",
      assetProfileId: profileId,
    });

    expect(cleared).toEqual({
      ...dirty,
      startIntent: null,
    });
    expect(cleared.activeDraft).toBe(editedDraft);
    expect(cleared.baselineDraft).toBe(draft);
    expect(cleared.draftPersisted).toBe(true);
    expect(selectWizardSessionDirty(cleared)).toBe(true);
  });
});
