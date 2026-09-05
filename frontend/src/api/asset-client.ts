import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  AssetImportInspection,
  AssetImportJobView,
  AssetInventoryQuery,
  AssetInventoryItem,
  AssetInventoryPage,
  AssetThumbnail,
  ConfirmAssetImportRequest,
} from "../domain/inventory";

export interface AssetClient {
  chooseSources(): Promise<string[]>;
  listenForDrops(onPaths: (paths: string[]) => void): Promise<() => void>;
  inventory(
    sessionId: string,
    areaId: string,
    cursor?: string | null,
    limit?: number | null,
    query?: AssetInventoryQuery | null,
  ): Promise<AssetInventoryPage>;
  thumbnail(
    sessionId: string,
    areaId: string,
    assetId: string,
    revision: number,
    maxEdge?: number | null,
  ): Promise<AssetThumbnail>;
  inspect(
    sessionId: string,
    areaId: string,
    paths: string[],
    inspectionId?: string | null,
  ): Promise<AssetImportInspection>;
  cancelInspection?(sessionId: string, inspectionId: string): Promise<boolean>;
  import(sessionId: string, request: ConfirmAssetImportRequest): Promise<AssetImportJobView>;
  importJob(sessionId: string, jobId: string): Promise<AssetImportJobView>;
  activeImportJobs?(sessionId: string): Promise<AssetImportJobView[]>;
  cancelImport(sessionId: string, jobId: string): Promise<AssetImportJobView>;
  archive(
    sessionId: string,
    areaId: string,
    assetId: string,
    expectedRevision: number,
  ): Promise<AssetInventoryItem>;
}

export const assetClient: AssetClient = {
  async chooseSources() {
    const selected = await open({
      title: "Import PNG files or one PixelCutoutSprite asset package",
      multiple: true,
      directory: false,
      filters: [
        { name: "PNG images and asset packages", extensions: ["png", "json"] },
        { name: "PNG images", extensions: ["png"] },
        { name: "Asset package", extensions: ["json"] },
      ],
    });
    if (selected === null) return [];
    return Array.isArray(selected) ? selected : [selected];
  },
  async listenForDrops(onPaths) {
    return getCurrentWebview().onDragDropEvent(({ payload }) => {
      if (payload.type === "drop") onPaths(payload.paths);
    });
  },
  inventory(sessionId, areaId, cursor = null, limit = 50, query = null) {
    return invoke<AssetInventoryPage>("get_asset_inventory", {
      sessionId,
      areaId,
      cursor,
      limit,
      query,
    });
  },
  thumbnail(sessionId, areaId, assetId, revision, maxEdge = 48) {
    return invoke<AssetThumbnail>("get_asset_thumbnail", {
      sessionId,
      areaId,
      assetId,
      revision,
      maxEdge,
    });
  },
  inspect(sessionId, areaId, paths, inspectionId = null) {
    return invoke<AssetImportInspection>("inspect_asset_sources", {
      sessionId,
      areaId,
      paths,
      inspectionId,
    });
  },
  cancelInspection(sessionId, inspectionId) {
    return invoke<boolean>("cancel_asset_inspection", { sessionId, inspectionId });
  },
  import(sessionId, request) {
    return invoke<AssetImportJobView>("import_asset_sources", { sessionId, request });
  },
  importJob(sessionId, jobId) {
    return invoke<AssetImportJobView>("get_asset_import_job", { sessionId, jobId });
  },
  activeImportJobs(sessionId) {
    return invoke<AssetImportJobView[]>("list_active_asset_import_jobs", { sessionId });
  },
  cancelImport(sessionId, jobId) {
    return invoke<AssetImportJobView>("cancel_asset_import", { sessionId, jobId });
  },
  archive(sessionId, areaId, assetId, expectedRevision) {
    return invoke<AssetInventoryItem>("archive_asset", {
      sessionId,
      areaId,
      assetId,
      expectedRevision,
    });
  },
};
