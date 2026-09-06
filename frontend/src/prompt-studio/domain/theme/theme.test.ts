import { describe, expect, it } from "vitest";
import { resolveThemePreference } from "./theme";

describe("theme preference resolution", () => {
  it.each([
    ["light", "dark", "light"],
    ["dark", "light", "dark"],
    ["system", "light", "light"],
    ["system", "dark", "dark"],
  ] as const)("resolves %s with a %s system theme to %s", (preference, systemTheme, expected) => {
    expect(resolveThemePreference(preference, systemTheme)).toBe(expected);
  });
});
