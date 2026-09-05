import type { MotionDraft } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { MotionTrack, TrackProperty } from "../../domain/motion";
import { neutralTransform, type EditorPose } from "./editor-state";

type EditableProperty = "offset_x_px" | "offset_y_px" | "rotation_deg" | "visible";

const editableProperties: readonly EditableProperty[] = [
  "offset_x_px",
  "offset_y_px",
  "rotation_deg",
  "visible",
];

export function poseFromDraft(
  draft: MotionDraft,
  direction: Direction,
  slotIds: readonly string[],
): EditorPose {
  const pose = Object.fromEntries(slotIds.map((slotId) => [slotId, neutralTransform()]));
  for (const track of draft.tracks) {
    if (track.direction !== direction || !isEditableProperty(track.property)) continue;
    const key = track.keys.find((candidate) => candidate.frame === 0) ?? track.keys[0];
    const transform = pose[track.slot_id];
    if (!key || !transform) continue;
    switch (track.property) {
      case "offset_x_px":
        if (typeof key.value === "number") transform.offsetX = key.value;
        break;
      case "offset_y_px":
        if (typeof key.value === "number") transform.offsetY = key.value;
        break;
      case "rotation_deg":
        if (typeof key.value === "number") transform.rotation = key.value;
        break;
      case "visible":
        if (typeof key.value === "boolean") transform.visible = key.value;
        break;
      default:
        break;
    }
  }
  return pose;
}

export function tracksWithPose(
  draft: MotionDraft,
  direction: Direction,
  pose: EditorPose,
  slotIds: readonly string[],
): MotionTrack[] {
  const knownSlots = new Set(slotIds);
  const retained = draft.tracks.filter(
    (track) =>
      track.direction !== direction ||
      !isEditableProperty(track.property) ||
      !knownSlots.has(track.slot_id),
  );
  const edited: MotionTrack[] = [];
  for (const slotId of slotIds) {
    const transform = pose[slotId] ?? neutralTransform();
    if (!Number.isFinite(transform.offsetX) || !Number.isFinite(transform.offsetY)) {
      throw new Error(`Offsets for ${slotId} must be finite numbers`);
    }
    if (!Number.isFinite(transform.rotation)) {
      throw new Error(`Rotation for ${slotId} must be a finite number`);
    }
    const values: Record<EditableProperty, number | boolean> = {
      offset_x_px: transform.offsetX,
      offset_y_px: transform.offsetY,
      rotation_deg: transform.rotation,
      visible: transform.visible,
    };
    for (const property of editableProperties) {
      const existing = draft.tracks.find(
        (track) =>
          track.direction === direction && track.slot_id === slotId && track.property === property,
      );
      const laterKeys = (existing?.keys ?? [])
        .filter((key) => key.frame !== 0)
        .map((key) => ({ ...key }));
      const value = values[property];
      const isNeutral = property === "visible" ? value === true : value === 0;
      if (isNeutral && laterKeys.length === 0) continue;
      edited.push({
        direction,
        slot_id: slotId,
        property,
        interpolation: property === "visible" ? "hold" : (existing?.interpolation ?? "linear"),
        keys: [{ frame: 0, value }, ...laterKeys],
      });
    }
  }
  return [...retained, ...edited];
}

function isEditableProperty(property: TrackProperty): property is EditableProperty {
  return (editableProperties as readonly TrackProperty[]).includes(property);
}
