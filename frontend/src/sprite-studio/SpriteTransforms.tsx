import { useEffect, useState } from "react";
import { partDefinition } from "../shared/image/parts";
import type { SpriteController, SpriteState } from "./controller";
import styles from "./SpriteStudio.module.css";

function NumberField({
  label,
  value,
  min,
  max,
  step,
  disabled,
  controller,
  onChange,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number | "any";
  readonly disabled: boolean;
  readonly controller: SpriteController;
  readonly onChange: (value: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setRaw(String(value));
    setError(null);
  }, [value]);
  const clear = () => {
    setRaw(String(value));
    setError(null);
    controller.setInputError(label, null);
  };
  return (
    <div className={styles.numericField}>
      <label>
        {label}
        <input
          type="number"
          value={raw}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={!!error}
          onChange={(event) => {
            const text = event.target.value,
              number = event.target.valueAsNumber;
            setRaw(text);
            const invalid = !text || !Number.isFinite(number) || number < min || number > max;
            const error = invalid
              ? `${label}: Bitte eine Zahl zwischen ${min} und ${max} eingeben oder die Eingabe zurücksetzen.`
              : null;
            setError(error);
            controller.setInputError(label, error);
            if (!error) onChange(number);
          }}
          onBlur={() => {
            if (!error) setRaw(String(value));
          }}
        />
      </label>
      {error ? (
        <>
          <small>{error}</small>
          <button type="button" onClick={clear}>
            Eingabe {label} zurücksetzen
          </button>
        </>
      ) : null}
    </div>
  );
}
export function SpriteTransforms({
  controller,
  state,
}: {
  readonly controller: SpriteController;
  readonly state: SpriteState;
}) {
  const scene = state.scene,
    layer = scene?.layers.find((layer) => layer.partId === state.selected);
  if (!scene || !layer) return null;
  const disabled = !controller.editable || layer.locked;
  const common = {
    controller,
    disabled,
    step: scene.pixelSnap ? 1 : ("any" as const),
    min: -10_000_000,
    max: 10_000_000,
  };
  return (
    <section aria-label="Ebene transformieren">
      <h2>{partDefinition(layer.partId).label} · Transformation</h2>
      <p>
        {layer.locked
          ? "Ebene gesperrt: Entsperren im View erlaubt wieder Transformationen."
          : "Position und Pivot in Quellpixeln, unabhängig vom Canvas-Zoom."}
      </p>
      <label>
        <input
          type="checkbox"
          checked={!scene.pixelSnap}
          disabled={!controller.editable || !!state.inputError}
          onChange={(event) => controller.setPixelSnap(!event.target.checked)}
        />
        Freie Transformationen aktivieren
      </label>
      <p>
        {scene.pixelSnap
          ? "Pixel-Snap aktiv: Verschiebungen werden ganzzahlig gerundet. Rotation und Skalierung erst nach bewusstem Aktivieren."
          : "Freie Transformationen: Bruchpixel, Rotation und Skalierung erlaubt; Nearest-Neighbor bleibt aktiv."}
      </p>
      <div
        key={`${scene.generationId}:${layer.partId}:${state.formVersion}`}
        className={styles.transformGrid}
      >
        <NumberField
          {...common}
          label="Position X"
          value={layer.position.x}
          onChange={(x) =>
            controller.updateLayer(layer.partId, { position: { ...layer.position, x } })
          }
        />
        <NumberField
          {...common}
          label="Position Y"
          value={layer.position.y}
          onChange={(y) =>
            controller.updateLayer(layer.partId, { position: { ...layer.position, y } })
          }
        />
        <NumberField
          {...common}
          label="Pivot X"
          value={layer.pivot.x}
          onChange={(x) => controller.updateLayer(layer.partId, { pivot: { ...layer.pivot, x } })}
        />
        <NumberField
          {...common}
          label="Pivot Y"
          value={layer.pivot.y}
          onChange={(y) => controller.updateLayer(layer.partId, { pivot: { ...layer.pivot, y } })}
        />
        <NumberField
          {...common}
          label="Rotation in Grad"
          value={layer.rotationDeg}
          disabled={disabled || scene.pixelSnap}
          min={-360_000}
          max={360_000}
          step="any"
          onChange={(rotationDeg) => controller.updateLayer(layer.partId, { rotationDeg })}
        />
        <NumberField
          {...common}
          label="Skalierung X"
          value={layer.scale.x}
          disabled={disabled || scene.pixelSnap}
          min={0.01}
          max={100}
          step="any"
          onChange={(x) => controller.updateLayer(layer.partId, { scale: { ...layer.scale, x } })}
        />
        <NumberField
          {...common}
          label="Skalierung Y"
          value={layer.scale.y}
          disabled={disabled || scene.pixelSnap}
          min={0.01}
          max={100}
          step="any"
          onChange={(y) => controller.updateLayer(layer.partId, { scale: { ...layer.scale, y } })}
        />
      </div>
    </section>
  );
}
