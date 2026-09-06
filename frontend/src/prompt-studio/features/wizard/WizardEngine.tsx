import { useMemo } from "react";
import type { AssetCategory } from "../../domain/assets";
import type { ProfileLibrary, WizardDraft } from "../../schemas";
import type { V2StorageAdapter } from "../../services";
import { GuidedWizardEngine } from "./GuidedWizardEngine";
import { WIZARD_CORE_FLOW, type WizardCoreFlowContext } from "./WizardCoreStepContent";
import { resolveWizardCoreStep } from "./wizardLifecycle";
import { createWizardCoreFormValues } from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";

export type WizardDraftStorage = Pick<V2StorageAdapter, "writeDraft">;

export interface WizardEngineProps {
  readonly baselineDraft: WizardDraft;
  readonly categoryHint: AssetCategory | null;
  readonly draft: WizardDraft;
  readonly draftPersisted: boolean;
  readonly initialDirty?: boolean;
  readonly initialFormValues?: WizardCoreFormValues;
  readonly library: ProfileLibrary | null;
  readonly now: () => string;
  readonly onDraftEdited: (draft: WizardDraft) => void;
  readonly onDraftSaved: (draft: WizardDraft) => void;
  readonly onRawCoreFormValuesChanged?: (values: WizardCoreFormValues) => void;
  readonly storageAdapter: WizardDraftStorage;
}

/**
 * Thin product adapter around the reusable engine. Prompt 12 extends the flow
 * definition and form-value mapping, while navigation/autosave stay untouched.
 */
export function WizardEngine({
  baselineDraft,
  categoryHint,
  draft,
  draftPersisted,
  initialDirty,
  initialFormValues,
  library,
  now,
  onDraftEdited,
  onDraftSaved,
  onRawCoreFormValuesChanged,
  storageAdapter,
}: WizardEngineProps) {
  const context = useMemo<WizardCoreFlowContext>(
    () => ({ categoryHint, library }),
    [categoryHint, library],
  );
  const baselineValues = createWizardCoreFormValues(baselineDraft, categoryHint, library);
  const initialValues =
    initialFormValues ?? createWizardCoreFormValues(draft, categoryHint, library);

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
