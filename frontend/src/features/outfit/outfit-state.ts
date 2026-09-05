import type {
  AssetFallbackApproval,
  Direction,
  OutfitDraft,
  OutfitFitting,
  OutfitLocalOverride,
  MotionRevision,
  ProfileRevision,
  SpriteVariantFitting,
  Transform2D,
} from "../../domain";
import type {
  MissingOutfitSlot,
  OutfitAssetOption,
  OutfitDraftEdits,
} from "../../api/outfit-client";

export type OutfitSaveState = "dirty" | "saving" | "saved" | "failed" | "conflict";

export interface OutfitHistory {
  past: OutfitDraftEdits[];
  present: OutfitDraftEdits;
  future: OutfitDraftEdits[];
  persistedRevision: number;
  editSequence: number;
  savingSequence: number | null;
  saveState: OutfitSaveState;
  saveError: string | null;
}

export type OutfitHistoryAction =
  | { type: "edit"; edits: OutfitDraftEdits }
  | { type: "command_applied"; draft: OutfitDraft }
  | { type: "reloaded"; draft: OutfitDraft }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "save_started" }
  | { type: "save_succeeded"; revision: number; savingSequence: number }
  | { type: "save_failed"; message: string; conflict?: boolean };

export function createOutfitHistory(draft: OutfitDraft): OutfitHistory {
  return {
    past: [],
    present: editsFromDraft(draft),
    future: [],
    persistedRevision: draft.revision,
    editSequence: 0,
    savingSequence: null,
    saveState: "saved",
    saveError: null,
  };
}

export function outfitHistoryReducer(
  state: OutfitHistory,
  action: OutfitHistoryAction,
): OutfitHistory {
  switch (action.type) {
    case "edit":
      if (sameEdits(state.present, action.edits)) return state;
      return {
        ...state,
        past: [...state.past, cloneEdits(state.present)],
        present: cloneEdits(action.edits),
        future: [],
        editSequence: state.editSequence + 1,
        saveState: state.saveState === "conflict" ? "conflict" : "dirty",
        saveError: state.saveState === "conflict" ? state.saveError : null,
      };
    case "command_applied":
      return {
        ...state,
        past: sameEdits(state.present, editsFromDraft(action.draft))
          ? state.past
          : [...state.past, cloneEdits(state.present)],
        present: editsFromDraft(action.draft),
        future: [],
        persistedRevision: action.draft.revision,
        editSequence: state.editSequence + 1,
        savingSequence: null,
        saveState: "saved",
        saveError: null,
      };
    case "reloaded":
      return createOutfitHistory(action.draft);
    case "undo": {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        ...state,
        past: state.past.slice(0, -1),
        present: cloneEdits(previous),
        future: [cloneEdits(state.present), ...state.future],
        editSequence: state.editSequence + 1,
        saveState: state.saveState === "conflict" ? "conflict" : "dirty",
        saveError: state.saveState === "conflict" ? state.saveError : null,
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        past: [...state.past, cloneEdits(state.present)],
        present: cloneEdits(next),
        future: state.future.slice(1),
        editSequence: state.editSequence + 1,
        saveState: state.saveState === "conflict" ? "conflict" : "dirty",
        saveError: state.saveState === "conflict" ? state.saveError : null,
      };
    }
    case "save_started":
      if (!(["dirty", "failed", "conflict"] as OutfitSaveState[]).includes(state.saveState)) {
        return state;
      }
      return {
        ...state,
        savingSequence: state.editSequence,
        saveState: "saving",
        saveError: null,
      };
    case "save_succeeded":
      return {
        ...state,
        persistedRevision: action.revision,
        savingSequence: null,
        saveState: state.editSequence === action.savingSequence ? "saved" : "dirty",
        saveError: null,
      };
    case "save_failed":
      return {
        ...state,
        savingSequence: null,
        saveState: action.conflict ? "conflict" : "failed",
        saveError: action.message,
      };
  }
}

export function editsFromDraft(draft: OutfitDraft): OutfitDraftEdits {
  return cloneEdits({
    fittings: draft.fittings ?? [],
    asset_fallback_approvals: draft.asset_fallback_approvals ?? [],
    local_overrides: draft.local_overrides ?? [],
    equipment: draft.equipment ?? [],
  });
}

export function replaceFitting(edits: OutfitDraftEdits, fitting: OutfitFitting): OutfitDraftEdits {
  const next = edits.fittings.filter(
    (candidate) =>
      candidate.slot_id !== fitting.slot_id || candidate.direction !== fitting.direction,
  );
  next.push(cloneFitting(fitting));
  return { ...cloneEdits(edits), fittings: sortFittings(next) };
}

export function replaceVariantFitting(
  edits: OutfitDraftEdits,
  slotId: string,
  direction: Direction,
  variantFitting: SpriteVariantFitting,
): OutfitDraftEdits {
  const fitting = fittingFor(edits, slotId, direction);
  if (!fitting) return cloneEdits(edits);
  const variant_fittings = (fitting.variant_fittings ?? [])
    .filter((candidate) => candidate.variant !== variantFitting.variant)
    .map(cloneVariantFitting);
  variant_fittings.push(cloneVariantFitting(variantFitting));
  variant_fittings.sort((left, right) => left.variant.localeCompare(right.variant));
  return replaceFitting(edits, { ...cloneFitting(fitting), variant_fittings });
}

export function variantFittingFor(
  fitting: OutfitFitting | undefined,
  variant: string,
): SpriteVariantFitting | undefined {
  return fitting?.variant_fittings?.find((candidate) => candidate.variant === variant);
}

export function spriteVariantsFor(
  motion: MotionRevision,
  profile: ProfileRevision,
  slotId: string,
  targetDirection: Direction,
): string[] {
  const source = sourceTrackFor(motion, profile, slotId, targetDirection);
  if (!source) return [];
  return Array.from(
    new Set(
      motion.tracks
        .filter(
          (track) =>
            track.direction === source.direction &&
            track.slot_id === source.slotId &&
            track.property === "sprite_variant",
        )
        .flatMap((track) => track.keys)
        .map((key) => key.value)
        .filter((value): value is string => typeof value === "string"),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function removeFallbacksUsingSource(
  edits: OutfitDraftEdits,
  slotId: string,
  sourceDirection: Direction,
  variant?: string,
): OutfitDraftEdits {
  return removeAssetFallbackApprovals(
    edits,
    edits.asset_fallback_approvals.filter(
      (approval) =>
        approval.slot_id === slotId &&
        approval.source_direction === sourceDirection &&
        (variant === undefined || approval.variant === variant),
    ),
  );
}

export function removeFallbackForTarget(
  edits: OutfitDraftEdits,
  slotId: string,
  targetDirection: Direction,
  variant?: string,
): OutfitDraftEdits {
  return removeAssetFallbackApprovals(
    edits,
    edits.asset_fallback_approvals.filter(
      (approval) =>
        approval.slot_id === slotId &&
        approval.target_direction === targetDirection &&
        (variant === undefined || approval.variant === variant),
    ),
  );
}

export function replaceLocalOverride(
  edits: OutfitDraftEdits,
  slotId: string,
  direction: Direction,
  transform: Transform2D,
): OutfitDraftEdits {
  const next = edits.local_overrides.filter(
    (candidate) => candidate.slot_id !== slotId || candidate.direction !== direction,
  );
  const override: OutfitLocalOverride = {
    slot_id: slotId,
    direction,
    transform: cloneTransform(transform),
  };
  next.push(override);
  next.sort((left, right) =>
    `${left.slot_id}:${directionRank(left.direction)}`.localeCompare(
      `${right.slot_id}:${directionRank(right.direction)}`,
    ),
  );
  return { ...cloneEdits(edits), local_overrides: next };
}

export function approveAssetFallback(
  edits: OutfitDraftEdits,
  approval: AssetFallbackApproval,
  sourceImageWidth: number,
): OutfitDraftEdits {
  const source = edits.fittings.find(
    (fit) => fit.slot_id === approval.slot_id && fit.direction === approval.source_direction,
  );
  if (!source) return cloneEdits(edits);
  const approvals = edits.asset_fallback_approvals.filter(
    (candidate) =>
      candidate.slot_id !== approval.slot_id ||
      candidate.target_direction !== approval.target_direction ||
      candidate.variant !== approval.variant,
  );
  approvals.push({ ...approval });
  approvals.sort((left, right) =>
    `${left.slot_id}:${directionRank(left.target_direction)}:${left.variant}`.localeCompare(
      `${right.slot_id}:${directionRank(right.target_direction)}:${right.variant}`,
    ),
  );
  const withApproval = { ...cloneEdits(edits), asset_fallback_approvals: approvals };
  const sourceVariant = variantFittingFor(source, approval.variant);
  const sourceImage = sourceVariant ?? { asset: source.asset, pivot_px: source.pivot_px };
  const target = fittingFor(withApproval, approval.slot_id, approval.target_direction);
  if (target) {
    return replaceVariantFitting(withApproval, approval.slot_id, approval.target_direction, {
      variant: approval.variant,
      asset: { ...sourceImage.asset },
      pivot_px: [sourceImageWidth - sourceImage.pivot_px[0], sourceImage.pivot_px[1]],
    });
  }
  return replaceFitting(withApproval, {
    ...cloneFitting(source),
    direction: approval.target_direction,
    asset: { ...sourceImage.asset },
    pivot_px: [sourceImageWidth - sourceImage.pivot_px[0], sourceImage.pivot_px[1]],
    variant_fittings: [],
    transform: {
      offset_px: [-source.transform.offset_px[0], source.transform.offset_px[1]],
      rotation_deg: -source.transform.rotation_deg,
    },
  });
}

export function fittingFor(
  edits: OutfitDraftEdits,
  slotId: string,
  direction: Direction,
): OutfitFitting | undefined {
  return edits.fittings.find(
    (candidate) => candidate.slot_id === slotId && candidate.direction === direction,
  );
}

export function localOverrideFor(
  edits: OutfitDraftEdits,
  slotId: string,
  direction: Direction,
): OutfitLocalOverride | undefined {
  return edits.local_overrides.find(
    (candidate) => candidate.slot_id === slotId && candidate.direction === direction,
  );
}

export function missingRequiredSlots(
  profile: ProfileRevision,
  edits: OutfitDraftEdits,
  motion?: MotionRevision,
  inventory: OutfitAssetOption[] = [],
): MissingOutfitSlot[] {
  return profile.slots
    .map((slot) => ({
      slot_id: slot.id,
      missing_directions: slot.optional
        ? []
        : directions.filter((direction) => !hasExactOrApprovedFallback(edits, slot.id, direction)),
      missing_variants:
        motion && (!slot.optional || edits.fittings.some((fit) => fit.slot_id === slot.id))
          ? directions.flatMap((direction) =>
              spriteVariantsFor(motion, profile, slot.id, direction)
                .filter(
                  (variant) =>
                    !hasExactOrApprovedVariant(edits, inventory, slot.id, direction, variant),
                )
                .map((variant) => ({ direction, variant })),
            )
          : [],
    }))
    .filter(
      (missing) => missing.missing_directions.length > 0 || missing.missing_variants.length > 0,
    );
}

export const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function cloneEdits(edits: OutfitDraftEdits): OutfitDraftEdits {
  return {
    fittings: edits.fittings.map(cloneFitting),
    asset_fallback_approvals: edits.asset_fallback_approvals.map((approval) => ({ ...approval })),
    local_overrides: edits.local_overrides.map((item) => ({
      ...item,
      transform: cloneTransform(item.transform),
    })),
    equipment: edits.equipment.map((item) => ({
      ...cloneEquipmentPart(item),
      additional_parts: item.additional_parts.map(cloneEquipmentPart),
    })),
  };
}

function cloneEquipmentPart<T extends import("../../domain").EquipmentPart>(part: T): T {
  return {
    ...part,
    asset: { ...part.asset },
    fit_by_direction: part.fit_by_direction.map((fit) => ({
      ...fit,
      asset: fit.asset ? { ...fit.asset } : fit.asset,
      pivot_px: fit.pivot_px ? [...fit.pivot_px] : fit.pivot_px,
      variant_fittings: (fit.variant_fittings ?? []).map(cloneVariantFitting),
      transform: cloneTransform(fit.transform),
    })),
    own_motion_tracks: part.own_motion_tracks.map((track) => ({
      ...track,
      keys: track.keys.map((key) => ({
        ...key,
        transform: cloneTransform(key.transform),
      })),
    })),
  };
}

function hasExactOrApprovedFallback(
  edits: OutfitDraftEdits,
  slotId: string,
  targetDirection: Direction,
): boolean {
  if (
    edits.fittings.some(
      (fitting) => fitting.slot_id === slotId && fitting.direction === targetDirection,
    )
  ) {
    return true;
  }
  return edits.asset_fallback_approvals.some(
    (approval) =>
      approval.slot_id === slotId &&
      approval.target_direction === targetDirection &&
      edits.fittings.some(
        (fitting) => fitting.slot_id === slotId && fitting.direction === approval.source_direction,
      ),
  );
}

function hasExactOrApprovedVariant(
  edits: OutfitDraftEdits,
  inventory: OutfitAssetOption[],
  slotId: string,
  targetDirection: Direction,
  variant: string,
): boolean {
  const target = fittingFor(edits, slotId, targetDirection);
  if (target && fittingHasVariant(target, variant, inventory)) return true;
  return edits.asset_fallback_approvals.some(
    (approval) =>
      approval.slot_id === slotId &&
      approval.target_direction === targetDirection &&
      approval.variant === variant &&
      fittingHasVariant(fittingFor(edits, slotId, approval.source_direction), variant, inventory),
  );
}

function removeAssetFallbackApprovals(
  edits: OutfitDraftEdits,
  removals: AssetFallbackApproval[],
): OutfitDraftEdits {
  if (removals.length === 0) return cloneEdits(edits);
  const materialized = removals.map((approval) => {
    const source = fittingFor(edits, approval.slot_id, approval.source_direction);
    const named = variantFittingFor(source, approval.variant);
    return { approval, sourceAsset: named?.asset ?? source?.asset };
  });
  const fittings = edits.fittings.flatMap((candidate) => {
    const applicable = materialized.filter(
      ({ approval }) =>
        approval.slot_id === candidate.slot_id && approval.target_direction === candidate.direction,
    );
    if (
      applicable.some(
        ({ sourceAsset }) =>
          sourceAsset !== undefined &&
          assetReferenceKey(sourceAsset) === assetReferenceKey(candidate.asset),
      )
    ) {
      return [];
    }
    return [
      cloneFitting({
        ...candidate,
        variant_fittings: (candidate.variant_fittings ?? []).filter(
          (variant) =>
            !applicable.some(
              ({ approval, sourceAsset }) =>
                approval.variant === variant.variant &&
                (sourceAsset === undefined ||
                  assetReferenceKey(sourceAsset) === assetReferenceKey(variant.asset)),
            ),
        ),
      }),
    ];
  });
  const removalKeys = new Set(removals.map(assetFallbackKey));
  return {
    ...cloneEdits(edits),
    asset_fallback_approvals: edits.asset_fallback_approvals
      .filter((approval) => !removalKeys.has(assetFallbackKey(approval)))
      .map((approval) => ({ ...approval })),
    fittings: sortFittings(fittings),
  };
}

function assetFallbackKey(approval: AssetFallbackApproval): string {
  return `${approval.slot_id}:${approval.target_direction}:${approval.source_direction}:${approval.variant}`;
}

function fittingHasVariant(
  fitting: OutfitFitting | undefined,
  variant: string,
  inventory: OutfitAssetOption[],
): boolean {
  if (!fitting) return false;
  if (fitting.variant_fittings?.some((candidate) => candidate.variant === variant)) return true;
  return inventory.some(
    (candidate) =>
      assetReferenceKey(candidate.asset) === assetReferenceKey(fitting.asset) &&
      candidate.variant === variant,
  );
}

function assetReferenceKey(asset: { asset_id: string; revision: number; slot_id: string }): string {
  return `${asset.asset_id}:${asset.revision}:${asset.slot_id}`;
}

function cloneFitting(fitting: OutfitFitting): OutfitFitting {
  return {
    ...fitting,
    asset: { ...fitting.asset },
    pivot_px: [...fitting.pivot_px],
    variant_fittings: (fitting.variant_fittings ?? [])
      .map(cloneVariantFitting)
      .sort((left, right) => left.variant.localeCompare(right.variant)),
    transform: cloneTransform(fitting.transform),
  };
}

function cloneVariantFitting(fitting: SpriteVariantFitting): SpriteVariantFitting {
  return {
    ...fitting,
    asset: { ...fitting.asset },
    pivot_px: [...fitting.pivot_px],
  };
}

function cloneTransform(transform: Transform2D): Transform2D {
  return { offset_px: [...transform.offset_px], rotation_deg: transform.rotation_deg };
}

function sortFittings(fittings: OutfitFitting[]): OutfitFitting[] {
  return fittings.sort((left, right) =>
    `${left.slot_id}:${directionRank(left.direction)}`.localeCompare(
      `${right.slot_id}:${directionRank(right.direction)}`,
    ),
  );
}

function directionRank(direction: Direction): number {
  return directions.indexOf(direction);
}

function sourceTrackFor(
  motion: MotionRevision,
  profile: ProfileRevision,
  targetSlotId: string,
  targetDirection: Direction,
): { direction: Direction; slotId: string } | null {
  let direction = targetDirection;
  let mirrored = false;
  const visited = new Set<Direction>();
  while (!visited.has(direction)) {
    visited.add(direction);
    const definition = motion.directions.find((candidate) => candidate.direction === direction);
    if (!definition || definition.mode === "missing") return null;
    if (definition.mode === "explicit") {
      const pair = profile.mirror_pairs.find(
        (candidate) => candidate.left === targetSlotId || candidate.right === targetSlotId,
      );
      const slotId =
        mirrored && pair ? (pair.left === targetSlotId ? pair.right : pair.left) : targetSlotId;
      return { direction, slotId };
    }
    if (!definition.source) return null;
    mirrored = !mirrored;
    direction = definition.source;
  }
  return null;
}

function sameEdits(left: OutfitDraftEdits, right: OutfitDraftEdits): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
