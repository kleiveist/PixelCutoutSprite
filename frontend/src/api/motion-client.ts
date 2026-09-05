import { invoke } from "@tauri-apps/api/core";

import type {
  CreateMotionRequest,
  MotionCard,
  MotionCardPreviewData,
  MotionDashboardData,
  MotionDraft,
  MotionEditorData,
  MotionOpenTarget,
  SaveMotionDraftRequest,
  SampledDummyPreview,
  DummyPreview,
  EditablePoseDto,
} from "../domain/animations";
import type { Direction } from "../domain/common";
import type { MotionRevision } from "../domain/motion";

export interface MotionClient {
  dashboard(sessionId: string, areaId: string): Promise<MotionDashboardData>;
  create(sessionId: string, request: CreateMotionRequest): Promise<MotionCard>;
  duplicate(sessionId: string, templateId: string): Promise<MotionCard>;
  loadDraft(sessionId: string, templateId: string): Promise<MotionDraft>;
  openEditor(sessionId: string, templateId: string): Promise<MotionEditorData>;
  renderDummy(
    sessionId: string,
    templateId: string,
    direction: Direction,
    pose: EditablePoseDto,
  ): Promise<DummyPreview>;
  renderSample(
    sessionId: string,
    templateId: string,
    draft: MotionDraft,
    direction: Direction,
    sampleIndex: number,
  ): Promise<SampledDummyPreview>;
  detachDirection(
    sessionId: string,
    templateId: string,
    draft: MotionDraft,
    direction: Direction,
  ): Promise<MotionDraft>;
  bakeHelper(
    sessionId: string,
    templateId: string,
    draft: MotionDraft,
    helperIndex: number,
  ): Promise<MotionDraft>;
  cardPreview(
    sessionId: string,
    templateId: string,
    reducedMotion: boolean,
  ): Promise<MotionCardPreviewData>;
  saveDraft(sessionId: string, request: SaveMotionDraftRequest): Promise<MotionEditorData>;
  publish(sessionId: string, templateId: string): Promise<MotionRevision>;
  setArchived(
    sessionId: string,
    templateId: string,
    expectedRevision: number,
    archived: boolean,
  ): Promise<MotionCard>;
  remove(sessionId: string, templateId: string, expectedRevision: number): Promise<void>;
  resolveOpen(
    sessionId: string,
    templateId: string,
    characterId: string | null,
  ): Promise<MotionOpenTarget>;
}

export const motionClient: MotionClient = {
  dashboard(sessionId, areaId) {
    return invoke<MotionDashboardData>("get_motion_dashboard", { sessionId, areaId });
  },
  create(sessionId, request) {
    return invoke<MotionCard>("create_motion", { sessionId, request });
  },
  duplicate(sessionId, templateId) {
    return invoke<MotionCard>("duplicate_motion", { sessionId, templateId });
  },
  loadDraft(sessionId, templateId) {
    return invoke<MotionDraft>("load_motion_draft", { sessionId, templateId });
  },
  openEditor(sessionId, templateId) {
    return invoke<MotionEditorData>("open_motion_editor", { sessionId, templateId });
  },
  renderDummy(sessionId, templateId, direction, pose) {
    return invoke<DummyPreview>("render_motion_dummy", {
      sessionId,
      templateId,
      direction,
      pose,
    });
  },
  renderSample(sessionId, templateId, draft, direction, sampleIndex) {
    return invoke<SampledDummyPreview>("render_motion_sample", {
      sessionId,
      templateId,
      draft,
      direction,
      sampleIndex,
    });
  },
  detachDirection(sessionId, templateId, draft, direction) {
    return invoke<MotionDraft>("detach_motion_direction", {
      sessionId,
      templateId,
      draft,
      direction,
    });
  },
  bakeHelper(sessionId, templateId, draft, helperIndex) {
    return invoke<MotionDraft>("bake_motion_helper", {
      sessionId,
      templateId,
      draft,
      helperIndex,
    });
  },
  cardPreview(sessionId, templateId, reducedMotion) {
    return invoke<MotionCardPreviewData>("get_motion_card_preview", {
      sessionId,
      templateId,
      reducedMotion,
    });
  },
  saveDraft(sessionId, request) {
    return invoke<MotionEditorData>("save_motion_draft", { sessionId, request });
  },
  publish(sessionId, templateId) {
    return invoke<MotionRevision>("publish_motion", { sessionId, templateId });
  },
  setArchived(sessionId, templateId, expectedRevision, archived) {
    return invoke<MotionCard>("set_motion_archived", {
      sessionId,
      templateId,
      expectedRevision,
      archived,
    });
  },
  remove(sessionId, templateId, expectedRevision) {
    return invoke<void>("remove_motion", { sessionId, templateId, expectedRevision });
  },
  resolveOpen(sessionId, templateId, characterId) {
    return invoke<MotionOpenTarget>("resolve_motion_open", {
      sessionId,
      templateId,
      characterId,
    });
  },
};
