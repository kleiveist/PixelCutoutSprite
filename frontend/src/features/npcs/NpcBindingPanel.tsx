import type { NpcBindingView } from "../../api/npc-client";
import type { Direction, LocalOverride, RevisionRef } from "../../domain";

const directions: readonly Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

interface NpcBindingPanelProps {
  view: NpcBindingView;
  slots: readonly string[];
  selectedDirection: Direction;
  overrides: readonly LocalOverride[];
  dirty: boolean;
  busy: boolean;
  readOnly: boolean;
  onOverridesChange: (overrides: LocalOverride[]) => void;
  onSaveOverrides: (overrides: LocalOverride[]) => void;
  onAdopt: (templateRef: RevisionRef) => void;
  onReview: () => void;
  onKeepCurrent: () => void;
}

export function NpcBindingPanel({
  view,
  slots,
  selectedDirection,
  overrides,
  dirty,
  busy,
  readOnly,
  onOverridesChange,
  onSaveOverrides,
  onAdopt,
  onReview,
  onKeepCurrent,
}: NpcBindingPanelProps) {
  const duplicateRows = duplicateOverrideRows(overrides);
  const duplicateErrorId = `npc-${view.binding.id}-duplicate-overrides`;
  const selectedDirectionAvailable = view.covered_directions.includes(selectedDirection);
  const comparison = view.revision_offer?.comparison;

  function addOverride(): void {
    const pair = slots
      .flatMap((slot) => directions.map((direction) => ({ slot, direction })))
      .find(
        (candidate) =>
          !overrides.some(
            (override) =>
              override.slot_id === candidate.slot && override.direction === candidate.direction,
          ),
      );
    if (!pair) return;
    onOverridesChange([
      ...overrides,
      {
        slot_id: pair.slot,
        direction: pair.direction,
        transform: { offset_px: [0, 0], rotation_deg: 0 },
      },
    ]);
  }

  function updateOverride(index: number, next: LocalOverride): void {
    onOverridesChange(overrides.map((item, itemIndex) => (itemIndex === index ? next : item)));
  }

  return (
    <article className="npc-binding-panel">
      <header>
        <div>
          <span className="npc-action-key">{view.binding.action_key}</span>
          <h3>{view.template_name}</h3>
        </div>
        <span className={`npc-status npc-status-${view.binding.review_state}`}>
          {view.binding.review_state}
        </span>
      </header>
      <dl className="npc-binding-facts">
        <div>
          <dt>Pinned release</dt>
          <dd>r{view.binding.template_ref.revision}</dd>
        </div>
        <div>
          <dt>Direction coverage</dt>
          <dd>{view.covered_directions.map((direction) => direction.toUpperCase()).join(" · ")}</dd>
        </div>
        <div>
          <dt>Missing</dt>
          <dd>
            {view.missing_directions.length === 0
              ? "None"
              : view.missing_directions.map((direction) => direction.toUpperCase()).join(" · ")}
          </dd>
        </div>
        <div>
          <dt>Selected direction</dt>
          <dd>
            {selectedDirection.toUpperCase()} ·{" "}
            {selectedDirectionAvailable ? "available" : "missing"}
          </dd>
        </div>
      </dl>
      <p className="npc-scope-note">
        Binding-local edit: fitting and motion corrections below affect only this NPC action. The
        shared appearance and immutable motion template stay unchanged.
      </p>
      <div className="npc-overrides">
        <div className="npc-section-heading">
          <strong>Local corrections</strong>
          <button
            type="button"
            disabled={
              busy ||
              readOnly ||
              slots.length === 0 ||
              overrides.length >= slots.length * directions.length
            }
            onClick={addOverride}
          >
            Add correction
          </button>
        </div>
        {overrides.length === 0 ? (
          <p>No binding-local corrections.</p>
        ) : (
          overrides.map((override, index) => {
            const labelPrefix = `${view.binding.action_key} correction ${index + 1}`;
            const invalid = duplicateRows.has(index);
            return (
              <div className="npc-override-row" key={`${view.binding.id}-override-${index}`}>
                <label>
                  Slot
                  <select
                    aria-describedby={invalid ? duplicateErrorId : undefined}
                    aria-invalid={invalid || undefined}
                    aria-label={`${labelPrefix} slot`}
                    value={override.slot_id}
                    disabled={busy || readOnly}
                    onChange={(event) =>
                      updateOverride(index, { ...override, slot_id: event.target.value })
                    }
                  >
                    {slots.map((slot) => (
                      <option
                        value={slot}
                        key={slot}
                        disabled={targetInUse(overrides, slot, override.direction, index)}
                      >
                        {slot}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    aria-describedby={invalid ? duplicateErrorId : undefined}
                    aria-invalid={invalid || undefined}
                    aria-label={`${labelPrefix} direction`}
                    value={override.direction}
                    disabled={busy || readOnly}
                    onChange={(event) =>
                      updateOverride(index, {
                        ...override,
                        direction: event.target.value as Direction,
                      })
                    }
                  >
                    {directions.map((direction) => (
                      <option
                        value={direction}
                        key={direction}
                        disabled={targetInUse(overrides, override.slot_id, direction, index)}
                      >
                        {direction.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberField
                  label="Offset X"
                  accessibleLabel={`${labelPrefix} offset X`}
                  value={override.transform.offset_px[0]}
                  disabled={busy || readOnly}
                  onChange={(value) =>
                    updateOverride(index, {
                      ...override,
                      transform: {
                        ...override.transform,
                        offset_px: [value, override.transform.offset_px[1]],
                      },
                    })
                  }
                />
                <NumberField
                  label="Offset Y"
                  accessibleLabel={`${labelPrefix} offset Y`}
                  value={override.transform.offset_px[1]}
                  disabled={busy || readOnly}
                  onChange={(value) =>
                    updateOverride(index, {
                      ...override,
                      transform: {
                        ...override.transform,
                        offset_px: [override.transform.offset_px[0], value],
                      },
                    })
                  }
                />
                <NumberField
                  label="Rotation"
                  accessibleLabel={`${labelPrefix} rotation`}
                  value={override.transform.rotation_deg}
                  step={0.5}
                  disabled={busy || readOnly}
                  onChange={(value) =>
                    updateOverride(index, {
                      ...override,
                      transform: { ...override.transform, rotation_deg: value },
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove ${override.slot_id} ${override.direction} correction`}
                  disabled={busy || readOnly}
                  onClick={() => onOverridesChange(overrides.filter((_, item) => item !== index))}
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
        {duplicateRows.size > 0 && (
          <p className="npc-inline-error" id={duplicateErrorId} role="alert">
            Each local correction needs a unique slot and direction combination.
          </p>
        )}
        <button
          type="button"
          className="npc-save-overrides"
          disabled={busy || readOnly || !dirty || duplicateRows.size > 0}
          onClick={() => onSaveOverrides([...overrides])}
        >
          Save local corrections
        </button>
      </div>
      {view.revision_offer && (
        <div className="npc-revision-offer">
          <strong>New release r{view.revision_offer.template_ref.revision} available</strong>
          <p>
            {view.revision_offer.compatibility === "compatible"
              ? "Profile, directions, local overrides, and retained equipment frames are compatible."
              : view.revision_offer.reason}
          </p>
          {comparison && (
            <dl className="npc-revision-comparison" aria-label="Release comparison">
              <div>
                <dt>Timeline</dt>
                <dd>
                  r{view.binding.template_ref.revision}: {comparison.current_frame_count} frames at{" "}
                  {comparison.current_fps} FPS
                  <br />r{view.revision_offer.template_ref.revision}:{" "}
                  {comparison.candidate_frame_count} frames at {comparison.candidate_fps} FPS
                </dd>
              </div>
              <div>
                <dt>Direction coverage</dt>
                <dd>
                  Current: {formatDirections(comparison.current_covered_directions)}
                  <br />
                  Candidate: {formatDirections(comparison.candidate_covered_directions)}
                </dd>
              </div>
              <div>
                <dt>Local corrections retained</dt>
                <dd>{comparison.retained_local_override_count}</dd>
              </div>
            </dl>
          )}
          <div>
            <button type="button" disabled={busy} onClick={onKeepCurrent}>
              Keep r{view.binding.template_ref.revision}
            </button>
            <button
              type="button"
              disabled={
                busy || readOnly || dirty || view.revision_offer.compatibility === "incompatible"
              }
              onClick={() => onAdopt(view.revision_offer!.template_ref)}
            >
              Adopt r{view.revision_offer.template_ref.revision}
            </button>
          </div>
        </div>
      )}
      <button
        type="button"
        disabled={busy || readOnly || dirty || view.binding.review_state === "reviewed"}
        onClick={onReview}
      >
        Mark binding reviewed
      </button>
    </article>
  );
}

function NumberField({
  label,
  accessibleLabel,
  value,
  step = 1,
  disabled = false,
  onChange,
}: {
  label: string;
  accessibleLabel: string;
  value: number;
  step?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={accessibleLabel}
        type="number"
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function targetInUse(
  overrides: readonly LocalOverride[],
  slot: string,
  direction: Direction,
  exceptIndex: number,
): boolean {
  return overrides.some(
    (override, index) =>
      index !== exceptIndex && override.slot_id === slot && override.direction === direction,
  );
}

function duplicateOverrideRows(overrides: readonly LocalOverride[]): ReadonlySet<number> {
  const firstRows = new Map<string, number>();
  const duplicates = new Set<number>();
  overrides.forEach((override, index) => {
    const key = `${override.slot_id}\u0000${override.direction}`;
    const first = firstRows.get(key);
    if (first === undefined) firstRows.set(key, index);
    else {
      duplicates.add(first);
      duplicates.add(index);
    }
  });
  return duplicates;
}

function formatDirections(values: readonly Direction[]): string {
  return values.length === 0
    ? "none"
    : values.map((direction) => direction.toUpperCase()).join(" · ");
}
