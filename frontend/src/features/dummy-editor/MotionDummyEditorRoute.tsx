import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motionClient, type MotionClient } from "../../api/motion-client";
import type { EditablePoseDto, MotionDraft, MotionEditorData } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { ProfileRevision } from "../../domain/profile";
import { DirectionEditor } from "../directions";
import {
  classifyNativeError,
  downloadRecoveryCopy,
  type EditorController,
  type EditorControllerChange,
} from "../editing";
import {
  TimelinePanel,
  commitMotion,
  createMotionHistory,
  draftContent,
  redoMotion,
  replacePresent,
  undoMotion,
  type MotionHistory,
} from "../timeline";
import { DummyEditorPage, type EditorSlot } from "./DummyEditorPage";
import { neutralTransform, type EditorPose } from "./editor-state";
import { addPoseKeyframes, applyPoseAtFrame } from "./motion-pose";

interface MotionDummyEditorRouteProps {
  sessionId: string;
  templateId: string;
  client?: MotionClient;
  onStatus?: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onEditorControllerChange?: EditorControllerChange;
  onPlaybackChange?: (playing: boolean) => void;
}

const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const colors = [
  "#e8ff68",
  "#ff795e",
  "#7257bb",
  "#52a9be",
  "#e6ad79",
  "#81be69",
  "#d270a3",
  "#756e84",
];

type SaveState = "idle" | "saving" | "failed" | "conflict";

export function MotionDummyEditorRoute({
  sessionId,
  templateId,
  client = motionClient,
  onStatus,
  onDirtyChange,
  onEditorControllerChange,
  onPlaybackChange,
}: MotionDummyEditorRouteProps) {
  const [editor, setEditor] = useState<MotionEditorData | null>(null);
  const [history, setHistory] = useState<MotionHistory | null>(null);
  const [savedContent, setSavedContent] = useState<string>("");
  const [direction, setDirection] = useState<Direction>("s");
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [autoKey, setAutoKey] = useState(false);
  const [onionSkin, setOnionSkin] = useState(true);
  const [sampledPose, setSampledPose] = useState<EditorPose>({});
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [locks, setLocks] = useState<Partial<Record<Direction, Set<string>>>>({});
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [neighborUrls, setNeighborUrls] = useState<{ previous?: string; next?: string }>({});
  const [clippingCount, setClippingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [directionBusy, setDirectionBusy] = useState<Direction | null>(null);
  const [helperBusy, setHelperBusy] = useState<number | null>(null);
  const [reloadBusy, setReloadBusy] = useState(false);
  const renderSequence = useRef(0);
  const latestDraft = useRef<MotionDraft | null>(null);
  const persistedRevision = useRef(0);
  const persistedUpdatedAt = useRef("");
  const persistedSha256 = useRef("");
  const savedContentRef = useRef("");
  const saveInFlight = useRef<Promise<void> | null>(null);
  const saveRequested = useRef(false);
  const saveStateRef = useRef<SaveState>("idle");
  const historyRef = useRef<MotionHistory | null>(null);
  const editorRef = useRef<MotionEditorData | null>(null);
  const helperBusyRef = useRef<number | null>(null);
  const directionBusyRef = useRef<Direction | null>(null);
  const reloadBusyRef = useRef(false);

  useEffect(() => {
    let active = true;
    setEditor(null);
    setHistory(null);
    setPreviewUrl(undefined);
    setNeighborUrls({});
    setSampledPose({});
    setError(null);
    setSaveError(null);
    saveStateRef.current = "idle";
    setSaveState("idle");
    void client
      .openEditor(sessionId, templateId)
      .then((value) => {
        if (!active) return;
        const content = draftContent(value.draft);
        setEditor(value);
        editorRef.current = value;
        setHistory(createMotionHistory(value.draft));
        setSavedContent(content);
        savedContentRef.current = content;
        persistedRevision.current = value.draft.revision;
        persistedUpdatedAt.current = value.draft.updated_at;
        persistedSha256.current = value.draft_sha256;
      })
      .catch((reason) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
  }, [client, sessionId, templateId]);

  const draft = history?.present ?? null;
  const dirty = Boolean(draft && draftContent(draft) !== savedContent);
  latestDraft.current = draft;
  historyRef.current = history;
  editorRef.current = editor;
  saveStateRef.current = saveState;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => onPlaybackChange?.(playing), [onPlaybackChange, playing]);
  useEffect(() => () => onPlaybackChange?.(false), [onPlaybackChange]);
  const mutationInFlight =
    saveInFlight.current !== null || helperBusy !== null || directionBusy !== null || reloadBusy;
  useEffect(() => {
    if (!dirty && !mutationInFlight) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, mutationInFlight]);

  const previewDraft = useMemo(
    () =>
      draft
        ? { ...draft, revision: persistedRevision.current, updated_at: persistedUpdatedAt.current }
        : null,
    [draft],
  );
  const slotIds = useMemo(() => editor?.profile.slots.map((slot) => slot.id) ?? [], [editor]);
  const directionalSlots = useMemo(
    () =>
      editor
        ? Object.fromEntries(
            directions.map((value) => [value, slotsForDirection(editor.profile, value)]),
          )
        : {},
    [editor],
  );

  useEffect(() => {
    if (!editor || !previewDraft) return;
    const sequence = ++renderSequence.current;
    setPreviewUrl(undefined);
    setNeighborUrls({});
    setSampledPose({});
    setError(null);
    const adjacent = neighborFrames(frame, previewDraft.frame_count, previewDraft.loop_mode);
    const requests = [client.renderSample(sessionId, templateId, previewDraft, direction, frame)];
    if (onionSkin) {
      requests.push(
        client.renderSample(sessionId, templateId, previewDraft, direction, adjacent.previous),
      );
      requests.push(
        client.renderSample(sessionId, templateId, previewDraft, direction, adjacent.next),
      );
    }
    void Promise.all(requests)
      .then(([current, previous, next]) => {
        if (sequence !== renderSequence.current) return;
        setPreviewUrl(current.data_url);
        setClippingCount(current.clipping.length);
        setSampledPose(toEditorPose(current.pose, slotIds, locks[direction]));
        setNeighborUrls(onionSkin ? { previous: previous?.data_url, next: next?.data_url } : {});
      })
      .catch((reason) => {
        if (sequence === renderSequence.current) setError(message(reason));
      });
  }, [
    client,
    direction,
    editor,
    frame,
    locks,
    onionSkin,
    previewDraft,
    sessionId,
    slotIds,
    templateId,
  ]);

  const commitDraft = useCallback((next: MotionDraft, label: string) => {
    setHistory((current) => (current ? commitMotion(current, next, label) : current));
    if (saveStateRef.current !== "conflict") {
      saveStateRef.current = "idle";
      setSaveState("idle");
      setSaveError(null);
    }
    setError(null);
  }, []);

  const requestSave = useCallback((): Promise<void> => {
    if (!editor?.writable) return Promise.reject(new Error("This vault is read-only"));
    saveRequested.current = true;
    if (saveInFlight.current) return saveInFlight.current;
    const drain = async () => {
      while (saveRequested.current) {
        saveRequested.current = false;
        const current = latestDraft.current;
        if (!current || draftContent(current) === savedContentRef.current) continue;
        const snapshot = structuredClone(current);
        saveStateRef.current = "saving";
        setSaveState("saving");
        setSaveError(null);
        setError(null);
        try {
          const saved = await client.saveDraft(
            sessionId,
            saveRequest(snapshot, persistedRevision.current, persistedSha256.current),
          );
          persistedRevision.current = saved.draft.revision;
          persistedUpdatedAt.current = saved.draft.updated_at;
          persistedSha256.current = saved.draft_sha256;
          setEditor(saved);
          editorRef.current = saved;
          const content = draftContent(snapshot);
          savedContentRef.current = content;
          setSavedContent(content);
          setHistory((currentHistory) =>
            currentHistory
              ? replacePresent(currentHistory, {
                  ...currentHistory.present,
                  revision: saved.draft.revision,
                  updated_at: saved.draft.updated_at,
                  released_from_draft_revision: saved.draft.released_from_draft_revision,
                })
              : currentHistory,
          );
          if (latestDraft.current && draftContent(latestDraft.current) !== content)
            saveRequested.current = true;
          onStatus?.(`${editor.template_name} saved locally as draft r${saved.draft.revision}`);
        } catch (reason) {
          const failure = classifyNativeError(reason);
          const failedState = failure.kind === "conflict" ? "conflict" : "failed";
          saveStateRef.current = failedState;
          setSaveState(failedState);
          setSaveError(failure.message);
          throw reason;
        }
      }
      saveStateRef.current = "idle";
      setSaveState("idle");
    };
    const operation = drain().finally(() => {
      saveInFlight.current = null;
    });
    saveInFlight.current = operation;
    return operation;
  }, [client, editor, onStatus, sessionId]);

  useEffect(() => {
    if (
      !dirty ||
      saveState === "saving" ||
      saveState === "failed" ||
      saveState === "conflict" ||
      !editor?.writable
    )
      return;
    const timer = window.setTimeout(() => {
      void requestSave().catch(() => undefined);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [dirty, editor?.writable, requestSave, saveState]);

  const undoDraft = useCallback(() => {
    setHistory((current) => (current ? undoMotion(current) : current));
    if (saveStateRef.current !== "conflict") {
      saveStateRef.current = "idle";
      setSaveState("idle");
    }
  }, []);
  const redoDraft = useCallback(() => {
    setHistory((current) => (current ? redoMotion(current) : current));
    if (saveStateRef.current !== "conflict") {
      saveStateRef.current = "idle";
      setSaveState("idle");
    }
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setPlaying((value) => !value);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFrame((value) =>
          Math.max(
            0,
            Math.min(
              (latestDraft.current?.frame_count ?? 1) - 1,
              value + (event.key === "ArrowLeft" ? -1 : 1),
            ),
          ),
        );
      }
    };
    window.addEventListener("keydown", handleKey, { capture: true });
    return () => window.removeEventListener("keydown", handleKey, { capture: true });
  }, []);

  const reloadSavedDraft = useCallback(async (): Promise<void> => {
    if (
      saveInFlight.current ||
      helperBusyRef.current !== null ||
      directionBusyRef.current !== null ||
      reloadBusyRef.current ||
      !window.confirm(
        "Reload the persisted motion draft and discard the current in-memory edits? Save a recovery copy first if needed.",
      )
    ) {
      return;
    }
    reloadBusyRef.current = true;
    setReloadBusy(true);
    setError(null);
    try {
      const value = await client.openEditor(sessionId, templateId);
      const content = draftContent(value.draft);
      setEditor(value);
      editorRef.current = value;
      setHistory(createMotionHistory(value.draft));
      setSavedContent(content);
      savedContentRef.current = content;
      persistedRevision.current = value.draft.revision;
      persistedUpdatedAt.current = value.draft.updated_at;
      persistedSha256.current = value.draft_sha256;
      saveStateRef.current = "idle";
      setSaveState("idle");
      setSaveError(null);
      onStatus?.(`${value.template_name} reloaded from the persisted draft`);
    } catch (reason) {
      setError(classifyNativeError(reason).message);
    } finally {
      reloadBusyRef.current = false;
      setReloadBusy(false);
    }
  }, [client, onStatus, sessionId, templateId]);

  const saveRecoveryCopy = useCallback((): void => {
    const current = latestDraft.current;
    if (!current) return;
    downloadRecoveryCopy(`motion-${templateId}-recovery.json`, {
      format: "pixel-cutout-sprite-motion-recovery",
      format_version: 1,
      template_id: templateId,
      persisted_revision: persistedRevision.current,
      persisted_sha256: persistedSha256.current,
      draft: current,
    });
  }, [templateId]);

  const controller = useMemo<EditorController>(
    () => ({
      id: `motion:${sessionId}:${templateId}`,
      label: "motion template",
      getState: () => {
        const current = latestDraft.current;
        const isDirty = Boolean(current && draftContent(current) !== savedContentRef.current);
        const state = saveStateRef.current;
        return {
          saveState:
            state === "saving" || state === "failed" || state === "conflict"
              ? state
              : isDirty
                ? "dirty"
                : "saved",
          status: motionSaveStatus(state, isDirty, saveError),
          dirty: isDirty,
          mutationInFlight:
            saveInFlight.current !== null ||
            helperBusyRef.current !== null ||
            directionBusyRef.current !== null ||
            reloadBusyRef.current,
          writable: editorRef.current?.writable === true,
          canUndo: (historyRef.current?.past.length ?? 0) > 0,
          canRedo: (historyRef.current?.future.length ?? 0) > 0,
        };
      },
      save: requestSave,
      undo: undoDraft,
      redo: redoDraft,
      recoveryCopy: () => {
        const current = latestDraft.current;
        return current
          ? {
              fileName: `motion-${templateId}-recovery.json`,
              value: {
                format: "pixel-cutout-sprite-motion-recovery",
                format_version: 1,
                template_id: templateId,
                persisted_revision: persistedRevision.current,
                persisted_sha256: persistedSha256.current,
                draft: current,
              },
            }
          : null;
      },
    }),
    [redoDraft, requestSave, saveError, sessionId, templateId, undoDraft],
  );

  useEffect(() => {
    onEditorControllerChange?.(controller);
    return () => onEditorControllerChange?.(null);
  }, [controller, onEditorControllerChange]);

  if (!editor || !history || !draft || !previewDraft)
    return (
      <section className="placeholder-panel" aria-live="polite">
        <span className="phase-tag">MOTION TEMPLATE</span>
        <h1>{error ? "Dummy editor unavailable" : "Loading dummy editor…"}</h1>
        {error && <p role="alert">{error}</p>}
      </section>
    );

  const saveStatus = motionSaveStatus(saveState, dirty, saveError);
  const activeSlots = directionalSlots[direction] ?? [];
  const activeDefinition = draft.directions.find((item) => item.direction === direction);
  const directionIsEditable = activeDefinition?.mode === "explicit";
  const directionIssues = Object.fromEntries(
    draft.directions
      .filter((definition) => definition.mode === "missing")
      .map((definition) => [definition.direction, ["No source pose configured · release blocked"]]),
  ) as Partial<Record<Direction, string[]>>;

  return (
    <div className="motion-editor-workspace">
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {saveError && (
        <p className="workspace-error" role="alert">
          {saveError} Current in-memory edits are retained.{" "}
          <span>
            <button type="button" onClick={() => void requestSave().catch(() => undefined)}>
              {saveState === "conflict" ? "Retry write" : "Retry save"}
            </button>{" "}
            <button type="button" onClick={saveRecoveryCopy}>
              Save recovery copy
            </button>{" "}
            {saveState === "conflict" && (
              <button type="button" disabled={reloadBusy} onClick={() => void reloadSavedDraft()}>
                Reload saved draft
              </button>
            )}
          </span>
        </p>
      )}
      {clippingCount > 0 && (
        <p className="workspace-warning" role="status">
          {clippingCount} body part{clippingCount === 1 ? "" : "s"} cross the frame boundary.
        </p>
      )}
      {!directionIsEditable && (
        <p className="workspace-warning" role="status">
          {activeDefinition?.mode === "mirrored"
            ? `${direction.toUpperCase()} is derived from ${activeDefinition.source?.toUpperCase()}. Detach it below before editing its own keys.`
            : `${direction.toUpperCase()} is missing. Choose Explicit or Mirrored below before editing.`}
        </p>
      )}
      <DummyEditorPage
        canRedo={history.future.length > 0}
        canUndo={history.past.length > 0}
        direction={direction}
        directionalSlots={directionalSlots}
        frameIndex={frame}
        frameSize={draft.frame_size_px}
        groundOrigin={draft.ground_origin_px}
        initialPose={sampledPose}
        neighborFrameUrls={neighborUrls}
        onDirectionChange={(value) => {
          setDirection(value);
          setPlaying(false);
        }}
        onPoseCommit={(next, value, label) => {
          const nextLocks = new Set(locks[value] ?? []);
          for (const slotId of slotIds) {
            if (next[slotId]?.locked) nextLocks.add(slotId);
            else nextLocks.delete(slotId);
          }
          setLocks((current) => ({ ...current, [value]: nextLocks }));
          const result = applyPoseAtFrame(draft, value, frame, sampledPose, next, slotIds, autoKey);
          if (result.missingKeys.length > 0) {
            setError(`Enable Auto-key or add a key first: ${result.missingKeys.join(", ")}`);
            return;
          }
          if (result.changed) {
            setSampledPose(next);
            commitDraft(result.draft, label);
          }
        }}
        onRedo={redoDraft}
        onSave={async () => requestSave()}
        onSelectionChange={setSelectedSlots}
        onUndo={undoDraft}
        pose={sampledPose}
        readOnly={!editor.writable || !directionIsEditable || reloadBusy}
        renderedFrameUrl={previewUrl}
        saveStatusText={saveStatus}
        slots={directionalSlots.s ?? []}
        templateName={editor.template_name}
      />
      <TimelinePanel
        autoKey={autoKey}
        canRedo={history.future.length > 0}
        canUndo={history.past.length > 0}
        direction={direction}
        frame={frame}
        helperReadOnly={!editor.writable || helperBusy !== null || reloadBusy}
        motion={draft}
        onionSkin={onionSkin}
        onAddPoseKey={() =>
          commitDraft(
            addPoseKeyframes(
              draft,
              direction,
              frame,
              sampledPose,
              selectedSlots.length > 0
                ? selectedSlots
                : ([activeSlots[0]?.id].filter(Boolean) as string[]),
            ),
            `Add pose key at frame ${frame}`,
          )
        }
        onAutoKeyChange={setAutoKey}
        onBakeHelper={(helperIndex) => {
          const snapshot = structuredClone(draft);
          helperBusyRef.current = helperIndex;
          setHelperBusy(helperIndex);
          setError(null);
          void client
            .bakeHelper(sessionId, templateId, snapshot, helperIndex)
            .then((next) => {
              if (
                latestDraft.current &&
                draftContent(latestDraft.current) !== draftContent(snapshot)
              ) {
                setError("The motion changed while converting the helper. Retry the action.");
                return;
              }
              commitDraft(next, "Convert motion helper to normal keys");
            })
            .catch((reason) => setError(message(reason)))
            .finally(() => {
              helperBusyRef.current = null;
              setHelperBusy(null);
            });
        }}
        onFrameChange={setFrame}
        onMotionChange={commitDraft}
        onOnionSkinChange={setOnionSkin}
        onPlayingChange={setPlaying}
        onRedo={redoDraft}
        onSave={() => {
          void requestSave().catch(() => undefined);
        }}
        onUndo={undoDraft}
        playing={playing}
        readOnly={!editor.writable || !directionIsEditable || reloadBusy}
      />
      <DirectionEditor
        busyDirection={directionBusy}
        definitions={draft.directions}
        issues={directionIssues}
        onChange={(definitions) =>
          commitDraft({ ...draft, directions: definitions }, "Change direction coverage")
        }
        onDetach={(value) => {
          const snapshot = structuredClone(draft);
          directionBusyRef.current = value;
          setDirectionBusy(value);
          setError(null);
          void client
            .detachDirection(sessionId, templateId, snapshot, value)
            .then((next) => {
              if (
                latestDraft.current &&
                draftContent(latestDraft.current) !== draftContent(snapshot)
              ) {
                setError("The motion changed while detaching. Retry the direction action.");
                return;
              }
              commitDraft(next, `Detach ${value.toUpperCase()} as explicit`);
            })
            .catch((reason) => setError(message(reason)))
            .finally(() => {
              directionBusyRef.current = null;
              setDirectionBusy(null);
            });
        }}
        readOnly={!editor.writable || reloadBusy}
      />
    </div>
  );
}

function slotsForDirection(profile: ProfileRevision, direction: Direction): EditorSlot[] {
  const view = profile.views.find((candidate) => candidate.direction === direction);
  if (!view) return [];
  const transforms = new Map(view.base_transforms.map((item) => [item.slot_id, item.transform]));
  const slots = new Map(profile.slots.map((slot, index) => [slot.id, { slot, index }]));
  return view.layer_order.flatMap((slotId) => {
    const entry = slots.get(slotId);
    const transform = transforms.get(slotId);
    if (!entry || !transform) return [];
    return [
      {
        id: entry.slot.id,
        label: entry.slot.id.replaceAll("_", " "),
        parentId: entry.slot.parent_id,
        x: transform.offset_px[0],
        y: transform.offset_px[1],
        baseRotation: transform.rotation_deg,
        width: entry.slot.size_px[0],
        height: entry.slot.size_px[1],
        pivotX: entry.slot.pivot_px[0],
        pivotY: entry.slot.pivot_px[1],
        color: colors[entry.index % colors.length],
        optional: entry.slot.optional,
      },
    ];
  });
}

function toEditorPose(
  pose: EditablePoseDto,
  slotIds: readonly string[],
  locked: ReadonlySet<string> | undefined,
): EditorPose {
  return Object.fromEntries(
    slotIds.map((slotId) => [
      slotId,
      { ...neutralTransform(), ...pose[slotId], locked: locked?.has(slotId) ?? false },
    ]),
  );
}

function neighborFrames(
  frame: number,
  count: number,
  loopMode: "loop" | "once",
): { previous: number; next: number } {
  return {
    previous: frame > 0 ? frame - 1 : loopMode === "loop" ? count - 1 : 0,
    next: frame + 1 < count ? frame + 1 : loopMode === "loop" ? 0 : count - 1,
  };
}

function saveRequest(draft: MotionDraft, expectedRevision: number, expectedSha256: string) {
  return {
    template_id: draft.template_id,
    expected_revision: expectedRevision,
    expected_sha256: expectedSha256,
    frame_size_px: draft.frame_size_px,
    ground_origin_px: draft.ground_origin_px,
    frame_count: draft.frame_count,
    fps: draft.fps,
    loop_mode: draft.loop_mode,
    directions: draft.directions,
    tracks: draft.tracks,
    semantics: draft.semantics,
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["input", "textarea", "select"].includes(target.tagName.toLowerCase()))
  );
}

function motionSaveStatus(state: SaveState, dirty: boolean, error: string | null): string {
  if (state === "saving") return "Saving…";
  if (state === "conflict") return `Save conflict · ${error ?? "saved draft changed"}`;
  if (state === "failed") return `Unsaved · ${error ?? "write failed"}`;
  return dirty ? "Unsaved changes · autosave in 2 s" : "Saved locally";
}

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
