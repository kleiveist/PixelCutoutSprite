import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MotionClient } from "../../api/motion-client";
import type { MotionDraft, MotionEditorData } from "../../domain/animations";
import type { Direction } from "../../domain/common";
import type { ProfileRevision } from "../../domain/profile";
import { guardEditorNavigation, type EditorController } from "../editing";
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
const initialSha256 = "a".repeat(64);

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
    bakeHelper: vi.fn(async (_session, _template, currentDraft) => currentDraft),
    cardPreview: vi.fn(),
    saveDraft: vi.fn(async (_session, request) => ({
      ...data,
      draft_sha256: "b".repeat(64),
      draft: {
        ...data.draft,
        revision: data.draft.revision + 1,
        frame_size_px: request.frame_size_px,
        ground_origin_px: request.ground_origin_px,
        frame_count: request.frame_count,
        fps: request.fps,
        loop_mode: request.loop_mode,
        directions: request.directions,
        tracks: request.tracks,
      },
    })),
    publish: vi.fn(),
    setArchived: vi.fn(),
    remove: vi.fn(),
    resolveOpen: vi.fn(),
  };
}

describe("MotionDummyEditorRoute", () => {
  it("loads, renders, persists and reopens a selected pose", async () => {
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
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
    expect(saved.expected_sha256).toBe(initialSha256);
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
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
    const api = client(editor);
    const first = deferred<MotionEditorData>();
    const second = deferred<MotionEditorData>();
    vi.mocked(api.saveDraft)
      .mockImplementationOnce(async (_session, request) =>
        first.promise.then((value) => ({
          ...value,
          draft: { ...value.draft, tracks: request.tracks },
        })),
      )
      .mockImplementationOnce(async (_session, request) =>
        second.promise.then((value) => ({
          ...value,
          draft: { ...value.draft, tracks: request.tracks },
        })),
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
    first.resolve({
      ...editor,
      draft_sha256: "b".repeat(64),
      draft: { ...draft, revision: 2, updated_at: "2026-09-05T10:01:00Z" },
    });
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.saveDraft).mock.calls[1][1].expected_revision).toBe(2);
    expect(vi.mocked(api.saveDraft).mock.calls[1][1].expected_sha256).toBe("b".repeat(64));
    expect(vi.mocked(api.saveDraft).mock.calls[1][1].tracks).toContainEqual(
      expect.objectContaining({ keys: [{ frame: 0, value: 4 }] }),
    );
    expect(screen.getByText("Saving…")).toBeInTheDocument();

    second.resolve({
      ...editor,
      draft_sha256: "c".repeat(64),
      draft: { ...draft, revision: 3, updated_at: "2026-09-05T10:02:00Z" },
    });
    await waitFor(() => expect(screen.getAllByText("Saved locally").length).toBeGreaterThan(0));
  });

  it("registers its real save queue with the navigation guard", async () => {
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
    const api = client(editor);
    const pending = deferred<MotionEditorData>();
    vi.mocked(api.saveDraft).mockImplementationOnce(async () => pending.promise);
    const registration = { current: null as EditorController | null };
    render(
      <MotionDummyEditorRoute
        sessionId="session"
        templateId={draft.template_id}
        client={api}
        onEditorControllerChange={(controller) => {
          registration.current = controller;
        }}
      />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "5" } });
    await waitFor(() => expect(registration.current?.getState().dirty).toBe(true));
    expect(registration.current?.getState()).toMatchObject({
      saveState: "dirty",
      mutationInFlight: false,
      canUndo: true,
    });

    let saving!: Promise<void>;
    act(() => {
      saving = registration.current!.save();
    });
    expect(registration.current!.getState().mutationInFlight).toBe(true);
    const confirm = vi.fn(() => true);
    expect(guardEditorNavigation(registration.current!, confirm)).toMatchObject({
      allowed: false,
      reason: "mutation_in_flight",
    });
    expect(confirm).not.toHaveBeenCalled();

    await act(async () => {
      pending.resolve({
        ...editor,
        draft_sha256: "b".repeat(64),
        draft: { ...draft, revision: 2, updated_at: "2026-09-05T10:01:00Z" },
      });
      await saving;
    });
    expect(registration.current!.getState()).toMatchObject({
      saveState: "saved",
      dirty: false,
      mutationInFlight: false,
    });

    act(() => registration.current!.undo());
    expect(registration.current!.getState()).toMatchObject({ saveState: "dirty", canRedo: true });
    act(() => registration.current!.redo());
    expect(registration.current!.getState()).toMatchObject({ saveState: "saved", canUndo: true });
  });

  it("classifies a write conflict and keeps retry, safe-copy, and reload actions available", async () => {
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
    const reloaded = {
      ...editor,
      draft: { ...draft, revision: 3, updated_at: "2026-09-05T10:03:00Z" },
    };
    const api = client(editor);
    vi.mocked(api.openEditor).mockResolvedValueOnce(editor).mockResolvedValueOnce(reloaded);
    vi.mocked(api.saveDraft).mockRejectedValueOnce({
      code: "write_conflict",
      message: "motion revision changed outside this editor",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MotionDummyEditorRoute sessionId="session" templateId={draft.template_id} client={api} />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "7" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("changed outside this editor");
    expect(screen.getByRole("button", { name: "Retry write" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save recovery copy" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "8" } });
    expect(screen.getByRole("button", { name: "Reload saved draft" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reload saved draft" }));

    await waitFor(() => expect(api.openEditor).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("keeps a recovery copy available after an ordinary write failure", async () => {
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
    const api = client(editor);
    vi.mocked(api.saveDraft).mockRejectedValueOnce(new Error("permission denied"));
    render(
      <MotionDummyEditorRoute sessionId="session" templateId={draft.template_id} client={api} />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "7" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);

    expect(await screen.findByRole("alert")).toHaveTextContent("permission denied");
    expect(screen.getByRole("button", { name: "Retry save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save recovery copy" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reload saved draft" })).not.toBeInTheDocument();
  });

  it("blocks editor mutations while a conflict reload is in flight", async () => {
    const editor = {
      template_name: "Walk",
      draft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    };
    const reload = deferred<MotionEditorData>();
    const api = client(editor);
    vi.mocked(api.openEditor)
      .mockResolvedValueOnce(editor)
      .mockImplementationOnce(async () => reload.promise);
    vi.mocked(api.saveDraft).mockRejectedValueOnce({
      code: "write_conflict",
      message: "motion draft changed outside this editor",
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <MotionDummyEditorRoute sessionId="session" templateId={draft.template_id} client={api} />,
    );
    await screen.findByLabelText("Reusable motion template Walk");
    fireEvent.click(screen.getByLabelText("Auto-key"));
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "9" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save" })[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Reload saved draft" }));

    await waitFor(() => expect(screen.getByLabelText("X offset")).toBeDisabled());
    expect(screen.getByRole("combobox", { name: "Direction" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add/update pose key" })).toBeDisabled();

    await act(async () => {
      reload.resolve({
        ...editor,
        draft_sha256: "e".repeat(64),
        draft: { ...draft, revision: 2, updated_at: "2026-09-05T10:05:00Z" },
      });
    });
    await waitFor(() => expect(screen.getByLabelText("X offset")).toBeEnabled());
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
    const api = client({
      template_name: "Walk",
      draft: mirroredDraft,
      draft_sha256: initialSha256,
      profile,
      writable: true,
    });
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
