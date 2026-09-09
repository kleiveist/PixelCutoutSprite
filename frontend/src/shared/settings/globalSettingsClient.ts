import { invoke, isTauri } from "@tauri-apps/api/core";

import {
  GlobalSettingsSchema,
  type GlobalSettings,
} from "../../prompt-studio/schemas/v3Contracts.schema";

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  schemaVersion: 1,
  kind: "globalSettings",
  theme: "system",
  uiLanguage: "de",
  density: "comfortable",
};

export interface GlobalSettingsClient {
  load(): Promise<GlobalSettings>;
  save(settings: GlobalSettings): Promise<GlobalSettings>;
}

let browserSessionSettings = DEFAULT_GLOBAL_SETTINGS;

export const globalSettingsClient: GlobalSettingsClient = {
  async load() {
    if (!isTauri()) return browserSessionSettings;
    return GlobalSettingsSchema.parse(await invoke<unknown>("get_global_settings"));
  },
  async save(settings) {
    const valid = GlobalSettingsSchema.parse(settings);
    if (!isTauri()) {
      browserSessionSettings = valid;
      return valid;
    }
    return GlobalSettingsSchema.parse(
      await invoke<unknown>("save_global_settings", { settings: valid }),
    );
  },
};
