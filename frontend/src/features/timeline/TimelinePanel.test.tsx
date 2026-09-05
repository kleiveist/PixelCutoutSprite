import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MotionRevision } from "../../domain/motion";
import { TimelinePanel } from "./TimelinePanel";

const clip: MotionRevision = {
  schema_version: 1,
  kind: "motion_revision",
  template_id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  profile_ref: { id: "22222222-2222-4222-8222-222222222222", revision: 1 },
  frame_size_px: [128, 128],
  ground_origin_px: [64, 108],
  frame_count: 12,
  fps: 12,
  loop_mode: "loop",
  directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"].map((direction) => ({
    direction: direction as "n",
    mode: "explicit",
  })),
  tracks: [
    {
      direction: "s",
      slot_id: "head",
      property: "rotation_deg",
      interpolation: "linear",
      keys: [
        { frame: 0, value: 0 },
        { frame: 6, value: 10 },
        { frame: 11, value: 0 },
      ],
    },
  ],
  published_at: "2026-09-05T10:00:00Z",
};

describe("TimelinePanel", () => {
  it("steps frames and keeps preview speed separate from persisted fps", () => {
    const onFrameChange = vi.fn();
    render(
      <TimelinePanel
        motion={clip}
        frame={4}
        playing={false}
        onFrameChange={onFrameChange}
        onPlayingChange={vi.fn()}
        onMotionChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Next frame" }));
    expect(onFrameChange).toHaveBeenCalledWith(5);
    fireEvent.change(screen.getByLabelText("Preview speed"), { target: { value: "2" } });
    expect(clip.fps).toBe(12);
  });

  it("shows truncation consequences before changing data", () => {
    const onMotionChange = vi.fn();
    render(
      <TimelinePanel
        motion={clip}
        frame={0}
        playing={false}
        onFrameChange={vi.fn()}
        onPlayingChange={vi.fn()}
        onMotionChange={onMotionChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change length…" }));
    fireEvent.change(screen.getByLabelText("Frames"), { target: { value: "7" } });
    expect(screen.getByText(/1 keyframe\(s\) will be removed/)).toBeInTheDocument();
    expect(onMotionChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm truncation" }));
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({ frame_count: 7 }),
      "Retime to 7 frames",
    );
  });

  it("scrubs, selects a range, moves keys, changes interpolation and delegates undo", () => {
    const onFrameChange = vi.fn();
    const onMotionChange = vi.fn();
    const onUndo = vi.fn();
    render(
      <TimelinePanel
        canUndo
        motion={clip}
        frame={0}
        playing={false}
        onFrameChange={onFrameChange}
        onPlayingChange={vi.fn()}
        onMotionChange={onMotionChange}
        onUndo={onUndo}
      />,
    );
    fireEvent.change(screen.getByLabelText("Scrub timeline"), { target: { value: "5" } });
    expect(onFrameChange).toHaveBeenCalledWith(5);
    fireEvent.click(screen.getByLabelText("head rotation_deg key at frame 0"));
    fireEvent.click(screen.getByLabelText("head rotation_deg key at frame 6"), {
      shiftKey: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Move selected keys right" }));
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({ tracks: [expect.objectContaining({ keys: expect.any(Array) })] }),
      "Move keyframes right",
    );
    fireEvent.change(screen.getByLabelText("head rotation_deg interpolation"), {
      target: { value: "ease_in_out" },
    });
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        tracks: [expect.objectContaining({ interpolation: "ease_in_out" })],
      }),
      "Change interpolation",
    );
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("shows persisted helpers and makes disabling or converting them explicit", () => {
    const onMotionChange = vi.fn();
    const onBakeHelper = vi.fn();
    const preset = {
      ...clip,
      semantics: {
        preset: "walk" as const,
        root_motion: "in_place" as const,
        recommended_speed_px_per_second: 48,
        jump_height_mode: "not_applicable" as const,
        ground_shadow: { enabled: true, width_px: 28, height_px: 8, opacity: 72 },
        helpers: [
          {
            kind: "body_bob" as const,
            slot_id: "torso",
            property: "offset_y_px" as const,
            amplitude: 2,
            cycles: 2,
            phase: 0,
            enabled: true,
          },
        ],
      },
    };
    render(
      <TimelinePanel
        motion={preset}
        frame={0}
        playing={false}
        onFrameChange={vi.fn()}
        onPlayingChange={vi.fn()}
        onMotionChange={onMotionChange}
        onBakeHelper={onBakeHelper}
      />,
    );
    expect(screen.getByText("48 px/s recommended game speed")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: "Body bob" }));
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        semantics: expect.objectContaining({
          helpers: [expect.objectContaining({ enabled: false })],
        }),
      }),
      "Disable Body bob helper",
    );
    fireEvent.click(screen.getByRole("button", { name: "Convert to keys" }));
    expect(onBakeHelper).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByRole("checkbox", { name: "Ground shadow" }));
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({
        semantics: expect.objectContaining({
          ground_shadow: expect.objectContaining({ enabled: false }),
        }),
      }),
      "Hide ground shadow",
    );
  });

  it("lets focused gridcells edit the timeline while preserving native Space activation", () => {
    const onFrameChange = vi.fn();
    const onMotionChange = vi.fn();
    const onPlayingChange = vi.fn();
    const onSave = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    render(
      <TimelinePanel
        motion={clip}
        frame={4}
        playing={false}
        onFrameChange={onFrameChange}
        onPlayingChange={onPlayingChange}
        onMotionChange={onMotionChange}
        onSave={onSave}
        onUndo={onUndo}
        onRedo={onRedo}
      />,
    );
    const key = screen.getByRole("gridcell", { name: "head rotation_deg key at frame 0" });
    fireEvent.click(key);
    fireEvent.keyDown(key, { key: "ArrowRight" });
    expect(onFrameChange).toHaveBeenCalledWith(5);
    fireEvent.keyDown(key, { key: "s", ctrlKey: true });
    fireEvent.keyDown(key, { key: "z", ctrlKey: true });
    fireEvent.keyDown(key, { key: "y", ctrlKey: true });
    expect(onSave).toHaveBeenCalledOnce();
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    fireEvent.keyDown(key, { key: " " });
    expect(onPlayingChange).not.toHaveBeenCalled();
    fireEvent.keyDown(key, { key: "Delete" });
    expect(onMotionChange).toHaveBeenCalledWith(
      expect.objectContaining({ tracks: [expect.objectContaining({ keys: expect.any(Array) })] }),
      "Delete keyframes",
    );
  });
});
