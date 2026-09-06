import { resolveCapabilities } from "../../domain/assets";
import {
  resolveProfile,
  type ProfileResolutionConflict,
  type ProfileResolutionNotice,
  type ProfileResolutionResult,
} from "../../domain/profiles";
import {
  WizardDraftSchema,
  parseAssetProfile,
  parseWizardDraft,
  type AssetProfile,
  type BaseProfile,
  type CategoryProfile,
  type ProfileLibrary,
  type StableId,
  type WizardDraft,
} from "../../schemas";
import {
  getWizardCoreFallbackStepId,
  getWizardCoreStep,
  isWizardCoreStepId,
  type WizardCoreStepId,
} from "./wizardSteps";

export interface CreateBlankWizardDraftInput {
  readonly draftId: StableId;
  readonly savedAt: string;
  readonly projectName?: string;
}

export function createBlankWizardDraft(input: CreateBlankWizardDraftInput): WizardDraft {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: input.draftId,
    projectName: input.projectName ?? "",
    route: "wizard/project",
    currentStep: "project",
    validation: { errors: [], warnings: [] },
    savedAt: input.savedAt,
  });
}

export interface CreateProfileWizardDraftInput {
  readonly draftId: StableId;
  readonly savedAt: string;
  readonly assetProfile: AssetProfile;
  readonly baseProfile?: BaseProfile;
  readonly categoryProfile?: CategoryProfile;
}

export type CreateProfileWizardDraftResult =
  | Readonly<{
      status: "created";
      draft: WizardDraft;
      notices: readonly ProfileResolutionNotice[];
    }>
  | Readonly<{
      status: "conflict";
      conflicts: readonly [ProfileResolutionConflict, ...ProfileResolutionConflict[]];
      notices: readonly ProfileResolutionNotice[];
    }>;

export function createWizardDraftFromAssetProfile(
  input: CreateProfileWizardDraftInput,
): CreateProfileWizardDraftResult {
  const resolution = resolveProfile({
    assetProfile: input.assetProfile,
    baseProfile: input.baseProfile,
    categoryProfile: input.categoryProfile,
  });

  if (resolution.status === "conflict") {
    return Object.freeze({
      status: "conflict",
      conflicts: resolution.conflicts,
      notices: resolution.notices,
    });
  }

  const profile = input.assetProfile;
  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: input.draftId,
    projectName: profile.name,
    route: "wizard/profile",
    currentStep: "category",
    baseProfileId: profile.baseProfileId,
    ...(profile.categoryProfileId === undefined
      ? {}
      : { categoryProfileId: profile.categoryProfileId }),
    sourceAssetProfileId: profile.id,
    overrides: profile.overrides,
    category: profile.category,
    subtype: profile.subtype,
    answers: profile.answers,
    validation: { errors: [], warnings: [] },
    savedAt: input.savedAt,
  });

  return Object.freeze({
    status: "created",
    draft,
    notices: resolution.notices,
  });
}

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

function selectedDraftCapabilities(draft: SelectedWizardDraft) {
  switch (draft.category) {
    case "character":
      return resolveCapabilities("character", draft.subtype);
    case "movingObject":
      return resolveCapabilities("movingObject", draft.subtype);
    case "staticObject":
      return resolveCapabilities("staticObject", draft.subtype);
    case "texture":
      return resolveCapabilities("texture", draft.subtype);
    case "nature":
      return resolveCapabilities("nature", draft.subtype);
    case "building":
      return resolveCapabilities("building", draft.subtype);
    case "tileset":
      return resolveCapabilities("tileset", draft.subtype);
    case "item":
      return resolveCapabilities("item", draft.subtype);
    case "artwork":
      return resolveCapabilities("artwork", draft.subtype);
  }
}

function selectedDraftAsAssetProfile(
  draft: SelectedWizardDraft,
  baseProfileId: StableId,
): AssetProfile {
  return parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: draft.draftId,
    name: draft.projectName,
    baseProfileId,
    ...(draft.categoryProfileId === undefined
      ? {}
      : { categoryProfileId: draft.categoryProfileId }),
    compatibilityKey: "wizard-draft-snapshot",
    iconId: "wizard-draft",
    badgeIconIds: [],
    capabilities: selectedDraftCapabilities(draft),
    overrides: draft.overrides ?? {},
    tags: [],
    favorite: false,
    category: draft.category,
    subtype: draft.subtype,
    answers: draft.answers,
    createdAt: draft.savedAt,
    updatedAt: draft.savedAt,
  });
}

/**
 * Resolves a selected Draft from its portable Base/Category references and
 * embedded answer/override snapshots. `sourceAssetProfileId` is provenance
 * only: a deleted or subsequently edited source Asset must not change the
 * resumed Draft configuration. A selected pre-Base Draft is valid wizard
 * progress but is not resolvable yet, so this function returns `null`.
 */
export function resolveWizardDraftSnapshot(
  draft: WizardDraft,
  profileLibrary: ProfileLibrary,
): ProfileResolutionResult | null {
  if (!("category" in draft)) return null;
  if (draft.baseProfileId === undefined) return null;

  const baseProfile = draft.baseProfileId
    ? profileLibrary.baseProfiles.find((profile) => profile.id === draft.baseProfileId)
    : undefined;
  const categoryProfile = draft.categoryProfileId
    ? profileLibrary.categoryProfiles.find((profile) => profile.id === draft.categoryProfileId)
    : undefined;

  return resolveProfile({
    assetProfile: selectedDraftAsAssetProfile(draft, draft.baseProfileId),
    ...(baseProfile === undefined ? {} : { baseProfile }),
    ...(categoryProfile === undefined ? {} : { categoryProfile }),
  });
}

export interface UpdateWizardDraftInput {
  readonly draft: WizardDraft;
  readonly projectName?: string;
  readonly currentStep?: WizardCoreStepId;
  readonly savedAt?: string;
}

export function updateWizardDraft(input: UpdateWizardDraftInput): WizardDraft {
  const currentStep = input.currentStep ?? resolveWizardCoreStep(input.draft).stepId;
  const route =
    "category" in input.draft ? input.draft.route : getWizardCoreStep(currentStep).route;

  return parseWizardDraft({
    ...input.draft,
    ...(input.projectName === undefined ? {} : { projectName: input.projectName }),
    currentStep,
    route,
    ...(input.savedAt === undefined ? {} : { savedAt: input.savedAt }),
  });
}

export interface ResolvedWizardCoreStep {
  readonly stepId: WizardCoreStepId;
  readonly usedFallback: boolean;
  readonly unknownStep?: string;
}

export function resolveWizardCoreStep(draft: WizardDraft): ResolvedWizardCoreStep {
  const currentStepIsApplicable = (stepId: WizardCoreStepId): boolean => {
    if (stepId === "project" || stepId === "category") return true;
    if (!("category" in draft)) return false;
    if (stepId === "baseProfile") return true;
    if (draft.baseProfileId === undefined) return false;

    const capabilities = selectedDraftCapabilities(draft);
    switch (stepId) {
      case "characterDetails":
        return draft.category === "character";
      case "movingObjectDetails":
        return draft.category === "movingObject";
      case "textureDetails":
        return draft.category === "texture";
      case "natureDetails":
        return draft.category === "nature";
      case "staticObjectDetails":
        return draft.category === "staticObject";
      case "buildingDetails":
        return draft.category === "building";
      case "tilesetDetails":
        return draft.category === "tileset";
      case "itemDetails":
        return draft.category === "item";
      case "artworkDetails":
        return draft.category === "artwork";
      case "directions":
        return capabilities.directional;
      case "animation":
        return capabilities.animated;
      case "tileability":
        return (
          capabilities.tileable && draft.category !== "texture" && draft.category !== "tileset"
        );
    }
  };

  if (isWizardCoreStepId(draft.currentStep) && currentStepIsApplicable(draft.currentStep)) {
    return Object.freeze({ stepId: draft.currentStep, usedFallback: false });
  }

  // Prompts 16 and 20 moved Texture/Tileset repetition settings out of the
  // generic tileability step. Resume older drafts at their replacement step
  // instead of sending users back to the Base-profile selection.
  if (
    "category" in draft &&
    (draft.category === "texture" || draft.category === "tileset") &&
    draft.baseProfileId !== undefined &&
    draft.currentStep === "tileability"
  ) {
    return Object.freeze({
      stepId: draft.category === "texture" ? "textureDetails" : "tilesetDetails",
      usedFallback: true,
      unknownStep: draft.currentStep,
    });
  }

  return Object.freeze({
    stepId: getWizardCoreFallbackStepId(draft.route),
    usedFallback: true,
    unknownStep: draft.currentStep,
  });
}

export type WizardResumeRecoveryIssue =
  | Readonly<{ code: "invalidDraft"; message: string }>
  | Readonly<{
      code: "draftIdMismatch";
      requestedDraftId: string;
      actualDraftId: StableId;
    }>
  | Readonly<{
      code: "missingBaseProfile";
      baseProfileId?: StableId;
    }>
  | Readonly<{
      code: "missingCategoryProfile";
      categoryProfileId: StableId;
    }>
  | Readonly<{
      code: "categoryProfileMismatch";
      categoryProfileId: StableId;
    }>
  | Readonly<{
      code: "profileResolutionConflict";
      conflict: ProfileResolutionConflict;
    }>;

export interface WizardResumeNotice {
  readonly code: "unknownCurrentStep";
  readonly unknownStep: string;
  readonly fallbackStep: WizardCoreStepId;
}

export type ValidateWizardResumeResult =
  | Readonly<{
      status: "ready";
      draft: WizardDraft;
      notices: readonly WizardResumeNotice[];
    }>
  | Readonly<{
      status: "recovery";
      issues: readonly [WizardResumeRecoveryIssue, ...WizardResumeRecoveryIssue[]];
    }>;

export interface ValidateWizardResumeInput {
  readonly requestedDraftId: string;
  readonly draft: unknown;
  readonly profileLibrary: ProfileLibrary;
}

function wizardResumeRecovery(
  firstIssue: WizardResumeRecoveryIssue,
  ...remainingIssues: WizardResumeRecoveryIssue[]
): Extract<ValidateWizardResumeResult, { status: "recovery" }> {
  const issues: [WizardResumeRecoveryIssue, ...WizardResumeRecoveryIssue[]] = [
    Object.freeze(firstIssue),
    ...remainingIssues.map((issue) => Object.freeze(issue)),
  ];

  return Object.freeze({
    status: "recovery",
    issues: Object.freeze(issues),
  });
}

function selectedDraftReferenceIssues(
  draft: Extract<WizardDraft, { category: unknown }>,
  profileLibrary: ProfileLibrary,
): WizardResumeRecoveryIssue[] {
  const issues: WizardResumeRecoveryIssue[] = [];
  const baseProfile = draft.baseProfileId
    ? profileLibrary.baseProfiles.find((profile) => profile.id === draft.baseProfileId)
    : undefined;

  const baseProfileIsDeferred =
    draft.route === "wizard/profile" && draft.baseProfileId === undefined;
  if (baseProfile === undefined && !baseProfileIsDeferred) {
    issues.push({
      code: "missingBaseProfile",
      ...(draft.baseProfileId === undefined ? {} : { baseProfileId: draft.baseProfileId }),
    });
  }

  if (draft.categoryProfileId !== undefined) {
    const categoryProfile = profileLibrary.categoryProfiles.find(
      (profile) => profile.id === draft.categoryProfileId,
    );

    if (categoryProfile === undefined) {
      issues.push({
        code: "missingCategoryProfile",
        categoryProfileId: draft.categoryProfileId,
      });
    } else if (
      categoryProfile.baseProfileId !== draft.baseProfileId ||
      categoryProfile.category !== draft.category ||
      categoryProfile.subtype !== draft.subtype
    ) {
      issues.push({
        code: "categoryProfileMismatch",
        categoryProfileId: draft.categoryProfileId,
      });
    }
  }

  return issues;
}

export function validateWizardResume(input: ValidateWizardResumeInput): ValidateWizardResumeResult {
  const parsed = WizardDraftSchema.safeParse(input.draft);
  if (!parsed.success) {
    return wizardResumeRecovery({
      code: "invalidDraft",
      message: parsed.error.issues[0]?.message ?? "The wizard draft is invalid.",
    });
  }

  const draft = parsed.data;
  if (draft.draftId !== input.requestedDraftId) {
    return wizardResumeRecovery({
      code: "draftIdMismatch",
      requestedDraftId: input.requestedDraftId,
      actualDraftId: draft.draftId,
    });
  }

  if ("category" in draft) {
    const referenceIssues = selectedDraftReferenceIssues(draft, input.profileLibrary);
    if (referenceIssues.length > 0) {
      const firstIssue = referenceIssues[0];
      if (firstIssue === undefined) {
        throw new Error("Expected at least one resume recovery issue.");
      }
      return wizardResumeRecovery(firstIssue, ...referenceIssues.slice(1));
    }

    const resolution = resolveWizardDraftSnapshot(draft, input.profileLibrary);
    if (resolution?.status === "conflict") {
      const resolutionIssues = resolution.conflicts.map((conflict): WizardResumeRecoveryIssue => ({
        code: "profileResolutionConflict",
        conflict,
      }));
      const firstIssue = resolutionIssues[0];
      if (firstIssue === undefined) {
        throw new Error("Expected at least one Draft profile-resolution issue.");
      }
      return wizardResumeRecovery(firstIssue, ...resolutionIssues.slice(1));
    }
  }

  const step = resolveWizardCoreStep(draft);
  if (!step.usedFallback || step.unknownStep === undefined) {
    return Object.freeze({
      status: "ready",
      draft,
      notices: Object.freeze([]),
    });
  }

  const recoveredDraft = updateWizardDraft({
    draft,
    currentStep: step.stepId,
  });
  return Object.freeze({
    status: "ready",
    draft: recoveredDraft,
    notices: Object.freeze([
      Object.freeze({
        code: "unknownCurrentStep" as const,
        unknownStep: step.unknownStep,
        fallbackStep: step.stepId,
      }),
    ]),
  });
}
