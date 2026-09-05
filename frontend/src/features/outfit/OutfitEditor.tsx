import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { assetClient, type AssetClient } from "../../api/asset-client";
import {
  outfitClient,
  type OutfitClient,
  type OutfitDraftEdits,
  type OutfitEditorContext,
  type OutfitLaunchContext,
  type MissingOutfitSlot,
  type OutfitPreviewFrame,
  type OutfitTarget,
  type SavedNpc,
} from "../../api/outfit-client";
import type { AssetImportInspection, AssetInventory, ImportDecision } from "../../domain/inventory";
import type {
  AssetFallbackApproval,
  Direction,
  OutfitFitting,
  RevisionRef,
  SlotRef,
  Transform2D,
} from "../../domain";
import {
  approveAssetFallback,
  createOutfitHistory,
  fittingFor,
  localOverrideFor,
  missingRequiredSlots,
  outfitHistoryReducer,
  removeFallbackForTarget,
  removeFallbacksUsingSource,
  replaceFitting,
  replaceLocalOverride,
  replaceVariantFitting,
  spriteVariantsFor,
  variantFittingFor,
} from "./outfit-state";
import { EquipmentPanel } from "./EquipmentPanel";
import { isEquipmentAsset } from "./equipment-state";
import { DressMode, FineTuneMode, InventoryMode, ModeTab } from "./OutfitModes";
import { OutfitPreview } from "./OutfitPreview";
import { OutfitTargetChooser } from "./OutfitTargetChooser";
import { SaveNpcDialog } from "./SaveNpcDialog";
import { ImportReviewDialog } from "../inventory";
import {
  classifyNativeError,
  downloadRecoveryCopy,
  type EditorController,
  type EditorControllerChange,
} from "../editing";
import {
  assetKey,
  identityTransform,
  isTextEditing,
  messageOf,
  saveStateLabel,
  toggleSet,
  type EditorMode,
  type EditScope,
} from "./outfit-utils";
import "./OutfitEditor.css";

export interface OutfitEditorProps {
  sessionId: string;
  areaId: string;
  templateRef: RevisionRef;
  client?: OutfitClient;
  assetsClient?: AssetClient;
  autosaveDelayMs?: number;
  writable?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onEditorControllerChange?: EditorControllerChange;
  onPlaybackChange?: (playing: boolean) => void;
  onOpenDummy?: (templateRef: RevisionRef) => void;
  onImportAssets?: () => void;
  onSavedNpc?: (npc: SavedNpc) => void;
  onStatus?: (message: string) => void;
}

function mirrorFallbackOptions(
  context: OutfitEditorContext,
  edits: OutfitDraftEdits,
  missing: MissingOutfitSlot[],
): AssetFallbackApproval[] {
  const options: AssetFallbackApproval[] = [];
  const addOption = (slotId: string, target: Direction, variant?: string): void => {
    const source = horizontalMirror(target);
    if (source === target) return;
    const fitting = edits.fittings.find(
      (candidate) => candidate.slot_id === slotId && candidate.direction === source,
    );
    if (!fitting) return;
    const named = variant ? variantFittingFor(fitting, variant) : undefined;
    const reference = named?.asset ?? fitting.asset;
    const asset = context.inventory.find(
      (candidate) =>
        assetKey(candidate.asset) === assetKey(reference) &&
        (variant === undefined || candidate.variant === variant),
    );
    if (!asset?.assignable || !asset.sprite_mirroring_allowed) return;
    options.push({
      slot_id: slotId,
      target_direction: target,
      source_direction: source,
      variant: variant ?? asset.variant,
    });
  };
  for (const item of missing) {
    for (const target of item.missing_directions) {
      addOption(item.slot_id, target);
    }
    for (const missingVariant of item.missing_variants) {
      addOption(item.slot_id, missingVariant.direction, missingVariant.variant);
    }
  }
  return options.filter(
    (option, index) =>
      options.findIndex(
        (candidate) =>
          candidate.slot_id === option.slot_id &&
          candidate.target_direction === option.target_direction &&
          candidate.variant === option.variant,
      ) === index,
  );
}

function horizontalMirror(direction: Direction): Direction {
  switch (direction) {
    case "ne":
      return "nw";
    case "e":
      return "w";
    case "se":
      return "sw";
    case "sw":
      return "se";
    case "w":
      return "e";
    case "nw":
      return "ne";
    case "n":
    case "s":
      return direction;
  }
}

function importedOutfitRefs(
  imported: AssetInventory,
  before: OutfitEditorContext["inventory"],
  inspection: AssetImportInspection,
  decisions: ImportDecision[],
): SlotRef[] {
  const previous = new Set(before.map((item) => assetKey(item.asset)));
  const expected = decisions.map((decision) => ({
    ...decision,
    contentHash: inspection.entries.find((entry) => entry.entry_index === decision.entry_index)
      ?.content_hash,
    variant: inspection.entries.find((entry) => entry.entry_index === decision.entry_index)
      ?.variant,
  }));
  const candidates = imported.items.filter((item) => {
    if (item.archived) return false;
    const reference = {
      asset_id: item.id,
      revision: item.released_revision,
      slot_id: item.slot_id,
    };
    return expected.some(
      (entry) =>
        entry.slot_id === item.slot_id &&
        entry.direction === item.direction &&
        entry.variant === item.variant &&
        (!previous.has(assetKey(reference)) || entry.contentHash === item.content_hash),
    );
  });
  const byTarget = new Map<string, typeof candidates>();
  for (const item of candidates) {
    const key = `${item.slot_id}:${item.direction}:${item.variant}`;
    byTarget.set(key, [...(byTarget.get(key) ?? []), item]);
  }
  return [...byTarget.values()]
    .filter((items) => items.length === 1)
    .map(([item]) => ({
      asset_id: item.id,
      revision: item.released_revision,
      slot_id: item.slot_id,
    }));
}

export function OutfitEditor({
  sessionId,
  areaId,
  templateRef,
  client = outfitClient,
  assetsClient = assetClient,
  autosaveDelayMs = 2_000,
  writable = true,
  onDirtyChange,
  onEditorControllerChange,
  onPlaybackChange,
  onOpenDummy,
  onImportAssets,
  onSavedNpc,
  onStatus,
}: OutfitEditorProps) {
  const [launch, setLaunch] = useState<OutfitLaunchContext | null>(null);
  const [context, setContext] = useState<OutfitEditorContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeControllerRef = useRef<EditorController | null>(null);
  const chooserMutationRef = useRef<string | null>(null);
  const bridgeEditorController = useCallback<EditorControllerChange>((controller) => {
    activeControllerRef.current = controller;
  }, []);
  const controller = useMemo<EditorController>(
    () => ({
      id: `outfit:${sessionId}:${areaId}:${templateRef.id}`,
      label: "outfit draft",
      getState: () =>
        activeControllerRef.current?.getState() ?? {
          saveState: "saved",
          status: chooserMutationRef.current ?? "Choose an outfit target",
          dirty: false,
          mutationInFlight: chooserMutationRef.current !== null,
          writable,
          canUndo: false,
          canRedo: false,
        },
      save: () => activeControllerRef.current?.save() ?? Promise.resolve(),
      undo: () => activeControllerRef.current?.undo(),
      redo: () => activeControllerRef.current?.redo(),
    }),
    [areaId, sessionId, templateRef.id, writable],
  );

  useEffect(() => {
    onEditorControllerChange?.(controller);
    return () => onEditorControllerChange?.(null);
  }, [controller, onEditorControllerChange]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError(null);
    setLaunch(null);
    setContext(null);
    client
      .launch(sessionId, areaId, templateRef)
      .then((value) => {
        if (current) setLaunch(value);
      })
      .catch((reason: unknown) => {
        if (current) setError(messageOf(reason));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [areaId, client, sessionId, templateRef]);

  async function start(target: OutfitTarget): Promise<void> {
    chooserMutationRef.current = "Starting outfit draft";
    setLoading(true);
    setError(null);
    try {
      setContext(await client.start(sessionId, areaId, templateRef, target));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      chooserMutationRef.current = null;
      setLoading(false);
    }
  }

  async function resume(draftId: string): Promise<void> {
    chooserMutationRef.current = "Opening outfit draft";
    setLoading(true);
    setError(null);
    try {
      setContext(await client.resume(sessionId, areaId, draftId));
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      chooserMutationRef.current = null;
      setLoading(false);
    }
  }

  if (loading && !launch && !context) return <p role="status">Loading outfit workflow…</p>;
  if (error && !launch && !context) return <p role="alert">{error}</p>;
  if (!launch) return null;
  if (!context) {
    return (
      <OutfitTargetChooser
        launch={launch}
        busy={loading}
        writable={writable}
        error={error}
        onStart={start}
        onResume={resume}
        onOpenDummy={() => onOpenDummy?.(templateRef)}
      />
    );
  }
  return (
    <ActiveOutfitEditor
      key={context.draft.id}
      context={context}
      sessionId={sessionId}
      areaId={areaId}
      client={client}
      assetsClient={assetsClient}
      autosaveDelayMs={autosaveDelayMs}
      writable={writable}
      onDirtyChange={onDirtyChange}
      onEditorControllerChange={bridgeEditorController}
      onPlaybackChange={onPlaybackChange}
      onOpenDummy={() => onOpenDummy?.(context.draft.template_ref)}
      onImportAssets={onImportAssets}
      onSavedNpc={onSavedNpc}
      onStatus={onStatus}
    />
  );
}

function ActiveOutfitEditor({
  context,
  sessionId,
  areaId,
  client,
  assetsClient,
  autosaveDelayMs,
  writable,
  onDirtyChange,
  onEditorControllerChange,
  onPlaybackChange,
  onOpenDummy,
  onImportAssets,
  onSavedNpc,
  onStatus,
}: {
  context: OutfitEditorContext;
  sessionId: string;
  areaId: string;
  client: OutfitClient;
  assetsClient: AssetClient;
  autosaveDelayMs: number;
  writable: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onEditorControllerChange?: EditorControllerChange;
  onPlaybackChange?: (playing: boolean) => void;
  onOpenDummy: () => void;
  onImportAssets?: () => void;
  onSavedNpc?: (npc: SavedNpc) => void;
  onStatus?: (message: string) => void;
}) {
  const [history, rawDispatch] = useReducer(
    outfitHistoryReducer,
    context.draft,
    createOutfitHistory,
  );
  const [inventory, setInventory] = useState(context.inventory);
  const [mode, setMode] = useState<EditorMode>("dress");
  const [scope, setScope] = useState<EditScope>("appearance");
  const [slotId, setSlotId] = useState(context.profile.slots[0]?.id ?? "");
  const [direction, setDirection] = useState<Direction>("s");
  const [spriteVariant, setSpriteVariant] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [preview, setPreview] = useState<OutfitPreviewFrame | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [outlineOpacity, setOutlineOpacity] = useState(0.22);
  const [saveDialog, setSaveDialog] = useState(false);
  const [savedNpc, setSavedNpc] = useState<SavedNpc | null>(null);
  const [applying, setApplying] = useState(false);
  const [commandBusy, setCommandBusy] = useState(false);
  const [inspection, setInspection] = useState<AssetImportInspection | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const historyRef = useRef(history);
  historyRef.current = history;
  const commandBusyRef = useRef(false);
  const savePromiseRef = useRef<Promise<number> | null>(null);
  const persistedSha256Ref = useRef(context.draft_sha256);
  const previewPendingRef = useRef<{
    direction: Direction;
    frame: number;
    edits: OutfitDraftEdits;
  } | null>(null);
  const previewRunningRef = useRef(false);
  const mountedRef = useRef(true);
  const dispatch = useCallback((action: Parameters<typeof outfitHistoryReducer>[1]) => {
    historyRef.current = outfitHistoryReducer(historyRef.current, action);
    rawDispatch(action);
  }, []);
  const effectiveContext = useMemo(() => ({ ...context, inventory }), [context, inventory]);

  const missing = useMemo(
    () =>
      missingRequiredSlots(
        effectiveContext.profile,
        history.present,
        effectiveContext.motion,
        effectiveContext.inventory,
      ),
    [
      effectiveContext.inventory,
      effectiveContext.motion,
      effectiveContext.profile,
      history.present,
    ],
  );
  const fallbackOptions = useMemo(
    () => mirrorFallbackOptions(effectiveContext, history.present, missing),
    [effectiveContext, history.present, missing],
  );
  const currentFit = fittingFor(history.present, slotId, direction);
  const baseAssetOption = currentFit
    ? inventory.find((item) => assetKey(item.asset) === assetKey(currentFit.asset))
    : undefined;
  const spriteVariants = Array.from(
    new Set([
      ...spriteVariantsFor(context.motion, context.profile, slotId, direction),
      ...(currentFit?.variant_fittings ?? []).map((item) => item.variant),
    ]),
  ).sort((left, right) => left.localeCompare(right));
  const currentVariantFit = spriteVariant
    ? variantFittingFor(currentFit, spriteVariant)
    : undefined;
  const variantUsesBase =
    spriteVariant !== null && baseAssetOption?.variant === spriteVariant && !currentVariantFit;
  const exactAssets = inventory.filter(
    (asset) =>
      asset.asset.slot_id === slotId &&
      (spriteVariant === null || asset.variant === spriteVariant) &&
      ((asset.assignable && asset.direction === direction) ||
        (currentFit !== undefined && assetKey(asset.asset) === assetKey(currentFit.asset)) ||
        (currentVariantFit !== undefined &&
          assetKey(asset.asset) === assetKey(currentVariantFit.asset))),
  );
  const currentLocal = localOverrideFor(history.present, slotId, direction);

  const persistLatest = useCallback(
    async (retryConflict = false): Promise<number> => {
      for (;;) {
        if (savePromiseRef.current) {
          await savePromiseRef.current;
          continue;
        }
        const state = historyRef.current;
        if (state.saveState === "saved") return state.persistedRevision;
        if (state.saveState === "conflict" && !retryConflict) {
          throw new Error(state.saveError ?? "The saved draft changed outside this editor.");
        }
        if (state.saveState === "saving") {
          throw new Error("The draft save state is inconsistent; reload the saved draft.");
        }
        const savingSequence = state.editSequence;
        dispatch({ type: "save_started" });
        const operation = client
          .autosave(
            sessionId,
            areaId,
            context.draft.id,
            state.persistedRevision,
            state.present,
            persistedSha256Ref.current,
          )
          .then((saved) => {
            persistedSha256Ref.current = saved.draft_sha256;
            dispatch({
              type: "save_succeeded",
              revision: saved.draft.revision,
              savingSequence,
            });
            return saved.draft.revision;
          })
          .catch((reason: unknown) => {
            const failure = classifyNativeError(reason);
            dispatch({
              type: "save_failed",
              message: failure.message,
              conflict: failure.kind === "conflict",
            });
            throw reason;
          });
        savePromiseRef.current = operation;
        try {
          await operation;
        } finally {
          if (savePromiseRef.current === operation) savePromiseRef.current = null;
        }
      }
    },
    [areaId, client, context.draft.id, dispatch, sessionId],
  );

  const saveNow = useCallback(async (): Promise<void> => {
    await persistLatest();
  }, [persistLatest]);

  useEffect(() => {
    if (!writable || history.saveState !== "dirty" || history.savingSequence !== null) return;
    const timer = window.setTimeout(() => void saveNow().catch(() => undefined), autosaveDelayMs);
    return () => window.clearTimeout(timer);
  }, [
    autosaveDelayMs,
    history.editSequence,
    history.saveState,
    history.savingSequence,
    saveNow,
    writable,
  ]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => {
        setFrame((current) => {
          const next = current + 1;
          if (next < context.motion.frame_count) return next;
          if (context.motion.loop_mode === "once") {
            setPlaying(false);
            return context.motion.frame_count - 1;
          }
          return 0;
        });
      },
      Math.max(16, 1_000 / context.motion.fps),
    );
    return () => window.clearInterval(timer);
  }, [context.motion.fps, context.motion.frame_count, context.motion.loop_mode, playing]);

  const drainPreview = useCallback(async (): Promise<void> => {
    if (previewRunningRef.current) return;
    previewRunningRef.current = true;
    try {
      while (previewPendingRef.current) {
        const request = previewPendingRef.current;
        previewPendingRef.current = null;
        try {
          const value = await client.preview(
            sessionId,
            areaId,
            context.draft.id,
            request.direction,
            request.frame,
            request.edits,
          );
          if (mountedRef.current) {
            setPreview(value);
            setPreviewError(null);
          }
        } catch (reason) {
          if (mountedRef.current) setPreviewError(messageOf(reason));
        }
      }
    } finally {
      previewRunningRef.current = false;
    }
  }, [areaId, client, context.draft.id, sessionId]);

  useEffect(() => {
    previewPendingRef.current = { direction, frame, edits: history.present };
    void drainPreview();
  }, [direction, drainPreview, frame, history.present]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      previewPendingRef.current = null;
    };
  }, []);

  const togglePlayback = useCallback((): void => {
    if (
      !playing &&
      context.motion.loop_mode === "once" &&
      frame === context.motion.frame_count - 1
    ) {
      setFrame(0);
    }
    setPlaying((value) => !value);
  }, [context.motion.frame_count, context.motion.loop_mode, frame, playing]);

  const hasUnsavedChanges = writable && history.saveState !== "saved";
  const navigationUnsafe = hasUnsavedChanges || commandBusy || applying;
  useEffect(() => onDirtyChange?.(hasUnsavedChanges), [hasUnsavedChanges, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => onPlaybackChange?.(playing), [onPlaybackChange, playing]);
  useEffect(() => () => onPlaybackChange?.(false), [onPlaybackChange]);
  useEffect(() => {
    if (!navigationUnsafe) return;
    const beforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [navigationUnsafe]);

  useEffect(() => {
    function keyboard(event: KeyboardEvent): void {
      if (isTextEditing(event.target)) return;
      if (commandBusyRef.current) {
        return;
      } else if (event.key === " ") {
        event.preventDefault();
        togglePlayback();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        setFrame((value) => (value - 1 + context.motion.frame_count) % context.motion.frame_count);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        setFrame((value) => (value + 1) % context.motion.frame_count);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, [context.motion.frame_count, togglePlayback]);

  function edit(edits: OutfitDraftEdits): void {
    if (!writable || commandBusyRef.current) return;
    dispatch({ type: "edit", edits });
  }

  function ensureFit(assetRef?: SlotRef): OutfitFitting | null {
    if (currentFit) return currentFit;
    const option = exactAssets.find((asset) =>
      assetRef ? assetKey(asset.asset) === assetKey(assetRef) : true,
    );
    if (!option) return null;
    return {
      slot_id: slotId,
      direction,
      asset: { ...option.asset },
      pivot_px: [...option.pivot_px],
      variant_fittings: [],
      transform: identityTransform(),
      visible: true,
      layer_delta: 0,
    };
  }

  function updateTransform(transform: Transform2D): void {
    if (scope === "binding") {
      edit(replaceLocalOverride(history.present, slotId, direction, transform));
      return;
    }
    const fit = ensureFit();
    if (fit) edit(replaceFitting(history.present, { ...fit, transform }));
  }

  const beginCommand = useCallback((): boolean => {
    if (commandBusyRef.current) return false;
    commandBusyRef.current = true;
    setCommandBusy(true);
    return true;
  }, []);

  const endCommand = useCallback((): void => {
    commandBusyRef.current = false;
    setCommandBusy(false);
  }, []);

  const inspectPaths = useCallback(
    async (paths: string[]): Promise<void> => {
      if (!writable || paths.length === 0 || !beginCommand()) return;
      setActionError(null);
      try {
        await persistLatest();
        const result = await assetsClient.inspect(sessionId, areaId, paths);
        setInspection(result);
        onStatus?.(`${result.entries.length} outfit import assignment(s) ready for review`);
      } catch (reason) {
        setActionError(messageOf(reason));
        onStatus?.("Outfit asset inspection failed; no source was copied");
      } finally {
        endCommand();
      }
    },
    [areaId, assetsClient, beginCommand, endCommand, onStatus, persistLatest, sessionId, writable],
  );

  useEffect(() => {
    if (!writable) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void assetsClient
      .listenForDrops((paths) => void inspectPaths(paths))
      .then((cleanup) => {
        if (disposed) cleanup();
        else unlisten = cleanup;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [assetsClient, inspectPaths, writable]);

  async function chooseImportSources(): Promise<void> {
    if (!writable) return;
    onImportAssets?.();
    try {
      await inspectPaths(await assetsClient.chooseSources());
    } catch (reason) {
      setActionError(messageOf(reason));
    }
  }

  async function confirmImport(decisions: ImportDecision[]): Promise<void> {
    if (!writable || !inspection || !beginCommand()) return;
    setActionError(null);
    try {
      const revision = await persistLatest();
      const imported = await assetsClient.import(sessionId, {
        area_id: areaId,
        source: inspection.source,
        decisions,
      });
      const importedRefs = importedOutfitRefs(imported, inventory, inspection, decisions);
      setInspection(null);
      const refreshed = await client.resume(sessionId, areaId, context.draft.id);
      persistedSha256Ref.current = refreshed.draft_sha256;
      setInventory(refreshed.inventory);
      setSelectedAssets(new Set(importedRefs.map(assetKey)));
      if (importedRefs.length > 0) {
        const assigned = await client.autoAssign(
          sessionId,
          areaId,
          context.draft.id,
          revision,
          importedRefs,
          persistedSha256Ref.current,
        );
        persistedSha256Ref.current = assigned.draft_sha256;
        dispatch({ type: "command_applied", draft: assigned.draft });
        setSelectedAssets(new Set());
        onStatus?.(`${importedRefs.length} imported outfit image(s) assigned by slot metadata`);
      } else {
        onStatus?.("Assets imported; choose ambiguous or already-existing images explicitly");
      }
    } catch (reason) {
      setActionError(messageOf(reason));
      onStatus?.("Outfit asset import or automatic assignment failed");
    } finally {
      endCommand();
    }
  }

  async function autoAssign(): Promise<void> {
    if (!beginCommand()) return;
    const assets = inventory
      .filter((item) => selectedAssets.has(assetKey(item.asset)) && !isEquipmentAsset(item))
      .map((item) => item.asset);
    if (assets.length === 0) {
      endCommand();
      return;
    }
    try {
      const revision = await persistLatest();
      const assigned = await client.autoAssign(
        sessionId,
        areaId,
        context.draft.id,
        revision,
        assets,
        persistedSha256Ref.current,
      );
      persistedSha256Ref.current = assigned.draft_sha256;
      dispatch({ type: "command_applied", draft: assigned.draft });
      setSelectedAssets(new Set());
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      endCommand();
    }
  }

  async function openDummySafely(): Promise<void> {
    if (!beginCommand()) return;
    setActionError(null);
    try {
      await persistLatest();
      onOpenDummy();
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      endCommand();
    }
  }

  async function applyExistingNpc(): Promise<void> {
    if (!beginCommand()) return;
    setApplying(true);
    setActionError(null);
    try {
      const revision = await persistLatest();
      const npc = await client.applyToNpc(
        sessionId,
        areaId,
        context.draft.id,
        revision,
        persistedSha256Ref.current,
      );
      setSavedNpc(npc);
      onSavedNpc?.(npc);
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      setApplying(false);
      endCommand();
    }
  }

  async function saveNewNpc(request: Parameters<OutfitClient["saveAsNpc"]>[4]): Promise<void> {
    if (!beginCommand()) throw new Error("Another outfit command is still running.");
    setActionError(null);
    try {
      const revision = await persistLatest();
      const npc = await client.saveAsNpc(
        sessionId,
        areaId,
        context.draft.id,
        revision,
        request,
        persistedSha256Ref.current,
      );
      setSavedNpc(npc);
      setSaveDialog(false);
      onSavedNpc?.(npc);
    } finally {
      endCommand();
    }
  }

  async function reloadSavedDraft(): Promise<void> {
    if (
      !window.confirm(
        "Reload the persisted draft and discard the current in-memory edits? Save a recovery copy first if needed.",
      ) ||
      !beginCommand()
    ) {
      return;
    }
    setActionError(null);
    try {
      const refreshed = await client.resume(sessionId, areaId, context.draft.id);
      persistedSha256Ref.current = refreshed.draft_sha256;
      dispatch({ type: "reloaded", draft: refreshed.draft });
      setInventory(refreshed.inventory);
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      endCommand();
    }
  }

  function saveRecoveryCopy(): void {
    downloadRecoveryCopy(`outfit-${context.draft.id}-recovery.json`, {
      format: "pixel-cutout-sprite-outfit-recovery",
      format_version: 1,
      draft_id: context.draft.id,
      persisted_revision: historyRef.current.persistedRevision,
      persisted_sha256: persistedSha256Ref.current,
      edits: historyRef.current.present,
    });
  }

  const controller = useMemo<EditorController>(
    () => ({
      id: `outfit:${sessionId}:${context.draft.id}`,
      label: "outfit draft",
      getState: () => {
        const state = historyRef.current;
        const mutationInFlight = savePromiseRef.current !== null || commandBusyRef.current;
        return {
          saveState: state.saveState,
          status:
            mutationInFlight && state.saveState !== "saving"
              ? "Native outfit operation in progress"
              : saveStateLabel(state.saveState),
          dirty: state.saveState !== "saved",
          mutationInFlight,
          writable,
          canUndo: state.past.length > 0,
          canRedo: state.future.length > 0,
        };
      },
      save: async () => {
        await persistLatest(historyRef.current.saveState === "conflict");
      },
      undo: () => dispatch({ type: "undo" }),
      redo: () => dispatch({ type: "redo" }),
      recoveryCopy: () => ({
        fileName: `outfit-${context.draft.id}-recovery.json`,
        value: {
          format: "pixel-cutout-sprite-outfit-recovery",
          format_version: 1,
          draft_id: context.draft.id,
          persisted_revision: historyRef.current.persistedRevision,
          persisted_sha256: persistedSha256Ref.current,
          edits: historyRef.current.present,
        },
      }),
    }),
    [context.draft.id, dispatch, persistLatest, sessionId, writable],
  );

  useEffect(() => {
    onEditorControllerChange?.(controller);
    return () => onEditorControllerChange?.(null);
  }, [controller, onEditorControllerChange]);

  const transform =
    scope === "binding"
      ? (currentLocal?.transform ?? identityTransform())
      : (currentFit?.transform ?? identityTransform());

  if (savedNpc) {
    const existing = context.draft.character_id !== null;
    return (
      <section className="outfit-saved" aria-labelledby="outfit-saved-title">
        <span>{existing ? "NPC updated" : "NPC created"}</span>
        <h1 id="outfit-saved-title">{savedNpc.character.name}</h1>
        <p>
          Character, Default appearance, and {savedNpc.binding.action_key} binding now share stable
          references in <code>{savedNpc.character_folder}</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="outfit-editor" aria-labelledby="outfit-editor-title">
      <header className="outfit-editor-header">
        <div>
          <span>{context.draft.character_id ? "Existing NPC draft" : "Unnamed NPC draft"}</span>
          <h1 id="outfit-editor-title">{context.template.name} outfit</h1>
        </div>
        <div className={`outfit-save-state is-${history.saveState}`} role="status">
          {saveStateLabel(history.saveState)} · draft r{history.persistedRevision}
        </div>
        <div className="outfit-header-actions">
          <button
            type="button"
            disabled={!writable || commandBusy || history.past.length === 0}
            onClick={() => dispatch({ type: "undo" })}
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!writable || commandBusy || history.future.length === 0}
            onClick={() => dispatch({ type: "redo" })}
          >
            Redo
          </button>
          <button
            type="button"
            disabled={
              !writable ||
              commandBusy ||
              history.saveState === "saving" ||
              history.saveState === "saved"
            }
            onClick={() =>
              void persistLatest(history.saveState === "conflict").catch(() => undefined)
            }
          >
            Save now
          </button>
          {!context.draft.character_id && (
            <button
              type="button"
              className="primary-button"
              disabled={!writable || commandBusy}
              onClick={() => setSaveDialog(true)}
            >
              Save as NPC…
            </button>
          )}
          {context.draft.character_id && (
            <button
              type="button"
              className="primary-button"
              disabled={!writable || commandBusy || applying}
              onClick={() => void applyExistingNpc()}
            >
              {applying ? "Applying…" : "Apply to NPC"}
            </button>
          )}
        </div>
      </header>
      {actionError && (
        <p role="alert" className="outfit-error">
          {actionError} Current in-memory edits are retained.
        </p>
      )}
      {!writable && (
        <p role="status" className="outfit-read-only">
          Read-only inspection: editing, imports, autosave, and NPC writes are disabled.
        </p>
      )}
      {history.saveError && (
        <p role="alert" className="outfit-error">
          {history.saveError} Current in-memory edits are retained.{" "}
          <span className="outfit-conflict-actions">
            {history.saveState === "conflict" ? (
              <button
                type="button"
                disabled={commandBusy}
                onClick={() => void persistLatest(true).catch(() => undefined)}
              >
                Retry write
              </button>
            ) : (
              <button type="button" disabled={commandBusy} onClick={() => void saveNow()}>
                Retry save
              </button>
            )}
            <button type="button" onClick={saveRecoveryCopy}>
              Save recovery copy
            </button>
            {history.saveState === "conflict" && (
              <button type="button" onClick={() => void reloadSavedDraft()}>
                Reload saved draft
              </button>
            )}
          </span>
        </p>
      )}
      <div className="outfit-mode-tabs" role="tablist" aria-label="Outfit editor modes">
        <ModeTab active={mode === "inventory"} onClick={() => setMode("inventory")}>
          Inventory
        </ModeTab>
        <ModeTab active={mode === "dress"} onClick={() => setMode("dress")}>
          Dress
        </ModeTab>
        <ModeTab active={mode === "fine_tune"} onClick={() => setMode("fine_tune")}>
          Fine tune
        </ModeTab>
      </div>
      <div className="outfit-layout">
        <fieldset
          className="outfit-mode-panel outfit-mode-fieldset"
          disabled={commandBusy || !writable}
          aria-label="Outfit editing controls"
        >
          {mode === "inventory" && (
            <InventoryMode
              inventory={inventory}
              selected={selectedAssets}
              onToggle={(key) => setSelectedAssets(toggleSet(selectedAssets, key))}
              onImport={() => void chooseImportSources()}
            />
          )}
          {mode === "dress" && (
            <div className="outfit-dress-workspace">
              <DressMode
                inventory={inventory}
                selected={selectedAssets}
                missing={missing}
                saveState={commandBusy ? "saving" : history.saveState}
                fallbackOptions={fallbackOptions}
                selectedBodyCount={
                  inventory.filter(
                    (item) => selectedAssets.has(assetKey(item.asset)) && !isEquipmentAsset(item),
                  ).length
                }
                onToggle={(key) => setSelectedAssets(toggleSet(selectedAssets, key))}
                onAutoAssign={() => void autoAssign()}
                onApproveFallback={(approval) => {
                  const source = fittingFor(
                    history.present,
                    approval.slot_id,
                    approval.source_direction,
                  );
                  const sourceVariant = variantFittingFor(source, approval.variant);
                  const sourceReference = sourceVariant?.asset ?? source?.asset;
                  const sourceAsset = source
                    ? inventory.find(
                        (item) =>
                          sourceReference !== undefined &&
                          assetKey(item.asset) === assetKey(sourceReference) &&
                          item.variant === approval.variant,
                      )
                    : undefined;
                  if (sourceAsset) {
                    edit(
                      approveAssetFallback(history.present, approval, sourceAsset.image_size_px[0]),
                    );
                  }
                }}
              />
              <EquipmentPanel
                inventory={inventory}
                selected={selectedAssets}
                equipment={history.present.equipment}
                direction={direction}
                frame={frame}
                onDirection={(value) => {
                  setDirection(value);
                  setFrame(0);
                }}
                onChange={(equipment) => edit({ ...history.present, equipment })}
                onClearSelection={() => setSelectedAssets(new Set())}
              />
            </div>
          )}
          {mode === "fine_tune" && (
            <FineTuneMode
              context={effectiveContext}
              slotId={slotId}
              direction={direction}
              scope={scope}
              affectedBindingCount={context.affected_binding_count}
              fit={currentFit}
              spriteVariants={spriteVariants}
              spriteVariant={spriteVariant}
              variantFit={currentVariantFit}
              variantUsesBase={variantUsesBase}
              transform={transform}
              exactAssets={exactAssets}
              onSlot={(value) => {
                setSlotId(value);
                setSpriteVariant(null);
              }}
              onDirection={(value) => {
                setDirection(value);
                setSpriteVariant(null);
                setFrame(0);
              }}
              onSpriteVariant={setSpriteVariant}
              onScope={setScope}
              onImage={(key) => {
                const option = exactAssets.find((item) => assetKey(item.asset) === key);
                if (!option) return;
                const fit = ensureFit(option.asset);
                if (!fit) return;
                if (spriteVariant !== null && !variantUsesBase) {
                  const baseline = removeFallbackForTarget(
                    removeFallbacksUsingSource(
                      history.present,
                      fit.slot_id,
                      fit.direction,
                      spriteVariant,
                    ),
                    fit.slot_id,
                    fit.direction,
                    spriteVariant,
                  );
                  edit(
                    replaceVariantFitting(baseline, fit.slot_id, fit.direction, {
                      variant: spriteVariant,
                      asset: { ...option.asset },
                      pivot_px: [...option.pivot_px],
                    }),
                  );
                  return;
                }
                const baseline = removeFallbackForTarget(
                  removeFallbacksUsingSource(
                    history.present,
                    fit.slot_id,
                    fit.direction,
                    baseAssetOption?.variant,
                  ),
                  fit.slot_id,
                  fit.direction,
                  baseAssetOption?.variant,
                );
                edit(
                  replaceFitting(baseline, {
                    ...fit,
                    asset: { ...option.asset },
                    pivot_px: [...option.pivot_px],
                    variant_fittings: (fit.variant_fittings ?? []).filter(
                      (variant) => variant.variant !== option.variant,
                    ),
                  }),
                );
              }}
              onPivot={(pivot) => {
                const fit = ensureFit();
                if (!fit) return;
                if (spriteVariant !== null && !variantUsesBase) {
                  if (currentVariantFit) {
                    edit(
                      replaceVariantFitting(history.present, fit.slot_id, fit.direction, {
                        ...currentVariantFit,
                        pivot_px: pivot,
                      }),
                    );
                  }
                  return;
                }
                edit(replaceFitting(history.present, { ...fit, pivot_px: pivot }));
              }}
              onTransform={updateTransform}
              onVisible={(visible) => {
                const fit = ensureFit();
                if (fit) edit(replaceFitting(history.present, { ...fit, visible }));
              }}
              onLayer={(layer_delta) => {
                const fit = ensureFit();
                if (fit) edit(replaceFitting(history.present, { ...fit, layer_delta }));
              }}
              onOpenDummy={() => void openDummySafely()}
            />
          )}
        </fieldset>
        <OutfitPreview
          context={effectiveContext}
          preview={preview}
          previewError={previewError}
          direction={direction}
          frame={frame}
          playing={playing}
          outlineOpacity={outlineOpacity}
          selectedSlot={slotId}
          missing={missing}
          onDirection={setDirection}
          onFrame={setFrame}
          onTogglePlaying={togglePlayback}
          onOutlineOpacity={setOutlineOpacity}
        />
      </div>
      {saveDialog && (
        <SaveNpcDialog
          labels={context.available_labels}
          busy={commandBusy}
          onCancel={() => setSaveDialog(false)}
          onSave={saveNewNpc}
        />
      )}
      {inspection && (
        <ImportReviewDialog
          busy={commandBusy}
          inspection={inspection}
          onCancel={() => setInspection(null)}
          onConfirm={(decisions) => void confirmImport(decisions)}
          writable={writable}
        />
      )}
    </section>
  );
}
