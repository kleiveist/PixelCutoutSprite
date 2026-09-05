import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";

import type {
  AssetImportInspection,
  AssetInventory,
  ConfirmAssetImportRequest,
} from "../domain/inventory";

export interface AssetClient {
  chooseSources(): Promise<string[]>;
  listenForDrops(onPaths: (paths: string[]) => void): Promise<() => void>;
  inventory(sessionId: string, areaId: string): Promise<AssetInventory>;
  inspect(sessionId: string, areaId: string, paths: string[]): Promise<AssetImportInspection>;
  import(sessionId: string, request: ConfirmAssetImportRequest): Promise<AssetInventory>;
  archive(
    sessionId: string,
    areaId: string,
    assetId: string,
    expectedRevision: number,
  ): Promise<AssetInventory>;
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
  inventory(sessionId, areaId) {
    return invoke<AssetInventory>("get_asset_inventory", { sessionId, areaId });
  },
  inspect(sessionId, areaId, paths) {
    return invoke<AssetImportInspection>("inspect_asset_sources", {
      sessionId,
      areaId,
      paths,
    });
  },
  import(sessionId, request) {
    return invoke<AssetInventory>("import_asset_sources", { sessionId, request });
  },
  archive(sessionId, areaId, assetId, expectedRevision) {
    return invoke<AssetInventory>("archive_asset", {
      sessionId,
      areaId,
      assetId,
      expectedRevision,
    });
  },
};
