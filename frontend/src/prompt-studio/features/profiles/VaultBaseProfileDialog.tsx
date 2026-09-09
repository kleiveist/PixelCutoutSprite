import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import {
  createDefaultBaseProfileLocks,
  createDefaultBaseProfileValues,
} from "../../domain/profiles";
import {
  VaultBaseProfileSchema,
  type BaseProfileLocks,
  type BaseProfileValues,
  type VaultBaseProfile,
} from "../../schemas";
import { useVaultPrompt } from "../../store/vault";
import { Modal } from "../../../shared/dialogs";
import styles from "./VaultProfileView.module.css";

export interface VaultBaseProfileDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly now?: () => string;
  readonly createId?: () => string;
}

interface BaseDraft {
  readonly name: string;
  readonly values: BaseProfileValues;
  readonly locks: BaseProfileLocks;
}

type ValueKey = keyof BaseProfileValues;

const LOCK_LABELS: Readonly<Record<ValueKey, string>> = {
  pixelDensity: "Pixeldichte sperren",
  styleProfile: "Stilprofil sperren",
  tileSize: "Tile-Größe sperren",
  characterHeight: "Figurenhöhe sperren",
  perspectiveType: "Perspektive sperren",
  cameraAngle: "Kamerawinkel sperren",
  cameraDirection: "Kamerarichtung sperren",
  projectionType: "Projektion sperren",
  outlineStyle: "Konturen sperren",
  paletteMode: "Palette sperren",
  backgroundMode: "Hintergrund sperren",
  alphaPadding: "Alpha-Rand sperren",
  nearestNeighbor: "Nearest Neighbor sperren",
  lightingDefaults: "Lichtvorgaben sperren",
};

function createDraft(profile: VaultBaseProfile | null): BaseDraft {
  if (profile) {
    return {
      name: profile.name,
      values: {
        ...profile.values,
        lightingDefaults: { ...profile.values.lightingDefaults },
      },
      locks: { ...profile.locks },
    };
  }
  return {
    name: "Vault-Basisprofil",
    values: createDefaultBaseProfileValues(),
    locks: createDefaultBaseProfileLocks(),
  };
}

function defaultId(): string {
  return `base-${crypto.randomUUID().toLowerCase()}`;
}

interface FieldProps {
  readonly label: string;
  readonly lockKey: ValueKey;
  readonly locks: BaseProfileLocks;
  readonly onLock: (key: ValueKey, locked: boolean) => void;
  readonly children: ReactNode;
}

function ProfileField({ label, lockKey, locks, onLock, children }: FieldProps) {
  return (
    <div className={styles.profileField}>
      <label className={styles.controlLabel}>
        <span>{label}</span>
        {children}
      </label>
      <label className={styles.lockControl}>
        <input
          type="checkbox"
          checked={locks[lockKey] === true}
          onChange={(event) => onLock(lockKey, event.currentTarget.checked)}
        />
        <span>{LOCK_LABELS[lockKey]}</span>
      </label>
    </div>
  );
}

export function VaultBaseProfileDialog({
  open,
  onClose,
  now = () => new Date().toISOString(),
  createId = defaultId,
}: VaultBaseProfileDialogProps) {
  const { index, writable, saveBaseProfile } = useVaultPrompt();
  const current = index?.baseProfile?.value ?? null;
  const [draft, setDraft] = useState<BaseDraft>(() => createDraft(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(createDraft(current));
    setError(null);
  }, [current, open]);

  const setValue = <Key extends ValueKey>(key: Key, value: BaseProfileValues[Key]): void => {
    setDraft((source) => ({ ...source, values: { ...source.values, [key]: value } }));
    setError(null);
  };

  const setLock = (key: ValueKey, locked: boolean): void => {
    setDraft((source) => {
      const locks = { ...source.locks };
      if (locked) locks[key] = true;
      else delete locks[key];
      return { ...source, locks };
    });
  };

  const setCharacterHeight = (value: number | undefined): void => {
    setDraft((source) => {
      const values = { ...source.values };
      if (value === undefined) delete values.characterHeight;
      else values.characterHeight = value;
      const locks = { ...source.locks };
      if (value === undefined) delete locks.characterHeight;
      return { ...source, values, locks };
    });
    setError(null);
  };

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!writable || saving) return;
    const timestamp = now();
    const candidate = VaultBaseProfileSchema.safeParse({
      schemaVersion: 3,
      kind: "vaultBaseProfile",
      id: current?.id ?? createId(),
      revision: current ? current.revision + 1 : 1,
      name: draft.name,
      values: draft.values,
      locks: draft.locks,
      createdAt: current?.createdAt ?? timestamp,
      updatedAt: timestamp,
    });
    if (!candidate.success) {
      setError(candidate.error.issues[0]?.message ?? "Das Basisprofil ist ungültig.");
      return;
    }
    setSaving(true);
    setError(null);
    void saveBaseProfile(candidate.data)
      .then(() => onClose())
      .catch((reason: unknown) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      )
      .finally(() => setSaving(false));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      canDismiss={!saving}
      title={current ? "Vault-Basisprofil bearbeiten" : "Vault-Basisprofil anlegen"}
      className={styles.baseDialog}
      closeLabel="Basisprofil-Dialog schließen"
    >
      <form className={styles.baseForm} onSubmit={submit}>
        <p className={styles.formIntro}>
          Diese Werte bilden die einzige technische und stilistische Basis des aktuellen Vaults.
          Eine Sperre verhindert, dass Assetprofile den jeweiligen Wert überschreiben.
        </p>
        <label className={styles.controlLabel}>
          <span>Name</span>
          <input
            required
            maxLength={120}
            value={draft.name}
            onChange={(event) => {
              const name = event.currentTarget.value;
              setDraft((source) => ({ ...source, name }));
            }}
          />
        </label>

        <fieldset className={styles.fieldGrid}>
          <legend>Raster und Stil</legend>
          <ProfileField
            label="Pixeldichte"
            lockKey="pixelDensity"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.pixelDensity}
              onChange={(event) =>
                setValue(
                  "pixelDensity",
                  event.currentTarget.value as BaseProfileValues["pixelDensity"],
                )
              }
            >
              <option value="classicHd">Classic HD</option>
              <option value="modernHd">Modern HD</option>
              <option value="ultraHd">Ultra HD</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Stilprofil"
            lockKey="styleProfile"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.styleProfile}
              onChange={(event) =>
                setValue(
                  "styleProfile",
                  event.currentTarget.value as BaseProfileValues["styleProfile"],
                )
              }
            >
              <option value="classic">Klassisch</option>
              <option value="dark">Düster</option>
              <option value="both">Beide</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Tile-Größe (px)"
            lockKey="tileSize"
            locks={draft.locks}
            onLock={setLock}
          >
            <input
              type="number"
              required
              min={8}
              max={512}
              value={Number.isNaN(draft.values.tileSize) ? "" : draft.values.tileSize}
              onChange={(event) => setValue("tileSize", event.currentTarget.valueAsNumber)}
            />
          </ProfileField>
          <ProfileField
            label="Figurenhöhe (px, optional)"
            lockKey="characterHeight"
            locks={draft.locks}
            onLock={setLock}
          >
            <input
              type="number"
              min={16}
              max={1024}
              value={draft.values.characterHeight ?? ""}
              onChange={(event) =>
                setCharacterHeight(
                  event.currentTarget.value === "" ? undefined : event.currentTarget.valueAsNumber,
                )
              }
            />
          </ProfileField>
        </fieldset>

        <fieldset className={styles.fieldGrid}>
          <legend>Kamera und Projektion</legend>
          <ProfileField
            label="Perspektive"
            lockKey="perspectiveType"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.perspectiveType}
              onChange={(event) =>
                setValue(
                  "perspectiveType",
                  event.currentTarget.value as BaseProfileValues["perspectiveType"],
                )
              }
            >
              <option value="topdown">Top-down</option>
              <option value="threeQuarter">3/4</option>
              <option value="isometric">Isometrisch</option>
              <option value="side">Seite</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Kamerawinkel"
            lockKey="cameraAngle"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.cameraAngle}
              onChange={(event) =>
                setValue(
                  "cameraAngle",
                  Number(event.currentTarget.value) as BaseProfileValues["cameraAngle"],
                )
              }
            >
              <option value={30}>30°</option>
              <option value={45}>45°</option>
              <option value={60}>60°</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Kamerarichtung"
            lockKey="cameraDirection"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.cameraDirection}
              onChange={(event) =>
                setValue(
                  "cameraDirection",
                  event.currentTarget.value as BaseProfileValues["cameraDirection"],
                )
              }
            >
              <option value="southToNorth">Süd nach Nord</option>
              <option value="swToNe">Südwest nach Nordost</option>
              <option value="seToNw">Südost nach Nordwest</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Projektion"
            lockKey="projectionType"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.projectionType}
              onChange={(event) =>
                setValue(
                  "projectionType",
                  event.currentTarget.value as BaseProfileValues["projectionType"],
                )
              }
            >
              <option value="orthographic">Orthografisch</option>
              <option value="mildPerspective">Leichte Perspektive</option>
            </select>
          </ProfileField>
        </fieldset>

        <fieldset className={styles.fieldGrid}>
          <legend>Darstellung</legend>
          <ProfileField
            label="Konturen"
            lockKey="outlineStyle"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.outlineStyle}
              onChange={(event) =>
                setValue(
                  "outlineStyle",
                  event.currentTarget.value as BaseProfileValues["outlineStyle"],
                )
              }
            >
              <option value="dark">Dunkel</option>
              <option value="softSelective">Weich und selektiv</option>
              <option value="minimal">Minimal</option>
            </select>
          </ProfileField>
          <ProfileField label="Palette" lockKey="paletteMode" locks={draft.locks} onLock={setLock}>
            <select
              value={draft.values.paletteMode}
              onChange={(event) =>
                setValue(
                  "paletteMode",
                  event.currentTarget.value as BaseProfileValues["paletteMode"],
                )
              }
            >
              <option value="natural">Natürlich</option>
              <option value="vivid">Leuchtend</option>
              <option value="desaturated">Entsättigt</option>
              <option value="byProfile">Nach Profil</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Hintergrund"
            lockKey="backgroundMode"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.backgroundMode}
              onChange={(event) =>
                setValue(
                  "backgroundMode",
                  event.currentTarget.value as BaseProfileValues["backgroundMode"],
                )
              }
            >
              <option value="transparent">Transparent</option>
              <option value="scene">Szene</option>
            </select>
          </ProfileField>
          <ProfileField
            label="Alpha-Rand (px)"
            lockKey="alphaPadding"
            locks={draft.locks}
            onLock={setLock}
          >
            <input
              type="number"
              required
              min={0}
              max={256}
              value={Number.isNaN(draft.values.alphaPadding) ? "" : draft.values.alphaPadding}
              onChange={(event) => setValue("alphaPadding", event.currentTarget.valueAsNumber)}
            />
          </ProfileField>
          <ProfileField
            label="Nearest Neighbor"
            lockKey="nearestNeighbor"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.nearestNeighbor ? "true" : "false"}
              onChange={(event) =>
                setValue("nearestNeighbor", event.currentTarget.value === "true")
              }
            >
              <option value="true">Aktiv</option>
              <option value="false">Inaktiv</option>
            </select>
          </ProfileField>
        </fieldset>

        <fieldset className={styles.fieldGrid}>
          <legend>Lichtgrundregeln</legend>
          <ProfileField
            label="Lichtvorgabe"
            lockKey="lightingDefaults"
            locks={draft.locks}
            onLock={setLock}
          >
            <select
              value={draft.values.lightingDefaults.policy}
              onChange={(event) =>
                setValue("lightingDefaults", {
                  ...draft.values.lightingDefaults,
                  policy: event.currentTarget
                    .value as BaseProfileValues["lightingDefaults"]["policy"],
                })
              }
            >
              <option value="adaptive">Adaptiv</option>
              <option value="neutralDay">Neutraler Tag</option>
              <option value="warmInterior">Warmes Interieur</option>
              <option value="gloomyDiffuse">Düster diffus</option>
              <option value="neutralNight">Neutrale Nacht</option>
              <option value="coolNight">Kühle Nacht</option>
              <option value="custom">Benutzerdefiniert</option>
            </select>
          </ProfileField>
          <label className={`${styles.controlLabel} ${styles.notesField}`}>
            <span>Lichtnotizen</span>
            <textarea
              maxLength={2000}
              rows={4}
              value={draft.values.lightingDefaults.notes}
              onChange={(event) =>
                setValue("lightingDefaults", {
                  ...draft.values.lightingDefaults,
                  notes: event.currentTarget.value,
                })
              }
            />
          </label>
        </fieldset>

        {error ? (
          <p className={styles.formError} role="alert">
            Nicht gespeichert: {error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <button type="button" disabled={saving} onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" className="primary-button" disabled={!writable || saving}>
            {saving ? "Speichert…" : "Basisprofil speichern"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
