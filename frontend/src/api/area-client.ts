import { invoke } from "@tauri-apps/api/core";

import type {
  AreaDashboardData,
  AreaDetails,
  CreateAreaRequest,
  HumanoidProfilePreview,
  ReviseAreaProfileRequest,
} from "../domain/areas";

export interface AreaClient {
  preview(referenceHeightPx: number): Promise<HumanoidProfilePreview>;
  dashboard(sessionId: string, projectId: string): Promise<AreaDashboardData>;
  open(sessionId: string, areaId: string): Promise<AreaDetails>;
  create(sessionId: string, request: CreateAreaRequest): Promise<AreaDetails>;
  reviseProfile(sessionId: string, request: ReviseAreaProfileRequest): Promise<AreaDetails>;
}

export const areaClient: AreaClient = {
  preview(referenceHeightPx) {
    return invoke<HumanoidProfilePreview>("preview_humanoid_profile", { referenceHeightPx });
  },
  dashboard(sessionId, projectId) {
    return invoke<AreaDashboardData>("get_area_dashboard", { sessionId, projectId });
  },
  open(sessionId, areaId) {
    return invoke<AreaDetails>("open_area", { sessionId, areaId });
  },
  create(sessionId, request) {
    return invoke<AreaDetails>("create_area", { sessionId, request });
  },
  reviseProfile(sessionId, request) {
    return invoke<AreaDetails>("create_area_profile_revision", { sessionId, request });
  },
};
