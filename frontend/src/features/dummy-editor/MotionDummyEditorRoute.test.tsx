import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    saveDraft: vi.fn(async (_session, request) => ({
      ...data.draft,
      revision: data.draft.revision + 1,
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
    await waitFor(() => expect(api.renderDummy).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("X offset"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
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
    expect(screen.getByLabelText("X offset")).toHaveValue(4);
  });
});
