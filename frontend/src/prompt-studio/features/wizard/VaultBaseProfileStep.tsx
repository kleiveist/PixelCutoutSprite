import { useEffect, useRef } from "react";

import type { BaseProfileValues } from "../../schemas";
import type { GuidedWizardStepComponentProps } from "./GuidedWizardEngine";
import type { WizardCoreFlowContext } from "./WizardCoreStepContent";
import { applyWizardBaseProfileToFormValues } from "./wizardCategoryRouting";
import type { WizardCoreFormValues } from "./wizardSteps";
import styles from "./VaultBaseProfileStep.module.css";

type Props = GuidedWizardStepComponentProps<WizardCoreFormValues, WizardCoreFlowContext>;

const TECHNICAL_KEYS = [
  "baseProfileId",
  "pixelDensity",
  "styleProfile",
  "tileSize",
  "characterHeight",
  "perspectiveType",
  "cameraAngle",
  "cameraDirection",
  "projectionType",
  "outlineStyle",
  "paletteMode",
  "backgroundMode",
  "alphaPadding",
  "nearestNeighbor",
  "lightingPolicy",
  "lightingNotes",
] as const satisfies readonly (keyof WizardCoreFormValues)[];

const valueLabels = {
  classicHd: "Classic HD",
  modernHd: "Modern HD",
  ultraHd: "Ultra HD",
  classic: "Klassisch",
  dark: "Düster",
  both: "Klassisch + düster",
} as const;

function label(
  value: BaseProfileValues["pixelDensity"] | BaseProfileValues["styleProfile"],
): string {
  return valueLabels[value];
}

/** Productive P33 step: one inherited Vault base, no embedded editor or selector. */
export function VaultBaseProfileStep({ context, form, notifyProgrammaticChange }: Props) {
  const base = context.library?.baseProfiles[0] ?? null;
  const applied = useRef<string | null>(null);

  useEffect(() => {
    if (!base || applied.current === `${base.id}:${base.updatedAt}`) return;
    const next = applyWizardBaseProfileToFormValues(form.getValues(), base);
    for (const key of TECHNICAL_KEYS) {
      form.setValue(key, next[key], {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
    applied.current = `${base.id}:${base.updatedAt}`;
    notifyProgrammaticChange({ allowIncompleteStep: true, persistImmediately: true });
  }, [base, form, notifyProgrammaticChange]);

  if (!base) {
    return (
      <section className={styles.empty} role="status">
        <h3>Dieser Vault hat noch kein Basisprofil.</h3>
        <p>
          Lege die einzige Vault-Basis im gemeinsamen Popup an. Der Wizard erzeugt keine zweite
          Produktionsfamilie.
        </p>
        <button type="button" className="primary-button" onClick={context.onOpenBaseProfile}>
          Basisprofil anlegen
        </button>
      </section>
    );
  }

  return (
    <section className={styles.reference} aria-label="Aktive Vault-Basis">
      <div>
        <small>GEERBT AUS DEM AKTUELLEN VAULT</small>
        <h3>{base.name}</h3>
        <p>
          Alle technischen Werte stammen unverändert aus <code>.PixelPrompt/basisprofil.json</code>.
        </p>
      </div>
      <dl>
        <div>
          <dt>Pixeldichte</dt>
          <dd>{label(base.values.pixelDensity)}</dd>
        </div>
        <div>
          <dt>Stil</dt>
          <dd>{label(base.values.styleProfile)}</dd>
        </div>
        <div>
          <dt>Tile</dt>
          <dd>{base.values.tileSize} px</dd>
        </div>
        <div>
          <dt>Basis-ID</dt>
          <dd>{base.id}</dd>
        </div>
      </dl>
      <button type="button" onClick={context.onOpenBaseProfile}>
        Vault-Basis bearbeiten
      </button>
    </section>
  );
}
