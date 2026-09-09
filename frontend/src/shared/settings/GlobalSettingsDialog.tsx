import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  GlobalSettingsSchema,
  type GlobalSettings,
} from "../../prompt-studio/schemas/v3Contracts.schema";
import { Modal } from "../dialogs";
import { useGlobalSettings } from "./GlobalSettingsProvider";

export interface GlobalSettingsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

export function GlobalSettingsDialog({ open, onClose }: GlobalSettingsDialogProps) {
  const { settings, status, error, save } = useGlobalSettings();
  const [draft, setDraft] = useState<GlobalSettings>(settings);
  const [validationError, setValidationError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current || status === "ready") {
      setDraft(settings);
      initialized.current = true;
    }
  }, [settings, status]);

  const update = <Key extends "theme" | "uiLanguage" | "density">(
    key: Key,
    value: GlobalSettings[Key],
  ): void => {
    setDraft((current) => ({ ...current, [key]: value }));
    setValidationError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const parsed = GlobalSettingsSchema.safeParse(draft);
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? "Einstellungen sind ungültig.");
      return;
    }
    void save(parsed.data)
      .then(onClose)
      .catch(() => undefined);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Globale Einstellungen"
      className="settings-dialog"
      closeLabel="Globale Einstellungen schließen"
    >
      <form className="settings-form" onSubmit={submit}>
        <p>
          Diese Darstellung gilt gemeinsam für PixelPromptStudio, PixelCutoutSprite und
          PixelSpriteStudio. Fachliche Profile werden hier nicht gespeichert.
        </p>
        <label>
          <span>Theme</span>
          <select
            value={draft.theme}
            onChange={(event) =>
              update("theme", event.currentTarget.value as GlobalSettings["theme"])
            }
          >
            <option value="system">System</option>
            <option value="light">Hell</option>
            <option value="dark">Dunkel</option>
          </select>
        </label>
        <label>
          <span>Sprache der Oberfläche</span>
          <select
            value={draft.uiLanguage}
            onChange={(event) =>
              update("uiLanguage", event.currentTarget.value as GlobalSettings["uiLanguage"])
            }
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          <span>Dichte</span>
          <select
            value={draft.density}
            onChange={(event) =>
              update("density", event.currentTarget.value as GlobalSettings["density"])
            }
          >
            <option value="comfortable">Komfortabel</option>
            <option value="compact">Kompakt</option>
          </select>
        </label>
        {validationError ? <p role="alert">{validationError}</p> : null}
        {error ? <p role="alert">Nicht gespeichert: {error}</p> : null}
        <div className="settings-form-actions">
          <button type="button" onClick={onClose}>
            Abbrechen
          </button>
          <button className="primary-button" type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Speichert…" : "Speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
