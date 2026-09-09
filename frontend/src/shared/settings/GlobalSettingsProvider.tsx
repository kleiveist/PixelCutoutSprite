import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import type { GlobalSettings } from "../../prompt-studio/schemas/v3Contracts.schema";
import {
  DEFAULT_GLOBAL_SETTINGS,
  globalSettingsClient,
  type GlobalSettingsClient,
} from "./globalSettingsClient";

interface GlobalSettingsContextValue {
  readonly settings: GlobalSettings;
  readonly status: "loading" | "ready" | "error" | "saving";
  readonly error: string | null;
  save(settings: GlobalSettings): Promise<void>;
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null);

export interface GlobalSettingsProviderProps {
  readonly client?: GlobalSettingsClient;
  readonly children: ReactNode;
}

function reasonMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}

export function GlobalSettingsProvider({
  client = globalSettingsClient,
  children,
}: GlobalSettingsProviderProps) {
  const [settings, setSettings] = useState(DEFAULT_GLOBAL_SETTINGS);
  const [status, setStatus] = useState<GlobalSettingsContextValue["status"]>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const previous = {
      theme: root.getAttribute("data-theme"),
      density: root.getAttribute("data-density"),
      lang: root.getAttribute("lang"),
      colorScheme: root.style.colorScheme,
    };
    return () => {
      if (previous.theme === null) root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", previous.theme);
      if (previous.density === null) root.removeAttribute("data-density");
      else root.setAttribute("data-density", previous.density);
      if (previous.lang === null) root.removeAttribute("lang");
      else root.setAttribute("lang", previous.lang);
      root.style.colorScheme = previous.colorScheme;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void client.load().then(
      (loaded) => {
        if (!active) return;
        setSettings(loaded);
        setStatus("ready");
        setError(null);
      },
      (reason: unknown) => {
        if (!active) return;
        setStatus("error");
        setError(reasonMessage(reason));
      },
    );
    return () => {
      active = false;
    };
  }, [client]);

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.("(prefers-color-scheme: light)");
    const apply = (): void => {
      const resolved =
        settings.theme === "system" ? (media?.matches ? "light" : "dark") : settings.theme;
      root.dataset.theme = resolved;
      root.dataset.density = settings.density;
      root.lang = settings.uiLanguage;
      root.style.colorScheme = resolved;
    };
    apply();
    media?.addEventListener?.("change", apply);
    return () => media?.removeEventListener?.("change", apply);
  }, [settings]);

  const value = useMemo<GlobalSettingsContextValue>(
    () => ({
      settings,
      status,
      error,
      async save(candidate) {
        setStatus("saving");
        setError(null);
        try {
          const stored = await client.save(candidate);
          setSettings(stored);
          setStatus("ready");
        } catch (reason) {
          setStatus("error");
          setError(reasonMessage(reason));
          throw reason;
        }
      },
    }),
    [client, error, settings, status],
  );

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

export function useGlobalSettings(): GlobalSettingsContextValue {
  const value = useContext(GlobalSettingsContext);
  if (!value) throw new Error("useGlobalSettings must be used inside GlobalSettingsProvider");
  return value;
}
