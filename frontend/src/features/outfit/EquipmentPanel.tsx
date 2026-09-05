import { useState } from "react";

import type { OutfitAssetOption } from "../../api/outfit-client";
import type { Direction, Equipment, EquipmentPart, Transform2D } from "../../domain";
import {
  assignEquipmentImage,
  createEquipmentFromInventory,
  equipmentParts,
  equipmentStateLabel,
  fitForEquipmentPart,
  isEquipmentAsset,
  missingEquipmentDirections,
  motionKeyTransform,
  motionTrackFor,
  removeEquipmentMotionKey,
  setEquipmentMotionKey,
  setEquipmentTrackEnabled,
  setEquipmentTrackInterpolation,
  updateEquipmentFit,
  updateEquipmentPart,
} from "./equipment-state";
import { directions } from "./outfit-state";
import { assetKey } from "./outfit-utils";

export function EquipmentPanel({
  inventory,
  selected,
  equipment,
  direction,
  frame,
  onDirection,
  onChange,
  onClearSelection,
}: {
  inventory: OutfitAssetOption[];
  selected: Set<string>;
  equipment: Equipment[];
  direction: Direction;
  frame: number;
  onDirection: (value: Direction) => void;
  onChange: (value: Equipment[]) => void;
  onClearSelection: () => void;
}) {
  const [name, setName] = useState("New equipment");
  const [selectedEquipmentId, setSelectedEquipmentId] = useState("");
  const [selectedPartId, setSelectedPartId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selectedOptions = inventory.filter(
    (option) =>
      isEquipmentAsset(option) && option.assignable && selected.has(assetKey(option.asset)),
  );
  const selectedEquipment =
    equipment.find((item) => item.id === selectedEquipmentId) ?? equipment[0];
  const parts = selectedEquipment ? equipmentParts(selectedEquipment) : [];
  const selectedPart = parts.find((part) => part.id === selectedPartId) ?? parts[0];

  function createEquipment(): void {
    try {
      const item = createEquipmentFromInventory(name, selectedOptions);
      onChange([...equipment, item]);
      setSelectedEquipmentId(item.id);
      setSelectedPartId(item.id);
      setError(null);
      onClearSelection();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }

  function changePart(update: (part: EquipmentPart) => EquipmentPart): void {
    if (!selectedEquipment || !selectedPart) return;
    onChange(updateEquipmentPart(equipment, selectedEquipment.id, selectedPart.id, update));
  }

  const fit = selectedPart ? fitForEquipmentPart(selectedPart, direction) : undefined;
  const track = selectedPart ? motionTrackFor(selectedPart, direction) : undefined;
  const motionTransform = selectedPart
    ? motionKeyTransform(selectedPart, direction, frame)
    : identityTransform();
  const exactMotionKey = track?.keys.find((key) => key.frame === frame);
  const selectedFitAssetKey = fit?.asset ? assetKey(fit.asset) : null;
  const exactImages = selectedPart
    ? inventory.filter(
        (option) =>
          isEquipmentAsset(option) &&
          option.asset.slot_id === selectedPart.anchor_slot &&
          option.direction === direction &&
          (option.assignable || assetKey(option.asset) === selectedFitAssetKey),
      )
    : [];

  return (
    <section className="equipment-panel" aria-labelledby="equipment-panel-title">
      <div className="outfit-panel-heading">
        <div>
          <span>Rigid optional layers</span>
          <h2 id="equipment-panel-title">Equipment</h2>
        </div>
        <span className="equipment-count">{equipment.length} objects</span>
      </div>
      <p className="equipment-rigid-warning">
        Large garments are not deformed across joints. Select multiple segmented images to build one
        equipment object from independently attached rigid pieces; no mesh or skinning is
        introduced.
      </p>
      <div className="equipment-create-row">
        <label>
          Equipment name
          <input value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
        </label>
        <button
          type="button"
          className="primary-button"
          disabled={selectedOptions.length === 0 || name.trim() !== name || name.length === 0}
          onClick={createEquipment}
        >
          Create from selected equipment images ({selectedOptions.length})
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {inventory.some(isEquipmentAsset) ? (
        <p className="equipment-help">
          Select armour, accessory, or equipment cards above. Images sharing a slot become one
          directional piece; different slots become segments of the same object.
        </p>
      ) : (
        <p>No armour, accessory, or equipment images are available in this area.</p>
      )}
      {!selectedEquipment || !selectedPart ? (
        <p>No equipment object has been added to this draft.</p>
      ) : (
        <EquipmentInspector
          equipment={equipment}
          selectedEquipment={selectedEquipment}
          selectedPart={selectedPart}
          parts={parts}
          direction={direction}
          frame={frame}
          fit={fit}
          track={track}
          motionTransform={motionTransform}
          exactMotionKey={Boolean(exactMotionKey)}
          exactImages={exactImages}
          onEquipment={(id) => {
            setSelectedEquipmentId(id);
            setSelectedPartId("");
          }}
          onPart={setSelectedPartId}
          onDirection={onDirection}
          onChange={changePart}
        />
      )}
    </section>
  );
}

function EquipmentInspector({
  equipment,
  selectedEquipment,
  selectedPart,
  parts,
  direction,
  frame,
  fit,
  track,
  motionTransform,
  exactMotionKey,
  exactImages,
  onEquipment,
  onPart,
  onDirection,
  onChange,
}: {
  equipment: Equipment[];
  selectedEquipment: Equipment;
  selectedPart: EquipmentPart;
  parts: ReturnType<typeof equipmentParts>;
  direction: Direction;
  frame: number;
  fit: ReturnType<typeof fitForEquipmentPart>;
  track: ReturnType<typeof motionTrackFor>;
  motionTransform: Transform2D;
  exactMotionKey: boolean;
  exactImages: OutfitAssetOption[];
  onEquipment: (id: string) => void;
  onPart: (id: string) => void;
  onDirection: (value: Direction) => void;
  onChange: (update: (part: EquipmentPart) => EquipmentPart) => void;
}) {
  const missing = missingEquipmentDirections(selectedPart);
  const changeFit = (update: NonNullable<typeof fit>) =>
    onChange((part) => updateEquipmentFit(part, direction, () => update));
  const changeMotion = (transform: Transform2D) =>
    onChange((part) => setEquipmentMotionKey(part, direction, frame, transform));

  return (
    <div className="equipment-inspector">
      <div className="outfit-form-grid">
        <label>
          Equipment object
          <select
            aria-label="Equipment object"
            value={selectedEquipment.id}
            onChange={(event) => onEquipment(event.target.value)}
          >
            {equipment.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Rigid piece
          <select
            aria-label="Rigid piece"
            value={selectedPart.id}
            onChange={(event) => onPart(event.target.value)}
          >
            {parts.map((part) => (
              <option key={part.id} value={part.id}>
                {part.name} · {part.anchor_slot}
              </option>
            ))}
          </select>
        </label>
        <label>
          Equipment direction
          <select
            aria-label="Equipment direction"
            value={direction}
            onChange={(event) => onDirection(event.target.value as Direction)}
          >
            {directions.map((value) => (
              <option key={value} value={value}>
                {value.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="equipment-state" role="status">
        {equipmentStateLabel(selectedPart)}
      </p>
      <div className="equipment-state-grid">
        <label className="outfit-checkbox">
          <input
            type="checkbox"
            checked={selectedPart.enabled}
            onChange={(event) => onChange((part) => ({ ...part, enabled: event.target.checked }))}
          />
          Equipment enabled
        </label>
        <label>
          Follow mode
          <select
            aria-label="Follow mode"
            value={selectedPart.follow_mode === "slot" ? "slot" : "root"}
            onChange={(event) =>
              onChange((part) => ({
                ...part,
                follow_mode: event.target.value as "slot" | "root",
              }))
            }
          >
            <option value="slot">Body slot ({selectedPart.anchor_slot})</option>
            <option value="root">Figure root</option>
          </select>
        </label>
        <label className="outfit-checkbox">
          <input
            type="checkbox"
            checked={selectedPart.own_motion_enabled}
            onChange={(event) =>
              onChange((part) => ({ ...part, own_motion_enabled: event.target.checked }))
            }
          />
          Own motion enabled
        </label>
      </div>
      <p>
        {missing.length === 0
          ? "All eight direction images are assigned."
          : `Missing direction images: ${missing.map((value) => value.toUpperCase()).join(", ")}`}
      </p>
      <div className="outfit-form-grid">
        <label>
          Equipment image
          <select
            aria-label="Equipment image"
            value={fit?.asset ? assetKey(fit.asset) : ""}
            onChange={(event) => {
              const option = exactImages.find(
                (candidate) => assetKey(candidate.asset) === event.target.value,
              );
              if (option) onChange((part) => assignEquipmentImage(part, option));
            }}
          >
            <option value="">{exactImages.length ? "Choose image" : "No compatible image"}</option>
            {exactImages.map((option) => (
              <option
                key={assetKey(option.asset)}
                value={assetKey(option.asset)}
                disabled={!option.assignable}
              >
                {option.name} · {option.variant} · r{option.asset.revision}
                {!option.assignable ? " · pinned only" : ""}
              </option>
            ))}
          </select>
        </label>
        <EquipmentNumber
          label="Equipment pivot X"
          disabled={!fit}
          value={fit?.pivot_px?.[0] ?? 0}
          onChange={(value) =>
            fit && changeFit({ ...fit, pivot_px: [value, fit.pivot_px?.[1] ?? 0] })
          }
        />
        <EquipmentNumber
          label="Equipment pivot Y"
          disabled={!fit}
          value={fit?.pivot_px?.[1] ?? 0}
          onChange={(value) =>
            fit && changeFit({ ...fit, pivot_px: [fit.pivot_px?.[0] ?? 0, value] })
          }
        />
        <EquipmentNumber
          label="Equipment local offset X"
          disabled={!fit}
          value={fit?.transform.offset_px[0] ?? 0}
          onChange={(value) =>
            fit &&
            changeFit({
              ...fit,
              transform: {
                ...fit.transform,
                offset_px: [value, fit.transform.offset_px[1]],
              },
            })
          }
        />
        <EquipmentNumber
          label="Equipment local offset Y"
          disabled={!fit}
          value={fit?.transform.offset_px[1] ?? 0}
          onChange={(value) =>
            fit &&
            changeFit({
              ...fit,
              transform: {
                ...fit.transform,
                offset_px: [fit.transform.offset_px[0], value],
              },
            })
          }
        />
        <EquipmentNumber
          label="Equipment rigid rotation"
          disabled={!fit}
          value={fit?.transform.rotation_deg ?? 0}
          step={0.25}
          onChange={(value) =>
            fit && changeFit({ ...fit, transform: { ...fit.transform, rotation_deg: value } })
          }
        />
        <EquipmentNumber
          label="Equipment layer"
          disabled={!fit}
          min={-64}
          max={64}
          value={fit?.layer_delta ?? 0}
          onChange={(value) => fit && changeFit({ ...fit, layer_delta: value })}
        />
        <label className="outfit-checkbox">
          <input
            type="checkbox"
            disabled={!fit}
            checked={fit?.visible ?? false}
            onChange={(event) => fit && changeFit({ ...fit, visible: event.target.checked })}
          />
          Direction visible
        </label>
      </div>
      <fieldset className="equipment-motion-controls" disabled={!selectedPart.own_motion_enabled}>
        <legend>Own transform track · {direction.toUpperCase()}</legend>
        {!selectedPart.own_motion_enabled && (
          <p>Enable own motion to edit these controls. Stored tracks are retained.</p>
        )}
        <label className="outfit-checkbox">
          <input
            type="checkbox"
            checked={track?.enabled ?? false}
            onChange={(event) =>
              onChange((part) =>
                setEquipmentTrackEnabled(part, direction, frame, event.target.checked),
              )
            }
          />
          Direction track enabled
        </label>
        <div className="outfit-form-grid">
          <label>
            Track interpolation
            <select
              aria-label="Track interpolation"
              disabled={!track?.enabled}
              value={track?.interpolation ?? "linear"}
              onChange={(event) =>
                onChange((part) =>
                  setEquipmentTrackInterpolation(
                    part,
                    direction,
                    event.target.value as "linear" | "hold" | "ease_in_out",
                  ),
                )
              }
            >
              <option value="linear">Linear</option>
              <option value="hold">Hold</option>
              <option value="ease_in_out">Ease in/out</option>
            </select>
          </label>
          <EquipmentNumber
            label="Own offset X"
            disabled={!track?.enabled}
            value={motionTransform.offset_px[0]}
            onChange={(value) =>
              changeMotion({
                ...motionTransform,
                offset_px: [value, motionTransform.offset_px[1]],
              })
            }
          />
          <EquipmentNumber
            label="Own offset Y"
            disabled={!track?.enabled}
            value={motionTransform.offset_px[1]}
            onChange={(value) =>
              changeMotion({
                ...motionTransform,
                offset_px: [motionTransform.offset_px[0], value],
              })
            }
          />
          <EquipmentNumber
            label="Own rotation"
            disabled={!track?.enabled}
            value={motionTransform.rotation_deg}
            step={0.25}
            onChange={(value) => changeMotion({ ...motionTransform, rotation_deg: value })}
          />
        </div>
        <div className="equipment-key-row">
          <span>
            {exactMotionKey ? `Key at frame ${frame + 1}` : `No key at frame ${frame + 1}`}
          </span>
          <button
            type="button"
            disabled={!track?.enabled || !exactMotionKey || track.keys.length === 1}
            onClick={() => onChange((part) => removeEquipmentMotionKey(part, direction, frame))}
          >
            Remove current key
          </button>
        </div>
      </fieldset>
    </div>
  );
}

function EquipmentNumber({
  label,
  value,
  disabled,
  min = -2048,
  max = 2048,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        aria-label={label}
        value={value}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function identityTransform(): Transform2D {
  return { offset_px: [0, 0], rotation_deg: 0 };
}
