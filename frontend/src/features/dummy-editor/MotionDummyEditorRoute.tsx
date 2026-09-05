import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { motionClient, type MotionClient } from "../../api/motion-client";
import type { MotionEditorData } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { ProfileRevision } from "../../domain/profile";
import { DummyEditorPage, type EditorSlot } from "./DummyEditorPage";
import type { EditorPose } from "./editor-state";
import { poseFromDraft, tracksWithPose } from "./motion-pose";

interface MotionDummyEditorRouteProps {
  sessionId: string;
  templateId: string;
  client?: MotionClient;
  onStatus?: (message: string) => void;
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

export function MotionDummyEditorRoute({
  sessionId,
  templateId,
  client = motionClient,
  onStatus,
}: MotionDummyEditorRouteProps) {
  const [editor, setEditor] = useState<MotionEditorData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [clippingCount, setClippingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const renderSequence = useRef(0);

  useEffect(() => {
    let active = true;
    setEditor(null);
    setPreviewUrl(undefined);
    setError(null);
    void client
      .openEditor(sessionId, templateId)
      .then((value) => {
        if (active) setEditor(value);
      })
      .catch((reason) => {
        if (active) setError(message(reason));
      });
    return () => {
      active = false;
    };
  }, [client, sessionId, templateId]);

  const slotIds = useMemo(() => editor?.profile.slots.map((slot) => slot.id) ?? [], [editor]);
  const initialPoses = useMemo(
    () =>
      editor
        ? Object.fromEntries(
            directions.map((direction) => [
              direction,
              poseFromDraft(editor.draft, direction, slotIds),
            ]),
          )
        : {},
    [editor, slotIds],
  );
  const directionalSlots = useMemo(
    () =>
      editor
        ? Object.fromEntries(
            directions.map((direction) => [
              direction,
              slotsForDirection(editor.profile, direction),
            ]),
          )
        : {},
    [editor],
  );

  const renderPose = useCallback(
    async (pose: EditorPose, direction: Direction) => {
      const sequence = ++renderSequence.current;
      try {
        const preview = await client.renderDummy(sessionId, templateId, direction, pose);
        if (sequence !== renderSequence.current) return;
        setPreviewUrl(preview.data_url);
        setClippingCount(preview.clipping.length);
        setError(null);
      } catch (reason) {
        if (sequence === renderSequence.current) setError(message(reason));
      }
    },
    [client, sessionId, templateId],
  );

  const savePose = useCallback(
    async (pose: EditorPose, direction: Direction) => {
      if (!editor?.writable) throw new Error("This vault is read-only");
      const saved = await client.saveDraft(sessionId, {
        template_id: editor.draft.template_id,
        expected_revision: editor.draft.revision,
        frame_size_px: editor.draft.frame_size_px,
        ground_origin_px: editor.draft.ground_origin_px,
        frame_count: editor.draft.frame_count,
        fps: editor.draft.fps,
        loop_mode: editor.draft.loop_mode,
        directions: editor.draft.directions,
        tracks: tracksWithPose(editor.draft, direction, pose, slotIds),
      });
      setEditor((current) => (current ? { ...current, draft: saved } : current));
      onStatus?.(`${editor.template_name} saved locally as draft r${saved.revision}`);
    },
    [client, editor, onStatus, sessionId, slotIds],
  );

  if (!editor) {
    return (
      <section className="placeholder-panel" aria-live="polite">
        <span className="phase-tag">MOTION TEMPLATE</span>
        <h1>{error ? "Dummy editor unavailable" : "Loading dummy editor…"}</h1>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }

  return (
    <div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      {clippingCount > 0 && (
        <p className="workspace-warning" role="status">
          {clippingCount} body part{clippingCount === 1 ? "" : "s"} cross the frame boundary.
        </p>
      )}
      <DummyEditorPage
        directionalSlots={directionalSlots}
        frameSize={editor.draft.frame_size_px}
        groundOrigin={editor.draft.ground_origin_px}
        initialPose={initialPoses.s ?? {}}
        initialPoses={initialPoses}
        onPoseChange={(pose, direction) => void renderPose(pose, direction)}
        onSave={savePose}
        readOnly={!editor.writable}
        renderedFrameUrl={previewUrl}
        slots={directionalSlots.s ?? []}
        templateName={editor.template_name}
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

function message(reason: unknown): string {
  return reason instanceof Error ? reason.message : String(reason);
}
