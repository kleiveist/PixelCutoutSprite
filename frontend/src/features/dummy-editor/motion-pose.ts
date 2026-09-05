import type { MotionDraft } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { Interpolation, MotionTrack, TrackProperty, TrackValue } from "../../domain/motion";
import { neutralTransform, type EditorPose, type EditorTransform } from "./editor-state";

type EditableProperty = "offset_x_px" | "offset_y_px" | "rotation_deg" | "visible";

const editableProperties: readonly EditableProperty[] = [
  "offset_x_px",
  "offset_y_px",
  "rotation_deg",
  "visible",
];

const transformFields: Record<EditableProperty, keyof EditorTransform> = {
  offset_x_px: "offsetX",
  offset_y_px: "offsetY",
  rotation_deg: "rotation",
  visible: "visible",
};

export interface PoseEditResult {
  draft: MotionDraft;
  changed: boolean;
  missingKeys: string[];
}

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

export function applyPoseAtFrame(
  draft: MotionDraft,
  direction: Direction,
  frame: number,
  before: EditorPose,
  after: EditorPose,
  slotIds: readonly string[],
  autoKey: boolean,
): PoseEditResult {
  const changes = changedChannels(before, after, slotIds);
  const missingKeys = changes
    .filter(({ slotId, property }) => {
      const track = findTrack(draft.tracks, direction, slotId, property);
      return !track?.keys.some((key) => key.frame === frame);
    })
    .map(({ slotId, property }) => `${slotId}.${property}`);
  if (!autoKey && missingKeys.length > 0) {
    return { draft, changed: false, missingKeys };
  }
  if (changes.length === 0) return { draft, changed: false, missingKeys: [] };

  let tracks = cloneTracks(draft.tracks);
  for (const { slotId, property, value } of changes) {
    tracks = upsertKey(tracks, direction, slotId, property, frame, value);
  }
  return { draft: { ...draft, tracks }, changed: true, missingKeys: [] };
}

export function addPoseKeyframes(
  draft: MotionDraft,
  direction: Direction,
  frame: number,
  pose: EditorPose,
  slotIds: readonly string[],
): MotionDraft {
  let tracks = cloneTracks(draft.tracks);
  for (const slotId of slotIds) {
    const transform = pose[slotId] ?? neutralTransform();
    for (const property of editableProperties) {
      tracks = upsertKey(
        tracks,
        direction,
        slotId,
        property,
        frame,
        transform[transformFields[property]] as TrackValue,
      );
    }
  }
  return { ...draft, tracks };
}

function isEditableProperty(property: TrackProperty): property is EditableProperty {
  return (editableProperties as readonly TrackProperty[]).includes(property);
}

function changedChannels(
  before: EditorPose,
  after: EditorPose,
  slotIds: readonly string[],
): Array<{ slotId: string; property: EditableProperty; value: TrackValue }> {
  return slotIds.flatMap((slotId) => {
    const previous = before[slotId] ?? neutralTransform();
    const next = after[slotId] ?? neutralTransform();
    return editableProperties.flatMap((property) => {
      const field = transformFields[property];
      return previous[field] === next[field]
        ? []
        : [{ slotId, property, value: next[field] as TrackValue }];
    });
  });
}

function findTrack(
  tracks: readonly MotionTrack[],
  direction: Direction,
  slotId: string,
  property: EditableProperty,
): MotionTrack | undefined {
  return tracks.find(
    (track) =>
      track.direction === direction && track.slot_id === slotId && track.property === property,
  );
}

function upsertKey(
  tracks: MotionTrack[],
  direction: Direction,
  slotId: string,
  property: EditableProperty,
  frame: number,
  value: TrackValue,
): MotionTrack[] {
  const index = tracks.findIndex(
    (track) =>
      track.direction === direction && track.slot_id === slotId && track.property === property,
  );
  if (index < 0) {
    return [
      ...tracks,
      {
        direction,
        slot_id: slotId,
        property,
        interpolation: defaultInterpolation(property),
        keys: [{ frame, value }],
      },
    ];
  }
  return tracks.map((track, trackIndex) => {
    if (trackIndex !== index) return track;
    const keys = track.keys.filter((key) => key.frame !== frame);
    keys.push({ frame, value });
    keys.sort((left, right) => left.frame - right.frame);
    return { ...track, keys };
  });
}

function defaultInterpolation(property: EditableProperty): Interpolation {
  return property === "visible" ? "hold" : "linear";
}

function cloneTracks(tracks: readonly MotionTrack[]): MotionTrack[] {
  return tracks.map((track) => ({
    ...track,
    keys: track.keys.map((key) => ({ ...key })),
  }));
}
