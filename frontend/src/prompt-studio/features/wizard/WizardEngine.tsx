import { useMemo } from "react";
import type { AssetCategory } from "../../domain/assets";
import type { ProfileLibrary, WizardDraft } from "../../schemas";
import type { V2StorageAdapter } from "../../services";
import { GuidedWizardEngine } from "./GuidedWizardEngine";
import {
  WIZARD_CATALOG_FLOW,
  WIZARD_CORE_FLOW,
  type WizardCoreFlowContext,
} from "./WizardCoreStepContent";
import { resolveWizardCoreStep } from "./wizardLifecycle";
import {
  applyWizardBaseProfileToFormValues,
  createWizardCoreFormValues,
} from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";
import { migrateWizardCatalogStepId } from "./wizardCatalog";

export type WizardDraftStorage = Pick<V2StorageAdapter, "writeDraft">;

export interface WizardEngineProps {
  readonly baselineDraft: WizardDraft;
  readonly baselineFormValues?: WizardCoreFormValues;
  readonly categoryHint: AssetCategory | null;
  readonly draft: WizardDraft;
  readonly draftPersisted: boolean;
  readonly initialDirty?: boolean;
  readonly initialFormValues?: WizardCoreFormValues;
  readonly library: ProfileLibrary | null;
  readonly now: () => string;
  readonly onDraftEdited: (draft: WizardDraft) => void;
  readonly onDraftSaved: (draft: WizardDraft) => void;
  readonly onOpenBaseProfile?: () => void;
  readonly onRawCoreFormValuesChanged?: (values: WizardCoreFormValues) => void;
  readonly storageAdapter: WizardDraftStorage;
}

/**
 * Thin product adapter around the reusable engine. Prompt 12 extends the flow
 * definition and form-value mapping, while navigation/autosave stay untouched.
 */
export function WizardEngine({
  baselineDraft,
  baselineFormValues,
  categoryHint,
  draft,
  draftPersisted,
  initialDirty,
  initialFormValues,
  library,
  now,
  onDraftEdited,
  onDraftSaved,
  onOpenBaseProfile,
  onRawCoreFormValuesChanged,
  storageAdapter,
}: WizardEngineProps) {
  const context = useMemo<WizardCoreFlowContext>(
    () => ({ categoryHint, library, ...(onOpenBaseProfile ? { onOpenBaseProfile } : {}) }),
    [categoryHint, library, onOpenBaseProfile],
  );
  const useCatalogFlow = onOpenBaseProfile !== undefined;
  const applySoleCatalogBase = (values: WizardCoreFormValues): WizardCoreFormValues => {
    if (
      !useCatalogFlow ||
      values.baseProfileId !== undefined ||
      library?.baseProfiles.length !== 1
    ) {
      return values;
    }
    const baseProfile = library.baseProfiles[0];
    return baseProfile ? applyWizardBaseProfileToFormValues(values, baseProfile) : values;
  };
  const baselineValues = applySoleCatalogBase(
    baselineFormValues ?? createWizardCoreFormValues(baselineDraft, categoryHint, library),
  );
  const initialValues = applySoleCatalogBase(
    initialFormValues ?? createWizardCoreFormValues(draft, categoryHint, library),
  );

  if (useCatalogFlow) {
    return (
      <GuidedWizardEngine
        baselineDraft={baselineDraft}
        baselineValues={baselineValues}
        context={context}
        draft={draft}
        draftPersisted={draftPersisted}
        flow={WIZARD_CATALOG_FLOW}
        initialStepId={migrateWizardCatalogStepId(draft.currentStep, initialValues)}
        initialValues={initialValues}
        now={now}
        onDraftEdited={onDraftEdited}
        onDraftSaved={onDraftSaved}
        storageAdapter={storageAdapter}
        {...(initialDirty === undefined ? {} : { initialDirty })}
        {...(onRawCoreFormValuesChanged ? { onValuesChanged: onRawCoreFormValuesChanged } : {})}
      />
    );
  }

  return (
    <GuidedWizardEngine
      baselineDraft={baselineDraft}
      baselineValues={baselineValues}
      context={context}
      draft={draft}
      draftPersisted={draftPersisted}
      flow={WIZARD_CORE_FLOW}
      initialStepId={resolveWizardCoreStep(draft).stepId}
      initialValues={initialValues}
      now={now}
      onDraftEdited={onDraftEdited}
      onDraftSaved={onDraftSaved}
      storageAdapter={storageAdapter}
      {...(initialDirty === undefined ? {} : { initialDirty })}
      {...(onRawCoreFormValuesChanged ? { onValuesChanged: onRawCoreFormValuesChanged } : {})}
    />
  );
}
