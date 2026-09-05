import type { Interpolation, Keyframe, MotionTrack } from "../../domain/motion";

export interface TimelineMotion {
  frame_count: number;
  tracks: MotionTrack[];
}

export interface KeySelection {
  trackIndex: number;
  frame: number;
}

export interface ClipboardKey {
  trackIndex: number;
  relativeFrame: number;
  key: Keyframe;
}

export interface RetimePreview {
  oldFrameCount: number;
  newFrameCount: number;
  affected: KeySelection[];
  moved: number;
}

export type RetimeMode = "trim" | "distribute";

export function keyId(selection: KeySelection): string {
  return `${selection.trackIndex}:${selection.frame}`;
}

export function copyKeys(motion: TimelineMotion, selected: ReadonlySet<string>): ClipboardKey[] {
  const keys = motion.tracks.flatMap((track, trackIndex) =>
    track.keys
      .filter((key) => selected.has(keyId({ trackIndex, frame: key.frame })))
      .map((key) => ({ trackIndex, relativeFrame: key.frame, key: { ...key } })),
  );
  if (keys.length === 0) return [];
  const origin = Math.min(...keys.map((item) => item.relativeFrame));
  return keys.map((item) => ({ ...item, relativeFrame: item.relativeFrame - origin }));
}

export function pasteKeys<T extends TimelineMotion>(
  motion: T,
  clipboard: readonly ClipboardKey[],
  targetFrame: number,
): T {
  const tracks = cloneTracks(motion.tracks);
  for (const item of clipboard) {
    const frame = targetFrame + item.relativeFrame;
    const track = tracks[item.trackIndex];
    if (!track || frame < 0 || frame >= motion.frame_count) continue;
    track.keys = track.keys.filter((key) => key.frame !== frame);
    track.keys.push({ ...item.key, frame });
    track.keys.sort((left, right) => left.frame - right.frame);
  }
  return { ...motion, tracks };
}

export function deleteKeys<T extends TimelineMotion>(motion: T, selected: ReadonlySet<string>): T {
  const tracks = motion.tracks
    .map((track, trackIndex) => ({
      ...track,
      keys: track.keys
        .filter((key) => !selected.has(keyId({ trackIndex, frame: key.frame })))
        .map((key) => ({ ...key })),
    }))
    .filter((track) => track.keys.length > 0);
  return { ...motion, tracks };
}

export function moveKeys<T extends TimelineMotion>(
  motion: T,
  selected: ReadonlySet<string>,
  delta: number,
): T | null {
  if (delta === 0) return motion;
  for (const [trackIndex, track] of motion.tracks.entries()) {
    const moving = track.keys.filter((key) =>
      selected.has(keyId({ trackIndex, frame: key.frame })),
    );
    const stationary = new Set(
      track.keys
        .filter((key) => !selected.has(keyId({ trackIndex, frame: key.frame })))
        .map((key) => key.frame),
    );
    if (
      moving.some(
        (key) =>
          key.frame + delta < 0 ||
          key.frame + delta >= motion.frame_count ||
          stationary.has(key.frame + delta),
      )
    ) {
      return null;
    }
  }
  return {
    ...motion,
    tracks: motion.tracks.map((track, trackIndex) => ({
      ...track,
      keys: track.keys
        .map((key) =>
          selected.has(keyId({ trackIndex, frame: key.frame }))
            ? { ...key, frame: key.frame + delta }
            : { ...key },
        )
        .sort((left, right) => left.frame - right.frame),
    })),
  };
}

export function setTrackInterpolation<T extends TimelineMotion>(
  motion: T,
  trackIndex: number,
  interpolation: Interpolation,
): T {
  return {
    ...motion,
    tracks: motion.tracks.map((track, index) =>
      index === trackIndex ? { ...track, interpolation } : { ...track, keys: [...track.keys] },
    ),
  };
}

export function previewRetime(motion: TimelineMotion, newFrameCount: number): RetimePreview {
  return {
    oldFrameCount: motion.frame_count,
    newFrameCount,
    affected: motion.tracks.flatMap((track, trackIndex) =>
      track.keys
        .filter((key) => key.frame >= newFrameCount)
        .map((key) => ({ trackIndex, frame: key.frame })),
    ),
    moved: motion.tracks.reduce(
      (count, track) =>
        count +
        track.keys.filter(
          (key) => distributedFrame(key.frame, motion.frame_count, newFrameCount) !== key.frame,
        ).length,
      0,
    ),
  };
}

export function applyConfirmedRetime<T extends TimelineMotion>(
  motion: T,
  preview: RetimePreview,
  confirmed: boolean,
  mode: RetimeMode = "trim",
): T | null {
  if (preview.newFrameCount < 1 || preview.newFrameCount > 1024) return null;
  if (mode === "trim" && preview.affected.length > 0 && !confirmed) return null;
  if (mode === "distribute") {
    return {
      ...motion,
      frame_count: preview.newFrameCount,
      tracks: motion.tracks.map((track) => {
        const byFrame = new Map<number, Keyframe>();
        for (const key of track.keys) {
          byFrame.set(distributedFrame(key.frame, motion.frame_count, preview.newFrameCount), {
            ...key,
            frame: distributedFrame(key.frame, motion.frame_count, preview.newFrameCount),
          });
        }
        return {
          ...track,
          keys: [...byFrame.values()].sort((left, right) => left.frame - right.frame),
        };
      }),
    };
  }
  return {
    ...motion,
    frame_count: preview.newFrameCount,
    tracks: motion.tracks
      .map((track) => ({
        ...track,
        keys: track.keys
          .filter((key) => key.frame < preview.newFrameCount)
          .map((key) => ({ ...key })),
      }))
      .filter((track) => track.keys.length > 0),
  };
}

export function rangeSelection(
  motion: TimelineMotion,
  trackIndex: number,
  startFrame: number,
  endFrame: number,
): Set<string> {
  const [start, end] = [Math.min(startFrame, endFrame), Math.max(startFrame, endFrame)];
  return new Set(
    (motion.tracks[trackIndex]?.keys ?? [])
      .filter((key) => key.frame >= start && key.frame <= end)
      .map((key) => keyId({ trackIndex, frame: key.frame })),
  );
}

function cloneTracks(tracks: readonly MotionTrack[]): MotionTrack[] {
  return tracks.map((track) => ({
    ...track,
    keys: track.keys.map((key) => ({ ...key })),
  }));
}

function distributedFrame(frame: number, oldCount: number, newCount: number): number {
  if (oldCount <= 1 || newCount <= 1) return 0;
  return Math.round((frame * (newCount - 1)) / (oldCount - 1));
}
