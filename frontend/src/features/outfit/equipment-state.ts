import type { OutfitAssetOption } from "../../api/outfit-client";
import type {
  Direction,
  DirectionFit,
  Equipment,
  EquipmentMotionTrack,
  EquipmentPart,
  SpriteVariantFitting,
  Transform2D,
} from "../../domain";
import { directions } from "./outfit-state";

export interface EquipmentPartChoice extends EquipmentPart {
  primary: boolean;
}

export function isEquipmentAsset(option: OutfitAssetOption): boolean {
  return ["armour", "accessory", "equipment"].includes(option.asset_kind);
}

export function createEquipmentFromInventory(
  rawName: string,
  options: OutfitAssetOption[],
  createId: () => string = () => crypto.randomUUID(),
): Equipment {
  const name = rawName.trim();
  const hasControlCharacter = [...name].some((value) => {
    const code = value.codePointAt(0) ?? 0;
    return code <= 31 || code === 127;
  });
  if (!name || name.length > 120 || name !== rawName || hasControlCharacter) {
    throw new Error("Equipment name must contain 1–120 characters without outer whitespace.");
  }
  if (options.length === 0 || options.some((option) => !isEquipmentAsset(option))) {
    throw new Error("Select at least one armour, accessory, or equipment image.");
  }
  if (options.some((option) => !option.assignable)) {
    throw new Error("Archived or unreleased equipment images cannot be newly assigned.");
  }
  const bySlot = new Map<string, OutfitAssetOption[]>();
  for (const option of options) {
    const group = bySlot.get(option.asset.slot_id) ?? [];
    if (
      group.some(
        (candidate) =>
          candidate.direction === option.direction && candidate.variant === option.variant,
      )
    ) {
      throw new Error(
        `Choose only one ${option.asset.slot_id} image for ${option.direction.toUpperCase()} variant ${option.variant}.`,
      );
    }
    group.push(option);
    bySlot.set(option.asset.slot_id, group);
  }
  const parts = [...bySlot.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slotId, images], index) => buildPart(name, slotId, images, createId(), index));
  const [primary, ...additional] = parts;
  return {
    ...primary,
    name,
    additional_parts: additional,
  };
}

function buildPart(
  equipmentName: string,
  slotId: string,
  images: OutfitAssetOption[],
  id: string,
  index: number,
): EquipmentPart {
  const byDirection = new Map<Direction, OutfitAssetOption[]>();
  for (const image of images) {
    const group = byDirection.get(image.direction) ?? [];
    group.push(image);
    byDirection.set(image.direction, group);
  }
  const directional = [...byDirection.entries()]
    .sort(([left], [right]) => directions.indexOf(left) - directions.indexOf(right))
    .map(([direction, variants]) => {
      const ordered = [...variants].sort((left, right) =>
        left.variant.localeCompare(right.variant),
      );
      const base =
        ordered.find((option) => option.variant === "base") ??
        (ordered.length === 1 ? ordered[0] : undefined);
      if (!base) {
        throw new Error(
          `Choose a base image when assigning multiple ${slotId} variants for ${direction.toUpperCase()}.`,
        );
      }
      return { direction, base, variants: ordered.filter((option) => option !== base) };
    });
  const base = directional[0].base;
  return {
    id,
    name: index === 0 ? equipmentName : `${equipmentName} · ${slotId}`,
    anchor_slot: slotId,
    asset: { ...base.asset },
    enabled: true,
    follow_mode: "slot",
    own_motion_enabled: false,
    fit_by_direction: directional.map(({ direction, base, variants }) => ({
      direction,
      asset: { ...base.asset },
      pivot_px: [...base.pivot_px],
      variant_fittings: variants.map((option) => ({
        variant: option.variant,
        asset: { ...option.asset },
        pivot_px: [...option.pivot_px],
      })),
      transform: identityTransform(),
      visible: true,
      layer_delta: 0,
    })),
    own_motion_tracks: [],
  };
}

export function equipmentParts(item: Equipment): EquipmentPartChoice[] {
  const primary: EquipmentPartChoice = {
    id: item.id,
    name: item.name,
    anchor_slot: item.anchor_slot,
    asset: item.asset,
    enabled: item.enabled,
    follow_mode: item.follow_mode,
    own_motion_enabled: item.own_motion_enabled,
    fit_by_direction: item.fit_by_direction,
    own_motion_tracks: item.own_motion_tracks,
    primary: true,
  };
  return [primary, ...item.additional_parts.map((part) => ({ ...part, primary: false as const }))];
}

export function updateEquipmentPart(
  equipment: Equipment[],
  equipmentId: string,
  partId: string,
  update: (part: EquipmentPart) => EquipmentPart,
): Equipment[] {
  return equipment.map((item) => {
    if (item.id !== equipmentId) return item;
    if (partId === item.id) {
      const changed = update(equipmentParts(item)[0]);
      return {
        ...item,
        name: changed.name,
        anchor_slot: changed.anchor_slot,
        asset: changed.asset,
        enabled: changed.enabled,
        follow_mode: changed.follow_mode,
        own_motion_enabled: changed.own_motion_enabled,
        fit_by_direction: changed.fit_by_direction,
        own_motion_tracks: changed.own_motion_tracks,
      };
    }
    return {
      ...item,
      additional_parts: item.additional_parts.map((part) =>
        part.id === partId ? update(part) : part,
      ),
    };
  });
}

export function fitForEquipmentPart(
  part: EquipmentPart,
  direction: Direction,
): DirectionFit | undefined {
  return part.fit_by_direction.find((fit) => fit.direction === direction);
}

export function replaceEquipmentFit(
  part: EquipmentPart,
  direction: Direction,
  fit: DirectionFit,
): EquipmentPart {
  const fits = part.fit_by_direction.filter((candidate) => candidate.direction !== direction);
  fits.push(fit);
  fits.sort(
    (left, right) => directions.indexOf(left.direction) - directions.indexOf(right.direction),
  );
  return { ...part, fit_by_direction: fits };
}

export function assignEquipmentImage(
  part: EquipmentPart,
  option: OutfitAssetOption,
): EquipmentPart {
  if (!isEquipmentAsset(option) || !option.assignable) {
    throw new Error("Only assignable armour, accessory, or equipment images may be selected.");
  }
  const existing = fitForEquipmentPart(part, option.direction);
  if (existing && option.variant !== "base") {
    const variants: SpriteVariantFitting[] = (existing.variant_fittings ?? [])
      .filter((candidate) => candidate.variant !== option.variant)
      .map((candidate) => ({
        ...candidate,
        asset: { ...candidate.asset },
        pivot_px: [candidate.pivot_px[0], candidate.pivot_px[1]],
      }));
    variants.push({
      variant: option.variant,
      asset: { ...option.asset },
      pivot_px: [option.pivot_px[0], option.pivot_px[1]],
    });
    variants.sort((left, right) => left.variant.localeCompare(right.variant));
    return replaceEquipmentFit(part, option.direction, {
      ...existing,
      variant_fittings: variants,
    });
  }
  return replaceEquipmentFit(part, option.direction, {
    direction: option.direction,
    asset: { ...option.asset },
    pivot_px: [...option.pivot_px],
    variant_fittings:
      existing?.variant_fittings?.map((candidate) => ({
        ...candidate,
        asset: { ...candidate.asset },
        pivot_px: [candidate.pivot_px[0], candidate.pivot_px[1]],
      })) ?? [],
    transform: existing?.transform ?? identityTransform(),
    visible: existing?.visible ?? true,
    layer_delta: existing?.layer_delta ?? 0,
  });
}

export function updateEquipmentFit(
  part: EquipmentPart,
  direction: Direction,
  update: (fit: DirectionFit) => DirectionFit,
): EquipmentPart {
  const fit = fitForEquipmentPart(part, direction);
  return fit ? replaceEquipmentFit(part, direction, update(fit)) : part;
}

export function setEquipmentTrackEnabled(
  part: EquipmentPart,
  direction: Direction,
  frame: number,
  enabled: boolean,
): EquipmentPart {
  const track = motionTrackFor(part, direction);
  const replacement: EquipmentMotionTrack = track
    ? { ...track, enabled }
    : {
        direction,
        enabled,
        interpolation: "linear",
        keys: [{ frame, transform: identityTransform() }],
      };
  return replaceMotionTrack(part, replacement);
}

export function setEquipmentTrackInterpolation(
  part: EquipmentPart,
  direction: Direction,
  interpolation: EquipmentMotionTrack["interpolation"],
): EquipmentPart {
  const track = motionTrackFor(part, direction);
  return track ? replaceMotionTrack(part, { ...track, interpolation }) : part;
}

export function setEquipmentMotionKey(
  part: EquipmentPart,
  direction: Direction,
  frame: number,
  transform: Transform2D,
): EquipmentPart {
  const track = motionTrackFor(part, direction);
  if (!track) return part;
  const keys = track.keys.filter((key) => key.frame !== frame);
  keys.push({ frame, transform });
  keys.sort((left, right) => left.frame - right.frame);
  return replaceMotionTrack(part, { ...track, keys });
}

export function removeEquipmentMotionKey(
  part: EquipmentPart,
  direction: Direction,
  frame: number,
): EquipmentPart {
  const track = motionTrackFor(part, direction);
  if (!track || track.keys.length === 1) return part;
  return replaceMotionTrack(part, {
    ...track,
    keys: track.keys.filter((key) => key.frame !== frame),
  });
}

export function motionTrackFor(
  part: EquipmentPart,
  direction: Direction,
): EquipmentMotionTrack | undefined {
  return part.own_motion_tracks.find((track) => track.direction === direction);
}

export function motionKeyTransform(
  part: EquipmentPart,
  direction: Direction,
  frame: number,
): Transform2D {
  return (
    motionTrackFor(part, direction)?.keys.find((key) => key.frame === frame)?.transform ??
    identityTransform()
  );
}

export function missingEquipmentDirections(part: EquipmentPart): Direction[] {
  return directions.filter((direction) => !fitForEquipmentPart(part, direction)?.asset);
}

export function equipmentStateLabel(part: EquipmentPart): string {
  if (!part.enabled) return "Hidden · values retained";
  if (!part.own_motion_enabled) {
    return part.follow_mode === "slot"
      ? "Following body slot · own motion off"
      : "Following figure root · own motion off";
  }
  return "Own motion active";
}

function replaceMotionTrack(part: EquipmentPart, replacement: EquipmentMotionTrack): EquipmentPart {
  const tracks = part.own_motion_tracks.filter(
    (track) => track.direction !== replacement.direction,
  );
  tracks.push(replacement);
  tracks.sort(
    (left, right) => directions.indexOf(left.direction) - directions.indexOf(right.direction),
  );
  return { ...part, own_motion_tracks: tracks };
}

function identityTransform(): Transform2D {
  return { offset_px: [0, 0], rotation_deg: 0 };
}
