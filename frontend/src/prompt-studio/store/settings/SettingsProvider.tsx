import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  DARK_THEME_MEDIA_QUERY,
  type ResolvedTheme,
  type ThemePreference,
} from "../../domain/theme";
import type { AppSettings, StableId } from "../../schemas";
import type { StorageMutationResult, V2StorageAdapter } from "../../services";
import {
  createDefaultAppSettings,
  selectResolvedTheme,
  settingsReducer,
  withActiveBaseProfile,
  withThemePreference,
  type SettingsPersistence,
  type SettingsState,
} from "./settingsState";

export interface SettingsContextValue {
  readonly settings: AppSettings;
  readonly themePreference: ThemePreference;
  readonly resolvedTheme: ResolvedTheme;
  readonly persistence: SettingsPersistence;
  readonly setThemePreference: (theme: ThemePreference) => void;
  readonly setActiveBaseProfile: (profileId: StableId | null) => StorageMutationResult;
  readonly restoreSettings: (settings: AppSettings) => StorageMutationResult;
}

export type SettingsStorage = Pick<V2StorageAdapter, "readSettings" | "writeSettings">;

export interface SettingsProviderProps {
  readonly children: ReactNode;
  readonly storageAdapter: SettingsStorage;
  readonly now?: () => string;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function currentIsoTimestamp(): string {
  return new Date().toISOString();
}

function resolvedSystemTheme(mediaQuery: MediaQueryList | null): ResolvedTheme {
  return mediaQuery?.matches ? "dark" : "light";
}

function getSystemThemeMediaQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  try {
    return window.matchMedia(DARK_THEME_MEDIA_QUERY);
  } catch {
    return null;
  }
}

function loadInitialState(
  storageAdapter: SettingsStorage,
  mediaQuery: MediaQueryList | null,
  now: () => string,
): SettingsState {
  const storedSettings = storageAdapter.readSettings();
  const systemTheme = resolvedSystemTheme(mediaQuery);

  if (storedSettings.status === "valid") {
    return {
      settings: storedSettings.value,
      systemTheme,
      persistence: { status: "ready" },
    };
  }

  const settings = createDefaultAppSettings(now());
  if (storedSettings.status === "invalid") {
    return {
      settings,
      systemTheme,
      persistence: {
        status: "invalid",
        message: "Die gespeicherten Einstellungen sind ungültig. Standardwerte sind aktiv.",
      },
    };
  }
  if (storedSettings.status === "unavailable") {
    return {
      settings,
      systemTheme,
      persistence: {
        status: "unavailable",
        message: "Lokales Speichern ist nicht verfügbar. Änderungen gelten für diese Sitzung.",
      },
    };
  }

  return { settings, systemTheme, persistence: { status: "ready" } };
}

function persistenceFromMutation(result: StorageMutationResult): SettingsPersistence {
  if (result.status === "ok") return { status: "saved" };
  if (result.status === "invalid") {
    return {
      status: "invalid",
      message: "Die Darstellung konnte nicht als gültige Einstellung gespeichert werden.",
    };
  }
  return {
    status: "unavailable",
    message: "Lokales Speichern ist nicht verfügbar. Änderungen gelten für diese Sitzung.",
  };
}

export function SettingsProvider({
  children,
  storageAdapter,
  now = currentIsoTimestamp,
}: SettingsProviderProps) {
  const [mediaQuery] = useState(getSystemThemeMediaQuery);
  const [initialState] = useState<SettingsState>(() =>
    loadInitialState(storageAdapter, mediaQuery, now),
  );
  const [state, dispatch] = useReducer(settingsReducer, initialState);
  const settingsRef = useRef(state.settings);
  const resolvedTheme = selectResolvedTheme(state);

  settingsRef.current = state.settings;

  useEffect(() => {
    if (!mediaQuery || state.settings.theme !== "system") return undefined;

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      dispatch({
        type: "systemThemeChanged",
        systemTheme: event.matches ? "dark" : "light",
      });
    };

    dispatch({
      type: "systemThemeChanged",
      systemTheme: resolvedSystemTheme(mediaQuery),
    });
    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, [mediaQuery, state.settings.theme]);

  const setThemePreference = useCallback(
    (theme: ThemePreference) => {
      const currentSettings = settingsRef.current;
      if (theme === currentSettings.theme) return;

      const nextSettings = withThemePreference(currentSettings, theme, now());
      const persistence = persistenceFromMutation(storageAdapter.writeSettings(nextSettings));
      settingsRef.current = nextSettings;
      dispatch({
        type: "themePreferenceChanged",
        settings: nextSettings,
        systemTheme: resolvedSystemTheme(mediaQuery),
        persistence,
      });
    },
    [mediaQuery, now, storageAdapter],
  );

  const setActiveBaseProfile = useCallback(
    (profileId: StableId | null): StorageMutationResult => {
      const currentSettings = settingsRef.current;
      if (profileId === currentSettings.activeBaseProfileId) {
        return { status: "ok" };
      }

      const nextSettings = withActiveBaseProfile(currentSettings, profileId, now());
      const result = storageAdapter.writeSettings(nextSettings);
      if (result.status === "invalid") return result;

      settingsRef.current = nextSettings;
      dispatch({ type: "settingsChanged", settings: nextSettings });
      return result;
    },
    [now, storageAdapter],
  );

  const restoreSettings = useCallback(
    (settings: AppSettings): StorageMutationResult => {
      const result = storageAdapter.writeSettings(settings);
      if (result.status !== "ok") return result;

      settingsRef.current = settings;
      dispatch({ type: "settingsChanged", settings });
      return result;
    },
    [storageAdapter],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings: state.settings,
      themePreference: state.settings.theme,
      resolvedTheme,
      persistence: state.persistence,
      restoreSettings,
      setActiveBaseProfile,
      setThemePreference,
    }),
    [
      resolvedTheme,
      restoreSettings,
      setActiveBaseProfile,
      setThemePreference,
      state.persistence,
      state.settings,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used inside SettingsProvider.");
  }
  return context;
}
