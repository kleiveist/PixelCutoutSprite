import { useEffect, useMemo, useState, type FormEvent } from "react";

import type { NpcBindingView, NpcView, ReleasedMotionOption } from "../../api/npc-client";
import type { Direction, LocalOverride, RevisionRef } from "../../domain";
import { NpcBindingPanel } from "./NpcBindingPanel";

const directions: readonly Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

interface NpcDetailProps {
  npc: NpcView | null;
  selectedBindingId: string | null;
  overrideDrafts: Readonly<Record<string, readonly LocalOverride[]>>;
  hasDirtyDrafts: boolean;
  busy: boolean;
  readOnly: boolean;
  onBindingSelect: (bindingId: string) => void;
  onOverridesChange: (view: NpcBindingView, overrides: LocalOverride[]) => void;
  onAddBinding: (motion: ReleasedMotionOption, variantKey: string | null) => void;
  onSaveOverrides: (view: NpcBindingView, overrides: LocalOverride[]) => void;
  onAdopt: (view: NpcBindingView, templateRef: RevisionRef) => void;
  onReviewBinding: (view: NpcBindingView) => void;
  onReviewNpc: () => void;
  onDuplicate: (name: string) => void;
  onRename: (name: string) => void;
  onKeepCurrent: (view: NpcBindingView) => void;
  onExport: (bindingId: string | null) => void;
}

export function NpcDetail({
  npc,
  selectedBindingId,
  overrideDrafts,
  hasDirtyDrafts,
  busy,
  readOnly,
  onBindingSelect,
  onOverridesChange,
  onAddBinding,
  onSaveOverrides,
  onAdopt,
  onReviewBinding,
  onReviewNpc,
  onDuplicate,
  onRename,
  onKeepCurrent,
  onExport,
}: NpcDetailProps) {
  const [selectedMotion, setSelectedMotion] = useState("");
  const [directionSelection, setDirectionSelection] = useState<{
    contextKey: string | null;
    direction: Direction;
  }>({ contextKey: null, direction: "s" });
  const [variantKey, setVariantKey] = useState("");
  const [rename, setRename] = useState("");
  const [duplicate, setDuplicate] = useState("");

  useEffect(() => {
    setSelectedMotion("");
    setVariantKey("");
    setRename(npc?.character.name ?? "");
    setDuplicate(npc ? `${npc.character.name} Copy` : "");
  }, [npc?.character.id, npc?.character.name]);

  const motion = useMemo(
    () => npc?.motion_options.find((option) => motionKey(option.template_ref) === selectedMotion),
    [npc, selectedMotion],
  );
  const activeBinding = useMemo(
    () =>
      npc?.bindings.find((view) => view.binding.id === selectedBindingId) ??
      npc?.bindings[0] ??
      null,
    [npc, selectedBindingId],
  );
  const directionContextKey =
    npc && activeBinding ? `${npc.character.id}\u0000${activeBinding.binding.id}` : null;
  const selectedDirection =
    directionSelection.contextKey === directionContextKey ? directionSelection.direction : "s";

  if (!npc) {
    return (
      <section className="npc-detail npc-detail-empty" aria-label="NPC detail">
        <p>Select an NPC to inspect every pinned motion and local correction.</p>
      </section>
    );
  }

  const variantIsValid = variantKey === "" || /^[a-z][a-z0-9_]{0,63}$/.test(variantKey);
  const effectiveAction = variantKey || motion?.default_action_key;
  const actionCollision = npc.bindings.some((view) => view.binding.action_key === effectiveAction);
  const addMotionError = motion?.reason
    ? motion.reason
    : !variantIsValid
      ? "Use lowercase letters, numbers, and underscores."
      : motion && actionCollision
        ? `Action ${effectiveAction} already exists. Enter an explicit variant key.`
        : null;
  const canReviewNpc =
    npc.completeness === "complete" &&
    npc.bindings.length > 0 &&
    npc.bindings.every((view) => view.binding.review_state === "reviewed") &&
    npc.character.status !== "reviewed";

  function submitName(event: FormEvent, value: string, action: (name: string) => void): void {
    event.preventDefault();
    if (value.trim()) action(value);
  }

  return (
    <section className="npc-detail" aria-labelledby="npc-detail-title">
      <header className="npc-detail-header">
        <div>
          <span className="phase-tag">NPC DETAIL</span>
          <h2 id="npc-detail-title">{npc.character.name}</h2>
          <p>{npc.character.description || "No description"}</p>
        </div>
        <div className="npc-detail-statuses">
          <span className={`npc-status npc-status-${npc.character.status}`}>
            {npc.character.status}
          </span>
          <span className={`npc-status npc-status-${npc.export_status}`}>
            {npc.export_status.replaceAll("_", " ")}
          </span>
          <button
            type="button"
            disabled={busy || readOnly || hasDirtyDrafts || npc.bindings.length === 0}
            title={
              readOnly
                ? "Managed export requires a writable vault"
                : hasDirtyDrafts
                  ? "Save or discard local corrections before exporting"
                  : undefined
            }
            onClick={() => onExport(null)}
          >
            Export NPC
          </button>
        </div>
      </header>
      <dl className="npc-overview">
        <div>
          <dt>Labels</dt>
          <dd>{npc.labels.map((label) => label.name).join(" · ") || "None"}</dd>
        </div>
        <div>
          <dt>Required</dt>
          <dd>{npc.character.required_actions.join(" · ") || "None"}</dd>
        </div>
        <div>
          <dt>Missing</dt>
          <dd>{npc.missing_actions.join(" · ") || "None"}</dd>
        </div>
        <div>
          <dt>Effective sources</dt>
          <dd title={npc.effective_source_fingerprint}>
            {npc.effective_source_fingerprint.slice(0, 12)}…
          </dd>
        </div>
      </dl>

      <section className="npc-add-motion" aria-labelledby="npc-add-motion-title">
        <div>
          <span>Add by immutable release</span>
          <h3 id="npc-add-motion-title">Assign another motion</h3>
        </div>
        <label>
          Released motion
          <select
            aria-describedby={motion?.reason ? "npc-add-motion-error" : undefined}
            value={selectedMotion}
            disabled={busy || readOnly}
            onChange={(event) => setSelectedMotion(event.target.value)}
          >
            <option value="">Choose a pinned release…</option>
            {npc.motion_options.map((option) => (
              <option value={motionKey(option.template_ref)} key={motionKey(option.template_ref)}>
                {option.template_name} · r{option.template_ref.revision} · {option.frame_count}{" "}
                frames
                {option.compatibility === "incompatible" ? " · incompatible" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          Variant action key (optional)
          <input
            aria-describedby={addMotionError ? "npc-add-motion-error" : undefined}
            aria-invalid={!variantIsValid || Boolean(motion && actionCollision) || undefined}
            value={variantKey}
            disabled={busy || readOnly}
            placeholder={motion?.default_action_key ?? "template action"}
            onChange={(event) => setVariantKey(event.target.value)}
          />
        </label>
        {addMotionError && (
          <p className="npc-inline-error" id="npc-add-motion-error" role="alert">
            {addMotionError}
          </p>
        )}
        <button
          type="button"
          disabled={
            busy ||
            readOnly ||
            !motion ||
            motion.compatibility === "incompatible" ||
            !variantIsValid ||
            actionCollision
          }
          onClick={() => onAddBinding(motion!, variantKey || null)}
        >
          Assign pinned motion
        </button>
      </section>

      <div className="npc-binding-list">
        <div className="npc-section-heading">
          <h3>All motions</h3>
          <span>{npc.bindings.length} active binding(s)</span>
        </div>
        {npc.bindings.length > 0 && (
          <div className="npc-binding-focus" aria-label="Binding view controls">
            <label>
              Active motion
              <select
                aria-label="Active motion"
                disabled={busy}
                value={activeBinding?.binding.id ?? ""}
                onChange={(event) => onBindingSelect(event.target.value)}
              >
                {npc.bindings.map((view) => (
                  <option value={view.binding.id} key={view.binding.id}>
                    {view.binding.action_key} · {view.template_name} · r
                    {view.binding.template_ref.revision}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Active direction
              <select
                aria-label="Active direction"
                disabled={busy}
                value={selectedDirection}
                onChange={(event) =>
                  setDirectionSelection({
                    contextKey: directionContextKey,
                    direction: event.target.value as Direction,
                  })
                }
              >
                {directions.map((direction) => (
                  <option value={direction} key={direction}>
                    {direction.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <p role="status" aria-live="polite">
              {activeBinding?.covered_directions.includes(selectedDirection)
                ? `${selectedDirection.toUpperCase()} is available for ${activeBinding.binding.action_key}.`
                : `${selectedDirection.toUpperCase()} is missing from ${activeBinding?.binding.action_key ?? "this motion"}.`}
            </p>
            <button
              type="button"
              disabled={busy || readOnly || hasDirtyDrafts}
              onClick={() => onExport(activeBinding?.binding.id ?? null)}
            >
              Export this motion
            </button>
          </div>
        )}
        {activeBinding && (
          <NpcBindingPanel
            key={activeBinding.binding.id}
            view={activeBinding}
            slots={npc.available_slots}
            selectedDirection={selectedDirection}
            overrides={
              overrideDrafts[activeBinding.binding.id] ?? activeBinding.binding.local_overrides
            }
            dirty={overrideDrafts[activeBinding.binding.id] !== undefined}
            busy={busy}
            readOnly={readOnly}
            onOverridesChange={(overrides) => onOverridesChange(activeBinding, overrides)}
            onSaveOverrides={(overrides) => onSaveOverrides(activeBinding, overrides)}
            onAdopt={(templateRef) => onAdopt(activeBinding, templateRef)}
            onReview={() => onReviewBinding(activeBinding)}
            onKeepCurrent={() => onKeepCurrent(activeBinding)}
          />
        )}
      </div>

      <section className="npc-identity-actions" aria-labelledby="npc-identity-title">
        <h3 id="npc-identity-title">Identity and folder</h3>
        <p>
          Rename moves the stable-ID folder transactionally. Duplicate creates new character,
          appearance, and binding IDs while reusing immutable released motions and assets.
        </p>
        <form onSubmit={(event) => submitName(event, rename, onRename)}>
          <label>
            New display name
            <input
              value={rename}
              disabled={busy || readOnly}
              onChange={(event) => setRename(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || readOnly || rename === npc.character.name}>
            Rename NPC and folder
          </button>
        </form>
        <form onSubmit={(event) => submitName(event, duplicate, onDuplicate)}>
          <label>
            Duplicate name
            <input
              value={duplicate}
              disabled={busy || readOnly}
              onChange={(event) => setDuplicate(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy || readOnly || hasDirtyDrafts}>
            Duplicate with shared releases
          </button>
        </form>
        {hasDirtyDrafts && (
          <p className="npc-inline-error" role="status">
            Save or discard every local correction before duplicating or switching NPCs.
          </p>
        )}
      </section>
      <button
        type="button"
        className="npc-review-character"
        disabled={busy || readOnly || hasDirtyDrafts || !canReviewNpc}
        onClick={onReviewNpc}
      >
        Mark NPC reviewed
      </button>
    </section>
  );
}

function motionKey(reference: RevisionRef): string {
  return `${reference.id}:r${reference.revision}`;
}
