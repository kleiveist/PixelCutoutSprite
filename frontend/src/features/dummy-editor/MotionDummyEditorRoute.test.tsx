import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MotionClient } from "../../api/motion-client";
import type { MotionDraft, MotionEditorData } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { ProfileRevision } from "../../domain/profile";
import { MotionDummyEditorRoute } from "./MotionDummyEditorRoute";

const directions: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];
const profile: ProfileRevision = {
  schema_version: 1,
  kind: "profile_revision",
  profile_id: "22222222-2222-4222-8222-222222222222",
  revision: 1,
  area_id: "33333333-3333-4333-8333-333333333333",
  name: "Humanoid 80px",
  reference_height_px: 80,
  slots: [
    {
      id: "torso",
      parent_id: null,
      optional: false,
      size_px: [20, 20],
      pivot_px: [10, 20],
      base_transform: { offset_px: [0, -20], rotation_deg: 0 },
    },
  ],
  views: directions.map((direction) => ({
    direction,
    layer_order: ["torso"],
    base_transforms: [{ slot_id: "torso", transform: { offset_px: [0, -20], rotation_deg: 0 } }],
  })),
  mirror_pairs: [],
  published_at: "2026-09-05T10:00:00Z",
};
const draft: MotionDraft = {
  schema_version: 1,
  kind: "motion_draft",
  template_id: "11111111-1111-4111-8111-111111111111",
  revision: 1,
  released_from_draft_revision: null,
  profile_ref: { id: profile.profile_id, revision: profile.revision },
  frame_size_px: [128, 128],
  ground_origin_px: [64, 108],
  frame_count: 12,
  fps: 12,
  loop_mode: "loop",
  directions: directions.map((direction) => ({ direction, mode: "explicit", source: null })),
  tracks: [],
  updated_at: "2026-09-05T10:00:00Z",
};

function client(data: MotionEditorData): MotionClient {
  return {
    dashboard: vi.fn(),
    create: vi.fn(),
    duplicate: vi.fn(),
    loadDraft: vi.fn(),
    openEditor: vi.fn(async () => data),
    renderDummy: vi.fn(async () => ({ data_url: "data:image/png;base64,cG5n", clipping: [] })),
    renderSample: vi.fn(async (_session, _template, sampledDraft, direction, sampleIndex) => ({
      data_url: "data:image/png;base64,cG5n",
      clipping: [],
      pose: sampledPose(sampledDraft, direction, sampleIndex),
      source_direction: direction,
      mirror_parity: false,
      sample_index: Math.min(sampleIndex, sampledDraft.frame_count - 1),
    })),
    detachDirection: vi.fn(
      async (_session, _template, currentDraft: MotionDraft, direction: Direction) => ({
        ...currentDraft,
        directions: currentDraft.directions.map((definition) =>
          definition.direction === direction
            ? { direction, mode: "explicit" as const, source: null }
            : definition,
        ),
      }),
    ),
    saveDraft: vi.fn(async (_session, request) => ({
      ...data.draft,
      revision: data.draft.revision + 1,
      frame_size_px: request.frame_size_px,
      ground_origin_px: request.ground_origin_px,
      frame_count: request.frame_count,
      fps: request.fps,
      loop_mode: request.loop_mode,
      directions: request.directions,
      tracks: request.tracks,
    })),
    publish: vi.fn(),
    setArchived: vi.fn(),
    remove: vi.fn(),
    resolveOpen: vi.fn(),
  };
}

describe("MotionDummyEditorRoute", () => {
  it("loads, renders, persists and reopens a selected pose", async () => {
    const editor = { template_name: "Walk", draft, profile, writable: true };
    const api = client(editor);
    const view = render(
      <MotionDummyEditorRoute sessionId="session" templateId={draft.template_id} client={api} />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    await waitFor(() => expect(api.renderSample).toHaveBeenCalled());
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "4" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalled());
    const saved = vi.mocked(api.saveDraft).mock.calls[0][1];
    expect(saved.expected_revision).toBe(1);
    expect(saved.tracks).toContainEqual(
      expect.objectContaining({ direction: "s", slot_id: "torso", property: "offset_x_px" }),
    );

    view.unmount();
    const reopened = client({ ...editor, draft: { ...draft, revision: 2, tracks: saved.tracks } });
    render(
      <MotionDummyEditorRoute
        sessionId="session"
        templateId={draft.template_id}
        client={reopened}
      />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    await waitFor(() => expect(screen.getByLabelText("X offset")).toHaveValue(4));
  });

  it("serializes saves and never marks a newer edit as saved by an older response", async () => {
    const editor = { template_name: "Walk", draft, profile, writable: true };
    const api = client(editor);
    const first = deferred<MotionDraft>();
    const second = deferred<MotionDraft>();
    vi.mocked(api.saveDraft)
      .mockImplementationOnce(async (_session, request) =>
        first.promise.then((value) => ({ ...value, tracks: request.tracks })),
      )
      .mockImplementationOnce(async (_session, request) =>
        second.promise.then((value) => ({ ...value, tracks: request.tracks })),
      );
    render(
      <MotionDummyEditorRoute sessionId="session" templateId={draft.template_id} client={api} />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "2" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "4" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    first.resolve({ ...draft, revision: 2, updated_at: "2026-09-05T10:01:00Z" });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.saveDraft).mock.calls[1][1].expected_revision).toBe(2);
    expect(vi.mocked(api.saveDraft).mock.calls[1][1].tracks).toContainEqual(
      expect.objectContaining({ keys: [{ frame: 0, value: 4 }] }),
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    second.resolve({ ...draft, revision: 3, updated_at: "2026-09-05T10:02:00Z" });
    await waitFor(() => expect(screen.getAllByText("Saved locally").length).toBeGreaterThan(0));
  });

  it("shows direction coverage and detaches a mirrored direction through the native adapter", async () => {
    const mirroredDraft: MotionDraft = {
      ...draft,
      directions: draft.directions.map((definition) =>
        definition.direction === "w"
          ? { direction: "w", mode: "mirrored", source: "e" }
          : definition,
      ),
    };
    const api = client({ template_name: "Walk", draft: mirroredDraft, profile, writable: true });
    render(
      <MotionDummyEditorRoute
        sessionId="session"
        templateId={mirroredDraft.template_id}
        client={api}
      />,
    );

    const source = await screen.findByRole("combobox", { name: "W mirror source" });
    const row = source.closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row!).getByRole("button", { name: "Detach as explicit" }));

    await waitFor(() =>
      expect(api.detachDirection).toHaveBeenCalledWith(
        "session",
        mirroredDraft.template_id,
        expect.objectContaining({ revision: 1 }),
        "w",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "W mode" })).toHaveValue("explicit"),
    );
  });
});

function sampledPose(sampledDraft: MotionDraft, direction: Direction, frame: number) {
  const result: Record<
    string,
    { offsetX: number; offsetY: number; rotation: number; visible: boolean; locked: boolean }
  > = {};
  for (const track of sampledDraft.tracks.filter(
    (candidate) => candidate.direction === direction,
  )) {
    const key =
      [...track.keys].reverse().find((candidate) => candidate.frame <= frame) ?? track.keys[0];
    if (!key) continue;
    const transform = result[track.slot_id] ?? {
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      visible: true,
      locked: false,
    };
    if (track.property === "offset_x_px" && typeof key.value === "number")
      transform.offsetX = key.value;
    if (track.property === "offset_y_px" && typeof key.value === "number")
      transform.offsetY = key.value;
    if (track.property === "rotation_deg" && typeof key.value === "number")
      transform.rotation = key.value;
    if (track.property === "visible" && typeof key.value === "boolean")
      transform.visible = key.value;
    result[track.slot_id] = transform;
  }
  return result;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
