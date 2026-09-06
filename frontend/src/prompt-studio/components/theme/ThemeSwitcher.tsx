import { THEME_PREFERENCES, type ThemePreference } from "../../domain/theme";
import { useSettings } from "../../store/settings";
import styles from "./ThemeSwitcher.module.css";

const THEME_OPTIONS: Readonly<Record<ThemePreference, Readonly<{ label: string; hint: string }>>> =
  {
    light: { label: "Hell", hint: "Helle Arbeitsfläche" },
    dark: { label: "Dunkel", hint: "Dunkle Arbeitsfläche" },
    system: { label: "System", hint: "Geräteeinstellung folgen" },
  };

export function ThemeSwitcher() {
  const { themePreference, resolvedTheme, persistence, setThemePreference } = useSettings();

  const resolvedLabel = resolvedTheme === "dark" ? "Dunkel" : "Hell";

  return (
    <fieldset className={styles.switcher}>
      <legend className={styles.legend}>Darstellung</legend>
      <div className={styles.options}>
        {THEME_PREFERENCES.map((theme) => {
          const option = THEME_OPTIONS[theme];
          return (
            <label className={styles.option} key={theme}>
              <input
                checked={themePreference === theme}
                className={styles.input}
                name="theme-preference"
                onChange={() => setThemePreference(theme)}
                type="radio"
                value={theme}
              />
              <span className={styles.optionLabel} title={option.hint}>
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className={styles.status} aria-live="polite">
        <span>Aktiv: {resolvedLabel}</span>
        {persistence.status === "saved" ? (
          <span>Darstellung gespeichert.</span>
        ) : persistence.status === "invalid" || persistence.status === "unavailable" ? (
          <span>{persistence.message}</span>
        ) : null}
      </p>
    </fieldset>
  );
}
