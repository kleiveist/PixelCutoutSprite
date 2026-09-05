import { useEffect, useMemo, useRef, useState } from "react";

import {
  ExportCancelledError,
  type ExportJobResult,
  type ExportProgress,
  type NpcExportInspection,
  type StartNpcExportRequest,
} from "../../api/export-client";
import { useModalFocus } from "../../components/useModalFocus";
import type { Direction } from "../../domain";
import {
  cloneExportProfile,
  DEFAULT_EXPORT_PROFILE,
  estimateExport,
  EXPORT_DIRECTIONS,
  PAGE_SIZES,
  resolveExportGeometry,
  toProfileSnapshot,
  validateExportProfile,
  type ExportProfile,
} from "./export-model";
import "./ExportDialog.css";

export interface ExportCharacterOption {
  id: string;
  name: string;
}

export type ExportDialogRequest = StartNpcExportRequest;
export type ExportDialogProgress = ExportProgress;
export type ExportDialogResult = ExportJobResult;

interface ExportDialogProps {
  characters: ExportCharacterOption[];
  inspection: NpcExportInspection | null;
  inspectionLoading?: boolean;
  initialCharacterId?: string;
  initialBindingId?: string;
  initialProfile?: ExportProfile;
  savedProfiles?: readonly ExportProfile[];
  readOnly?: boolean;
  onCharacterChange: (characterId: string) => void;
  onSelectionChange?: (characterId: string, bindingId: string | null) => void;
  onStart: (
    request: ExportDialogRequest,
    signal: AbortSignal,
    report: (progress: ExportDialogProgress) => void,
  ) => Promise<ExportDialogResult>;
  onSaveProfile: (profile: ExportProfile) => Promise<ExportProfile | void> | ExportProfile | void;
  onRunningChange?: (running: boolean) => void;
  onClose: () => void;
}

type RunState = "idle" | "running" | "cancelling";

export function ExportDialog({
  characters,
  inspection,
  inspectionLoading = false,
  initialCharacterId,
  initialBindingId,
  initialProfile = DEFAULT_EXPORT_PROFILE,
  savedProfiles = [DEFAULT_EXPORT_PROFILE],
  readOnly = false,
  onCharacterChange,
  onSelectionChange,
  onStart,
  onSaveProfile,
  onRunningChange,
  onClose,
}: ExportDialogProps) {
  const [profile, setProfile] = useState<ExportProfile>(() => cloneExportProfile(initialProfile));
  const [characterId, setCharacterId] = useState(() =>
    preferredCharacterId(characters, initialCharacterId),
  );
  const [bindingId, setBindingId] = useState(initialBindingId ?? "all");
  const [progress, setProgress] = useState<ExportDialogProgress | null>(null);
  const [result, setResult] = useState<ExportDialogResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>("idle");
  const [savingProfile, setSavingProfile] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const initialFocus = useRef<HTMLSelectElement>(null);
  const runningChange = useRef(onRunningChange);
  runningChange.current = onRunningChange;

  const matchingInspection = inspection?.character_id === characterId ? inspection : null;
  const bindings = matchingInspection?.bindings ?? [];
  const selectedBindings = useMemo(
    () => bindings.filter((binding) => bindingId === "all" || binding.binding_id === bindingId),
    [bindingId, bindings],
  );
  const geometry = useMemo(
    () =>
      resolveExportGeometry(
        selectedBindings.map((binding) => ({
          frameSizePx: binding.frame_size_px,
          groundOriginPx: binding.ground_origin_px,
        })),
        profile.normalizeGeometry,
      ),
    [profile.normalizeGeometry, selectedBindings],
  );
  const structuralProfileIssues = validateExportProfile(profile);
  const profileIssues = validateExportProfile(profile, geometry.frameSizePx);
  const sourceIssues = exportSourceIssues({
    inspection: matchingInspection,
    selectedBindings,
    selectingAll: bindingId === "all",
    profile,
    geometryMismatch: geometry.mismatched,
    readOnly,
  });
  const estimate = estimateExport(profile, {
    frameSizePx: geometry.frameSizePx,
    framesPerDirection: selectedBindings.reduce((sum, binding) => sum + binding.frame_count, 0),
  });
  const issues = [...profileIssues, ...sourceIssues];
  if (selectedBindings.length > 0 && !estimate.fits)
    issues.push("The estimated export exceeds its page or memory limit.");
  const active = runState !== "idle";
  const canExport =
    !active &&
    !inspectionLoading &&
    matchingInspection !== null &&
    selectedBindings.length > 0 &&
    issues.length === 0;
  const modalFocus = useModalFocus<HTMLElement>({
    initialFocus,
    onEscape: active ? cancel : onClose,
  });

  useEffect(() => {
    const next = preferredCharacterId(characters, characterId || initialCharacterId);
    if (next === characterId) return;
    setCharacterId(next);
    setBindingId("all");
    if (next) onCharacterChange(next);
  }, [characterId, characters, initialCharacterId, onCharacterChange]);

  useEffect(() => {
    if (!matchingInspection) return;
    if (bindingId === "all" || bindings.some((binding) => binding.binding_id === bindingId)) return;
    setBindingId("all");
  }, [bindingId, bindings, matchingInspection]);

  useEffect(() => {
    if (characterId) onSelectionChange?.(characterId, bindingId === "all" ? null : bindingId);
  }, [bindingId, characterId, onSelectionChange]);

  useEffect(() => runningChange.current?.(active), [active]);

  useEffect(
    () => () => {
      mounted.current = false;
      generation.current += 1;
      controller.current?.abort();
      runningChange.current?.(false);
    },
    [],
  );

  function clearOutcome(): void {
    setResult(null);
    setError(null);
    if (!active) setProgress(null);
  }

  function update<K extends keyof ExportProfile>(key: K, value: ExportProfile[K]): void {
    setProfile((current) => ({ ...current, [key]: value }));
    clearOutcome();
  }

  function updateDirections(event: React.ChangeEvent<HTMLSelectElement>): void {
    const selected = new Set(
      Array.from(event.currentTarget.selectedOptions, (option) => option.value as Direction),
    );
    update(
      "directions",
      EXPORT_DIRECTIONS.filter((direction) => selected.has(direction)),
    );
  }

  function selectProfile(id: string): void {
    const selected = savedProfiles.find((candidate) => candidate.id === id);
    if (!selected) return;
    setProfile(cloneExportProfile(selected));
    clearOutcome();
  }

  function changeCharacter(nextCharacterId: string): void {
    setCharacterId(nextCharacterId);
    setBindingId("all");
    clearOutcome();
    onCharacterChange(nextCharacterId);
  }

  function changeBinding(nextBindingId: string): void {
    setBindingId(nextBindingId);
    clearOutcome();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!matchingInspection || !canExport) return;
    const abortController = new AbortController();
    const runGeneration = generation.current + 1;
    generation.current = runGeneration;
    controller.current = abortController;
    setRunState("running");
    setError(null);
    setResult(null);
    setProgress({ stage: "preflight", completed: 0, total: 1, message: "Preparing export" });
    try {
      const exported = await onStart(
        {
          character_id: matchingInspection.character_id,
          binding_ids: selectedBindings.map((binding) => binding.binding_id),
          format: profile.format,
          include_godot_scene: profile.format === "godot_package" && profile.includeGodotScene,
          profile: toProfileSnapshot(profile),
          root_motion_mode: profile.rootMotionMode,
          jump_mode: profile.jumpMode,
        },
        abortController.signal,
        (next) => {
          if (mounted.current && generation.current === runGeneration) setProgress(next);
        },
      );
      if (mounted.current && generation.current === runGeneration) setResult(exported);
    } catch (reason) {
      if (mounted.current && generation.current === runGeneration) setError(messageFrom(reason));
    } finally {
      if (mounted.current && generation.current === runGeneration) {
        controller.current = null;
        setRunState("idle");
      }
    }
  }

  function cancel(): void {
    if (!controller.current || runState !== "running") return;
    setRunState("cancelling");
    controller.current.abort();
  }

  async function saveProfile(): Promise<void> {
    if (structuralProfileIssues.length > 0 || savingProfile) return;
    setSavingProfile(true);
    setError(null);
    try {
      const saved = await onSaveProfile(cloneExportProfile(profile));
      if (saved) setProfile(cloneExportProfile(saved));
    } catch (reason) {
      setError(messageFrom(reason));
    } finally {
      if (mounted.current) setSavingProfile(false);
    }
  }

  return (
    <div className="export-dialog-backdrop" role="presentation">
      <section
        ref={modalFocus.dialogRef}
        aria-busy={active}
        aria-describedby={readOnly ? "export-read-only" : undefined}
        aria-labelledby="export-dialog-title"
        aria-modal="true"
        className="export-dialog"
        role="dialog"
        onKeyDown={modalFocus.onDialogKeyDown}
      >
        <header>
          <div>
            <span className="phase-tag">DETERMINISTIC BUILD</span>
            <h2 id="export-dialog-title">
              {profile.format === "godot_package"
                ? "Export Godot package + PNG/JSON"
                : "Export PNG sheets + JSON"}
            </h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close export"
            onClick={onClose}
            disabled={active}
          >
            ×
          </button>
        </header>

        <form onSubmit={submit}>
          {readOnly && (
            <p className="export-read-only" id="export-read-only" role="note">
              This vault is read-only. Managed exports require its writer session.
            </p>
          )}
          <div className="export-dialog-grid">
            <fieldset disabled={active}>
              <legend>Source</legend>
              <label>
                NPC
                <select
                  ref={initialFocus}
                  aria-label="NPC"
                  value={characterId}
                  onChange={(event) => changeCharacter(event.currentTarget.value)}
                >
                  {characters.length === 0 && <option value="">No NPCs available</option>}
                  {characters.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Animation assignment
                <select
                  aria-label="Animation assignment"
                  value={bindingId}
                  disabled={active || inspectionLoading || !matchingInspection}
                  onChange={(event) => changeBinding(event.currentTarget.value)}
                >
                  <option value="all">All assignments</option>
                  {bindings.map((binding) => (
                    <option key={binding.binding_id} value={binding.binding_id}>
                      {binding.action_key} · {binding.frame_count} frames · {binding.fps} FPS
                      {binding.ready ? "" : " · needs attention"}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Directions
                <select
                  aria-label="Directions"
                  multiple
                  size={8}
                  value={profile.directions}
                  onChange={updateDirections}
                >
                  {EXPORT_DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              {inspectionLoading && <p role="status">Inspecting pinned animation sources…</p>}
              {selectedBindings.length > 0 && (
                <p className="export-source-summary">
                  {geometry.frameSizePx[0]} × {geometry.frameSizePx[1]} px · ground{" "}
                  {geometry.groundOriginPx[0]}, {geometry.groundOriginPx[1]}
                  {geometry.normalized ? " · transparent normalization" : ""}
                </p>
              )}
            </fieldset>

            <fieldset disabled={active}>
              <legend>Profile</legend>
              <label>
                Saved profile
                <select
                  aria-label="Saved profile"
                  value={savedProfiles.some((saved) => saved.id === profile.id) ? profile.id : ""}
                  onChange={(event) => selectProfile(event.currentTarget.value)}
                >
                  {!savedProfiles.some((saved) => saved.id === profile.id) && (
                    <option value="">Unsaved profile</option>
                  )}
                  {savedProfiles.map((saved) => (
                    <option value={saved.id} key={saved.id}>
                      {saved.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Profile name
                <input
                  aria-label="Profile name"
                  value={profile.name}
                  onChange={(event) => update("name", event.currentTarget.value)}
                />
              </label>
              <label>
                Format
                <select
                  aria-label="Format"
                  value={profile.format}
                  onChange={(event) =>
                    update("format", event.currentTarget.value as ExportProfile["format"])
                  }
                >
                  <option value="png_json">PNG sheets + JSON</option>
                  <option value="godot_package">Godot package + PNG/JSON</option>
                </select>
              </label>
              <label>
                Maximum page size
                <select
                  aria-label="Maximum page size"
                  value={profile.maxPageSizePx}
                  onChange={(event) =>
                    update(
                      "maxPageSizePx",
                      Number(event.currentTarget.value) as ExportProfile["maxPageSizePx"],
                    )
                  }
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size} × {size} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Padding
                <select
                  aria-label="Padding"
                  value={profile.paddingPx}
                  onChange={(event) => update("paddingPx", Number(event.currentTarget.value))}
                >
                  {[0, 1, 2, 4, 8, 16, 32, 64].map((padding) => (
                    <option key={padding} value={padding}>
                      {padding} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Clipping
                <select
                  aria-label="Clipping"
                  value={profile.clippingPolicy}
                  onChange={(event) =>
                    update(
                      "clippingPolicy",
                      event.currentTarget.value as ExportProfile["clippingPolicy"],
                    )
                  }
                >
                  <option value="block">Block export</option>
                  <option value="warn">Export with warning</option>
                </select>
              </label>
              <label>
                Jump height
                <select
                  aria-label="Jump height"
                  value={profile.jumpMode}
                  onChange={(event) =>
                    update("jumpMode", event.currentTarget.value as ExportProfile["jumpMode"])
                  }
                >
                  <option value="baked">Baked into frames</option>
                  <option value="external">External motion</option>
                </select>
              </label>
              <label>
                Root motion
                <select
                  aria-label="Root motion"
                  value={profile.rootMotionMode}
                  onChange={(event) =>
                    update(
                      "rootMotionMode",
                      event.currentTarget.value as ExportProfile["rootMotionMode"],
                    )
                  }
                >
                  <option value="baked">Baked into frames</option>
                  <option value="external">External motion</option>
                </select>
              </label>
              <label>
                Page limit
                <select
                  aria-label="Page limit"
                  value={profile.maxPages}
                  onChange={(event) => update("maxPages", Number(event.currentTarget.value))}
                >
                  {[1, 4, 16, 64, 256].map((count) => (
                    <option key={count} value={count}>
                      {count}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Memory limit
                <select
                  aria-label="Memory limit"
                  value={profile.memoryBudgetMiB}
                  onChange={(event) => update("memoryBudgetMiB", Number(event.currentTarget.value))}
                >
                  {[64, 128, 256, 512, 1024].map((size) => (
                    <option key={size} value={size}>
                      {size} MiB
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          </div>

          <div className="export-options">
            <Check
              label="Individual PNG frames"
              checked={profile.individualFrames}
              disabled={active}
              onChange={(value) => update("individualFrames", value)}
            />
            <Check
              label="Extrude edge pixels"
              checked={profile.extrudeEdges}
              disabled={active}
              onChange={(value) => update("extrudeEdges", value)}
            />
            <Check
              label="Include shadow"
              checked={profile.includeShadow}
              disabled={active}
              onChange={(value) => update("includeShadow", value)}
            />
            {profile.format === "godot_package" && (
              <Check
                label="Include AnimatedSprite2D scene"
                checked={profile.includeGodotScene}
                disabled={active}
                onChange={(value) => update("includeGodotScene", value)}
              />
            )}
            <Check
              label="Normalize with transparent padding"
              checked={profile.normalizeGeometry}
              disabled={active}
              onChange={(value) => update("normalizeGeometry", value)}
            />
            <Check
              label="Allow marked incomplete test export"
              checked={profile.allowIncompleteTest}
              disabled={active}
              onChange={(value) => update("allowIncompleteTest", value)}
            />
          </div>

          <p className="export-managed-target">
            Managed target:{" "}
            {profile.format === "godot_package"
              ? bindingId === "all"
                ? "portable Godot NPC package"
                : "Godot binding package"
              : bindingId === "all"
                ? "portable NPC package"
                : "binding export folder"}
          </p>
          <output className="export-estimate" aria-label="Export estimate">
            {estimate.renderedFrames} frames · {formatPages(estimate.atlasPages)} ·{" "}
            {formatBytes(estimate.decodedBytes)} decoded estimate
          </output>
          {issues.length > 0 && (
            <ul className="export-issues" aria-label="Export issues">
              {[...new Set(issues)].map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {progress && (
            <div className="export-progress" aria-live="polite">
              <progress
                aria-label="Export progress"
                max={Math.max(1, progress.total)}
                value={progress.completed}
              />
              <span>
                {runState === "cancelling" ? "Cancelling… " : ""}
                {progress.message}
              </span>
            </div>
          )}
          {error && (
            <p className="export-error" role="alert">
              {error}
            </p>
          )}
          {result && (
            <p className="export-success" role="status">
              {result.godot_package ? (
                <>
                  Godot package <code>{result.godot_package.package_directory}</code> validated and
                  published with <code>sprite_frames.tres</code>
                  {result.godot_package.scene ? (
                    <>
                      {" "}
                      and <code>{result.godot_package.scene}</code>
                    </>
                  ) : null}
                  .
                  {result.godot_package.reused_existing_package
                    ? " Existing deterministic package artifacts were reused."
                    : ""}
                </>
              ) : (
                <>
                  Build {result.build} validated and published
                  {result.complete ? "." : " as an incomplete test."}
                  {result.reused_existing_build
                    ? " Existing deterministic artifacts were reused."
                    : ""}
                </>
              )}
            </p>
          )}

          <div className="export-dialog-actions">
            <button
              type="button"
              onClick={() => void saveProfile()}
              disabled={readOnly || active || savingProfile || structuralProfileIssues.length > 0}
            >
              {savingProfile ? "Saving profile…" : "Save profile"}
            </button>
            <span />
            {active ? (
              <button
                className="danger-button"
                type="button"
                onClick={cancel}
                disabled={runState === "cancelling"}
              >
                {runState === "cancelling" ? "Cancelling…" : "Cancel export"}
              </button>
            ) : (
              <button type="button" onClick={onClose}>
                Close
              </button>
            )}
            <button className="primary-button" type="submit" disabled={!canExport}>
              Export
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

interface SourceIssueInput {
  inspection: NpcExportInspection | null;
  selectedBindings: NpcExportInspection["bindings"];
  selectingAll: boolean;
  profile: ExportProfile;
  geometryMismatch: boolean;
  readOnly: boolean;
}

function exportSourceIssues({
  inspection,
  selectedBindings,
  selectingAll,
  profile,
  geometryMismatch,
  readOnly,
}: SourceIssueInput): string[] {
  const issues: string[] = [];
  if (readOnly) issues.push("Managed export is unavailable while the vault is read-only.");
  if (!inspection) return issues;
  if (selectedBindings.length === 0) issues.push("Choose at least one animation assignment.");
  const requiresCompleteSources =
    profile.format === "godot_package" || !profile.allowIncompleteTest;
  if (selectingAll && inspection.missing_required_actions.length > 0 && requiresCompleteSources)
    issues.push(
      `The complete NPC package is missing required actions: ${inspection.missing_required_actions.join(", ")}.`,
    );
  if (geometryMismatch && !profile.normalizeGeometry)
    issues.push(
      "Selected actions use different frame sizes or ground origins; enable transparent geometry normalization.",
    );
  if (requiresCompleteSources) {
    for (const binding of selectedBindings) {
      const missingSelectedDirections = profile.directions.filter(
        (direction) => !binding.covered_directions.includes(direction),
      );
      if (!binding.ready)
        issues.push(
          `${binding.action_key}: ${binding.issue ?? "required export sources are incomplete"}.`,
        );
      else if (missingSelectedDirections.length > 0)
        issues.push(
          `${binding.action_key} is missing selected directions: ${missingSelectedDirections.join(", ")}.`,
        );
    }
  }
  return issues;
}

interface CheckProps {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}

function Check({ label, checked, disabled, onChange }: CheckProps) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      {label}
    </label>
  );
}

function preferredCharacterId(
  characters: readonly ExportCharacterOption[],
  preferred?: string,
): string {
  return characters.find((candidate) => candidate.id === preferred)?.id ?? characters[0]?.id ?? "";
}

function formatBytes(bytes: number): string {
  return Number.isFinite(bytes) ? `${(bytes / 1024 / 1024).toFixed(1)} MiB` : "over limit";
}

function formatPages(pages: number): string {
  return Number.isFinite(pages) ? `${pages} page${pages === 1 ? "" : "s"}` : "no fitting page";
}

function messageFrom(reason: unknown): string {
  if (reason instanceof ExportCancelledError) return reason.message;
  return reason instanceof Error ? reason.message : String(reason);
}
