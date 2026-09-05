import type { OutfitEditorContext } from "../../api/outfit-client";
import type {
  AssetFallbackApproval,
  Direction,
  OutfitFitting,
  PixelPoint,
  SpriteVariantFitting,
  Transform2D,
} from "../../domain";
import { directions, missingRequiredSlots } from "./outfit-state";
import { assetKey, type EditScope } from "./outfit-utils";

export function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}>
      {children}
    </button>
  );
}

export function InventoryMode({
  inventory,
  selected,
  onToggle,
  onImport,
}: {
  inventory: OutfitEditorContext["inventory"];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onImport?: () => void;
}) {
  return (
    <section aria-labelledby="outfit-inventory-title">
      <div className="outfit-panel-heading">
        <div>
          <span>Area sources</span>
          <h2 id="outfit-inventory-title">Inventory</h2>
        </div>
        {onImport && (
          <button type="button" onClick={onImport}>
            Import PNG or package…
          </button>
        )}
      </div>
      <AssetChoices inventory={inventory} selected={selected} onToggle={onToggle} />
    </section>
  );
}

export function DressMode({
  inventory,
  selected,
  missing,
  saveState,
  fallbackOptions,
  onToggle,
  onAutoAssign,
  onApproveFallback,
}: {
  inventory: OutfitEditorContext["inventory"];
  selected: Set<string>;
  missing: ReturnType<typeof missingRequiredSlots>;
  saveState: string;
  fallbackOptions: AssetFallbackApproval[];
  onToggle: (key: string) => void;
  onAutoAssign: () => void;
  onApproveFallback: (approval: AssetFallbackApproval) => void;
}) {
  return (
    <section aria-labelledby="dress-title">
      <div className="outfit-panel-heading">
        <div>
          <span>Confirmed slot metadata</span>
          <h2 id="dress-title">Dress</h2>
        </div>
        <button
          type="button"
          className="primary-button"
          disabled={selected.size === 0 || saveState !== "saved"}
          onClick={onAutoAssign}
        >
          Auto-assign selected images
        </button>
      </div>
      {saveState !== "saved" && (
        <p>Save current fitting edits before running another assignment command.</p>
      )}
      <MissingParts
        missing={missing}
        fallbackOptions={fallbackOptions}
        onApproveFallback={onApproveFallback}
      />
      <AssetChoices inventory={inventory} selected={selected} onToggle={onToggle} />
    </section>
  );
}

function AssetChoices({
  inventory,
  selected,
  onToggle,
}: {
  inventory: OutfitEditorContext["inventory"];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  if (inventory.length === 0) return <p>No compatible imported PNGs are available.</p>;
  return (
    <div className="outfit-assets">
      {inventory.map((item) => {
        const key = assetKey(item.asset);
        return (
          <label key={key} className={selected.has(key) ? "is-selected" : ""}>
            <input
              type="checkbox"
              aria-label={`Select ${item.name} (${item.direction.toUpperCase()})`}
              disabled={!item.assignable}
              checked={selected.has(key)}
              onChange={() => onToggle(key)}
            />
            <strong>{item.name}</strong>
            <span>
              {item.asset.slot_id} · {item.direction.toUpperCase()} · {item.asset_kind}
            </span>
            <small>
              pivot {item.pivot_px[0]}, {item.pivot_px[1]} · r{item.asset.revision}
              {!item.assignable && " · pinned (not assignable)"}
            </small>
          </label>
        );
      })}
    </div>
  );
}

function MissingParts({
  missing,
  fallbackOptions,
  onApproveFallback,
}: {
  missing: ReturnType<typeof missingRequiredSlots>;
  fallbackOptions: AssetFallbackApproval[];
  onApproveFallback: (approval: AssetFallbackApproval) => void;
}) {
  if (missing.length === 0)
    return <p className="outfit-complete">All required slot directions are assigned.</p>;
  return (
    <section className="outfit-missing" aria-labelledby="missing-parts-title">
      <h3 id="missing-parts-title">Missing required parts</h3>
      <ul>
        {missing.map((item) => (
          <li key={item.slot_id}>
            <span aria-hidden="true" className="missing-placeholder" />
            <strong>{item.slot_id}</strong>
            {item.missing_directions.length > 0 && (
              <span>
                : directions{" "}
                {item.missing_directions.map((value) => value.toUpperCase()).join(", ")}
              </span>
            )}
            {item.missing_variants.length > 0 && (
              <span>
                {item.missing_directions.length > 0 ? "; " : ": "}sprite variants{" "}
                {item.missing_variants
                  .map((value) => `${value.direction.toUpperCase()}/${value.variant}`)
                  .join(", ")}
              </span>
            )}
            <span className="outfit-fallback-actions">
              {fallbackOptions
                .filter(
                  (option) =>
                    option.slot_id === item.slot_id &&
                    item.missing_directions.includes(option.target_direction),
                )
                .map((option) => (
                  <button
                    key={`${option.target_direction}:${option.variant}`}
                    type="button"
                    onClick={() => onApproveFallback(option)}
                  >
                    Allow {option.target_direction.toUpperCase()}
                    {option.variant === "base" ? "" : `/${option.variant}`} mirror from{" "}
                    {option.source_direction.toUpperCase()}
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function FineTuneMode({
  context,
  slotId,
  direction,
  scope,
  affectedBindingCount,
  fit,
  spriteVariants,
  spriteVariant,
  variantFit,
  variantUsesBase,
  transform,
  exactAssets,
  onSlot,
  onDirection,
  onSpriteVariant,
  onScope,
  onImage,
  onPivot,
  onTransform,
  onVisible,
  onLayer,
  onOpenDummy,
}: {
  context: OutfitEditorContext;
  slotId: string;
  direction: Direction;
  scope: EditScope;
  affectedBindingCount: number;
  fit: OutfitFitting | undefined;
  spriteVariants: string[];
  spriteVariant: string | null;
  variantFit: SpriteVariantFitting | undefined;
  variantUsesBase: boolean;
  transform: Transform2D;
  exactAssets: OutfitEditorContext["inventory"];
  onSlot: (value: string) => void;
  onDirection: (value: Direction) => void;
  onSpriteVariant: (value: string | null) => void;
  onScope: (value: EditScope) => void;
  onImage: (value: string) => void;
  onPivot: (value: PixelPoint) => void;
  onTransform: (value: Transform2D) => void;
  onVisible: (value: boolean) => void;
  onLayer: (value: number) => void;
  onOpenDummy: () => void;
}) {
  const selectedImage = spriteVariant !== null && !variantUsesBase ? variantFit : fit;
  return (
    <section aria-labelledby="fine-tune-title">
      <div className="outfit-panel-heading">
        <div>
          <span>Slot-local correction</span>
          <h2 id="fine-tune-title">Fine tune</h2>
        </div>
        <button type="button" onClick={onOpenDummy}>
          Edit reusable motion in dummy
        </button>
      </div>
      <div className="outfit-scope-note">
        <strong>Change scope</strong>
        <p>
          Template motion affects multiple NPCs and stays in the dummy editor. Choose whether this
          correction belongs to the shared NPC appearance or only this animation binding.
        </p>
        <p>
          Shared appearance changes can affect {affectedBindingCount}{" "}
          {affectedBindingCount === 1 ? "animation binding" : "animation bindings"}.
        </p>
        <label>
          Edit scope
          <select value={scope} onChange={(event) => onScope(event.target.value as EditScope)}>
            <option value="appearance">Shared NPC appearance</option>
            <option value="binding">Only this motion binding</option>
          </select>
        </label>
      </div>
      <div className="outfit-form-grid">
        <label>
          Slot
          <select value={slotId} onChange={(event) => onSlot(event.target.value)}>
            {context.profile.slots.map((slot) => (
              <option key={slot.id}>{slot.id}</option>
            ))}
          </select>
        </label>
        <label>
          Direction
          <select
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
        <label>
          Sprite variant
          <select
            value={spriteVariant ?? ""}
            onChange={(event) => onSpriteVariant(event.target.value || null)}
          >
            <option value="">Default image</option>
            {spriteVariants.map((variant) => (
              <option key={variant} value={variant}>
                {variant}
              </option>
            ))}
          </select>
        </label>
        <label>
          Image
          <select
            disabled={
              scope === "binding" || exactAssets.length === 0 || (spriteVariant !== null && !fit)
            }
            value={selectedImage ? assetKey(selectedImage.asset) : ""}
            onChange={(event) => onImage(event.target.value)}
          >
            <option value="">{exactAssets.length ? "Choose image" : "No compatible image"}</option>
            {exactAssets.map((item) => (
              <option key={assetKey(item.asset)} value={assetKey(item.asset)}>
                {item.name} · r{item.asset.revision}
                {!item.assignable && " · pinned (not assignable)"}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          label="Pivot X"
          disabled={scope === "binding" || !selectedImage}
          value={selectedImage?.pivot_px[0] ?? 0}
          onChange={(value) => onPivot([value, selectedImage?.pivot_px[1] ?? 0])}
        />
        <NumberField
          label="Pivot Y"
          disabled={scope === "binding" || !selectedImage}
          value={selectedImage?.pivot_px[1] ?? 0}
          onChange={(value) => onPivot([selectedImage?.pivot_px[0] ?? 0, value])}
        />
        <NumberField
          label="Local offset X"
          disabled={!fit}
          value={transform.offset_px[0]}
          onChange={(value) =>
            onTransform({ ...transform, offset_px: [value, transform.offset_px[1]] })
          }
        />
        <NumberField
          label="Local offset Y"
          disabled={!fit}
          value={transform.offset_px[1]}
          onChange={(value) =>
            onTransform({ ...transform, offset_px: [transform.offset_px[0], value] })
          }
        />
        <NumberField
          label="Rigid correction rotation"
          disabled={!fit}
          value={transform.rotation_deg}
          step={0.25}
          onChange={(value) => onTransform({ ...transform, rotation_deg: value })}
        />
        <NumberField
          label="Layer correction"
          disabled={scope === "binding" || !fit}
          value={fit?.layer_delta ?? 0}
          min={-64}
          max={64}
          onChange={onLayer}
        />
        <label className="outfit-checkbox">
          <input
            type="checkbox"
            disabled={scope === "binding" || !fit}
            checked={fit?.visible ?? false}
            onChange={(event) => onVisible(event.target.checked)}
          />
          Visible in output
        </label>
      </div>
      {!fit && (
        <p role="status">Assign an image for this slot and direction before fine tuning it.</p>
      )}
      {fit && spriteVariant !== null && !selectedImage && (
        <p role="status">Sprite variant {spriteVariant} has no image for this direction.</p>
      )}
      <p className="outfit-transform-order">
        parent × profile × motion → appearance fitting × binding override × pivot
      </p>
    </section>
  );
}

function NumberField({
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
