import type { ResolvedTheme, ThemePreference } from "../../domain/theme";
import { resolveThemePreference } from "../../domain/theme";
import { parseAppSettings, type AppSettings, type StableId } from "../../schemas";

export type SettingsPersistence =
  | Readonly<{ status: "ready" }>
  | Readonly<{ status: "saved" }>
  | Readonly<{ status: "invalid"; message: string }>
  | Readonly<{ status: "unavailable"; message: string }>;

export interface SettingsState {
  readonly settings: AppSettings;
  readonly systemTheme: ResolvedTheme;
  readonly persistence: SettingsPersistence;
}

export type SettingsAction =
  | Readonly<{
      type: "themePreferenceChanged";
      settings: AppSettings;
      systemTheme: ResolvedTheme;
      persistence: SettingsPersistence;
    }>
  | Readonly<{ type: "systemThemeChanged"; systemTheme: ResolvedTheme }>
  | Readonly<{ type: "settingsChanged"; settings: AppSettings }>;

export function createDefaultAppSettings(updatedAt: string): AppSettings {
  return parseAppSettings({
    schemaVersion: 2,
    kind: "appSettings",
    theme: "system",
    locale: "de",
    startView: "dashboard",
    activeBaseProfileId: null,
    updatedAt,
  });
}

export function withThemePreference(
  settings: AppSettings,
  theme: ThemePreference,
  updatedAt: string,
): AppSettings {
  return parseAppSettings({ ...settings, theme, updatedAt });
}

export function withActiveBaseProfile(
  settings: AppSettings,
  activeBaseProfileId: StableId | null,
  updatedAt: string,
): AppSettings {
  return parseAppSettings({ ...settings, activeBaseProfileId, updatedAt });
}

export function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  switch (action.type) {
    case "themePreferenceChanged":
      return {
        settings: action.settings,
        systemTheme: action.systemTheme,
        persistence: action.persistence,
      };
    case "systemThemeChanged":
      return action.systemTheme === state.systemTheme
        ? state
        : { ...state, systemTheme: action.systemTheme };
    case "settingsChanged":
      return {
        ...state,
        settings: action.settings,
        persistence: { status: "ready" },
      };
  }
}

export function selectResolvedTheme(state: SettingsState): ResolvedTheme {
  return resolveThemePreference(state.settings.theme, state.systemTheme);
}
