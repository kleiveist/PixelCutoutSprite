import { invoke } from "@tauri-apps/api/core";

import type {
  CreateMotionRequest,
  MotionCard,
  MotionDashboardData,
  MotionDraft,
  MotionEditorData,
  MotionOpenTarget,
  SaveMotionDraftRequest,
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
  saveDraft(sessionId: string, request: SaveMotionDraftRequest): Promise<MotionDraft>;
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
  saveDraft(sessionId, request) {
    return invoke<MotionDraft>("save_motion_draft", { sessionId, request });
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
