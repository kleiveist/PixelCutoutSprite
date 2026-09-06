import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from "react";
import type { AssetCategory } from "../../domain/assets";
import type { StableId, WizardDraft } from "../../schemas";
import {
  INITIAL_WIZARD_SESSION_STATE,
  selectWizardSessionDirty,
  wizardSessionReducer,
  type WizardDraftActivationMode,
  type WizardRawCoreFormValues,
  type WizardSessionState,
} from "./wizardSessionState";

export interface WizardSessionContextValue extends WizardSessionState {
  readonly draftDirty: boolean;
  readonly requestNewAsset: (category: AssetCategory | null) => void;
  readonly requestProfile: (assetProfileId: StableId) => void;
  readonly requestResume: (draftId: StableId) => void;
  readonly activateDraft: (draft: WizardDraft, mode: WizardDraftActivationMode) => void;
  readonly captureRawCoreFormValues: (values: WizardRawCoreFormValues) => void;
  readonly clearProfileRequest: (assetProfileId: StableId) => void;
}

export interface WizardSessionProviderProps {
  readonly children: ReactNode;
}

const WizardSessionContext = createContext<WizardSessionContextValue | null>(null);

export function WizardSessionProvider({ children }: WizardSessionProviderProps) {
  const [state, dispatch] = useReducer(wizardSessionReducer, INITIAL_WIZARD_SESSION_STATE);

  const requestNewAsset = useCallback((category: AssetCategory | null) => {
    dispatch({
      type: "startRequested",
      intent: { kind: "newAsset", category },
    });
  }, []);

  const requestProfile = useCallback((assetProfileId: StableId) => {
    dispatch({
      type: "startRequested",
      intent: { kind: "profile", assetProfileId },
    });
  }, []);

  const requestResume = useCallback((draftId: StableId) => {
    dispatch({
      type: "startRequested",
      intent: { kind: "resume", draftId },
    });
  }, []);

  const activateDraft = useCallback((draft: WizardDraft, mode: WizardDraftActivationMode) => {
    dispatch({ type: "draftActivated", draft, mode });
  }, []);

  const captureRawCoreFormValues = useCallback((values: WizardRawCoreFormValues) => {
    dispatch({ type: "rawCoreFormValuesCaptured", values });
  }, []);

  const clearProfileRequest = useCallback((assetProfileId: StableId) => {
    dispatch({ type: "profileRequestCleared", assetProfileId });
  }, []);

  const value = useMemo<WizardSessionContextValue>(
    () => ({
      ...state,
      draftDirty: selectWizardSessionDirty(state),
      requestNewAsset,
      requestProfile,
      requestResume,
      activateDraft,
      captureRawCoreFormValues,
      clearProfileRequest,
    }),
    [
      activateDraft,
      captureRawCoreFormValues,
      clearProfileRequest,
      requestNewAsset,
      requestProfile,
      requestResume,
      state,
    ],
  );

  return <WizardSessionContext.Provider value={value}>{children}</WizardSessionContext.Provider>;
}

export function useWizardSession(): WizardSessionContextValue {
  const context = useContext(WizardSessionContext);
  if (!context) {
    throw new Error("useWizardSession must be used within WizardSessionProvider.");
  }
  return context;
}
