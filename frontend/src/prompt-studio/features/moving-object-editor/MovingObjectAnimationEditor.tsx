import { useWatch, type UseFormReturn } from "react-hook-form";
import { resolveCapabilities } from "../../domain/assets";
import {
  DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES,
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  type MovingObjectAnimationType,
  type MovingObjectSubtype,
} from "../../domain/moving-objects";
import type { WizardCoreFormValues } from "../wizard/wizardSteps";
import styles from "./MovingObjectEditor.module.css";

type MovingObjectForm = UseFormReturn<WizardCoreFormValues>;

const ANIMATION_LABELS: Readonly<Record<MovingObjectAnimationType, string>> = {
  idle: "Idle-Loop",
  move: "Bewegung",
  rotate: "Rotation",
  interact: "Interaktion",
  openClose: "Öffnen / Schließen",
  pulse: "Pulsieren",
};

function numberOrUndefined(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function frameError(
  form: MovingObjectForm,
  animationType: MovingObjectAnimationType,
): string | null {
  const error = form.formState.errors.movingObjectAnimationFrames?.[animationType];
  return typeof error?.message === "string" ? error.message : null;
}

export interface MovingObjectAnimationEditorProps {
  readonly form: MovingObjectForm;
  readonly subtype: MovingObjectSubtype;
  readonly notifyProgrammaticChange: () => void;
}

export function MovingObjectAnimationEditor({
  form,
  notifyProgrammaticChange,
  subtype,
}: MovingObjectAnimationEditorProps) {
  const animationFrames = useWatch({
    control: form.control,
    name: "movingObjectAnimationFrames",
  });
  const directionCount = useWatch({
    control: form.control,
    name: "directionCount",
  });
  const capabilities = resolveCapabilities("movingObject", subtype);

  const toggleAnimation = (animationType: MovingObjectAnimationType, enabled: boolean): void => {
    const current = form.getValues("movingObjectAnimationFrames") ?? {};
    const next = { ...current };
    if (enabled) {
      next[animationType] =
        current[animationType] ?? DEFAULT_MOVING_OBJECT_ANIMATION_FRAMES[animationType];
    } else {
      delete next[animationType];
    }

    form.setValue(
      "movingObjectAnimationFrames",
      Object.keys(next).length === 0 ? undefined : next,
      { shouldDirty: true, shouldTouch: true, shouldValidate: true },
    );
    notifyProgrammaticChange();
  };

  return (
    <div className={styles.animationEditor}>
      <div className={styles.logicNote} role="note">
        <strong>Animation und Richtungsset bleiben getrennt.</strong>
        <span>
          {capabilities.directional && directionCount !== undefined
            ? `Jede Sequenz verwendet ihre Frames in allen ${directionCount} gewählten Richtungen.`
            : capabilities.directional
              ? "Sequenzen erhalten eigene Frames; ein Richtungsset ist noch nicht ausgewählt."
              : "Sequenzen erhalten eigene Frames, ohne Richtungsansichten zu erzeugen."}
        </span>
      </div>

      <fieldset className={styles.group}>
        <legend>Animationssequenzen und Frames</legend>
        <p className={styles.groupIntro}>
          Aktiviere nur benötigte Sequenzen. Jede aktive Sequenz erhält ein bis sechzehn Frames und
          startet mit vier Frames. Keine Auswahl bedeutet, dass keine Animation angefordert wird.
        </p>
        <div className={styles.actionGrid}>
          {MOVING_OBJECT_ANIMATION_TYPE_IDS.map((animationType) => {
            const label = ANIMATION_LABELS[animationType];
            const enabled = Object.prototype.hasOwnProperty.call(
              animationFrames ?? {},
              animationType,
            );
            const inputId = `moving-object-animation-${animationType}`;
            const frameId = `${inputId}-frames`;
            const helpId = `${frameId}-help`;
            const errorId = `${frameId}-error`;
            const error = frameError(form, animationType);

            return (
              <div
                key={animationType}
                className={styles.actionCard}
                data-enabled={enabled ? "true" : "false"}
              >
                <label className={styles.actionToggle} htmlFor={inputId}>
                  <input
                    id={inputId}
                    type="checkbox"
                    aria-label={`${label} aktivieren`}
                    checked={enabled}
                    onChange={(event) =>
                      toggleAnimation(animationType, event.currentTarget.checked)
                    }
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{enabled ? "Aktiv" : "Nicht ausgewählt"}</small>
                  </span>
                </label>

                {enabled ? (
                  <div className={styles.frameField}>
                    <label htmlFor={frameId}>Frames für {label}</label>
                    <input
                      id={frameId}
                      type="number"
                      min={1}
                      max={16}
                      step={1}
                      inputMode="numeric"
                      aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
                      aria-invalid={error ? "true" : "false"}
                      {...form.register(`movingObjectAnimationFrames.${animationType}`, {
                        setValueAs: numberOrUndefined,
                      })}
                    />
                    <p id={helpId} className={styles.help}>
                      1 bis 16 Frames
                    </p>
                    {error ? (
                      <p id={errorId} className={styles.error}>
                        {error}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </fieldset>

      <section
        className={styles.productionRules}
        aria-labelledby="moving-object-animation-rules-title"
      >
        <h3 id="moving-object-animation-rules-title">Verbindliche Konsistenzregeln</h3>
        <ul>
          <li>Die Kamera und die Weltlichtseite bleiben in allen Frames fest.</li>
          <li>Anker, Footprint und Objektproportionen bleiben über alle Frames identisch.</li>
          <li>Mechanik, Materialaufteilung und Bauteile wechseln nicht zwischen Ansichten.</li>
          <li>Richtungsansichten werden logisch neu gezeichnet und nicht blind gespiegelt.</li>
          <li>Kontakt- oder Bewegungsschatten bleiben klein und folgen dem festgelegten Anker.</li>
        </ul>
      </section>
    </div>
  );
}
