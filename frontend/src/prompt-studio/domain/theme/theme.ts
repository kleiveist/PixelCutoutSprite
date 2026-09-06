export const THEME_PREFERENCES = ["light", "dark", "system"] as const;
export const RESOLVED_THEMES = ["light", "dark"] as const;
export const DARK_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type ThemePreference = (typeof THEME_PREFERENCES)[number];
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number];

export function resolveThemePreference(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}
