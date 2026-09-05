import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MotionClient } from "../../api/motion-client";
import type { MotionCard, MotionDashboardData, MotionOpenTarget } from "../../domain/animations";
import type { MotionRevision } from "../../domain/motion";
import { AnimationDashboard } from "./AnimationDashboard";

const released: MotionCard = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 3,
  area_id: "22222222-2222-4222-8222-222222222222",
  name: "Village walk",
  action_key: "walk",
  status: "unpublished_changes",
  label_ids: ["88888888-8888-4888-8888-888888888888"],
  profile_ref: { id: "33333333-3333-4333-8333-333333333333", revision: 1 },
  frame_count: 12,
  fps: 12,
  loop_mode: "loop",
  direction_coverage: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
  released_revisions: [1],
  latest_release: 1,
  updated_at: "2026-09-05T10:00:00Z",
};

const draft: MotionCard = {
  ...released,
  id: "44444444-4444-4444-8444-444444444444",
  revision: 1,
  name: "Jump",
  action_key: "jump",
  status: "new",
  released_revisions: [],
  latest_release: null,
  updated_at: "2026-09-05T11:00:00Z",
};

const dashboard: MotionDashboardData = {
  area_id: released.area_id,
  motions: [released, draft],
  profiles: [released.profile_ref],
  writable: true,
};
const selectedCharacterId = "99999999-9999-4999-8999-999999999999";

function mockClient(): MotionClient {
  return {
    dashboard: vi.fn(async () => dashboard),
    create: vi.fn(async (_session, request) => ({
      ...draft,
      name: request.name,
      action_key: request.action_key,
      frame_count: request.frame_count,
      fps: request.fps,
    })),
    duplicate: vi.fn(async () => ({ ...draft, id: "55555555-5555-4555-8555-555555555555" })),
    loadDraft: vi.fn(),
    openEditor: vi.fn(),
    renderDummy: vi.fn(),
    renderSample: vi.fn(),
    detachDirection: vi.fn(),
    bakeHelper: vi.fn(),
    cardPreview: vi.fn(async () => ({
      frame_urls: ["data:image/png;base64,cG5n"],
      sample_indices: [0],
      fps: 1,
      direction: "s" as const,
      clipping_count: 0,
    })),
    saveDraft: vi.fn(),
    publish: vi.fn(async (): Promise<MotionRevision> => ({
      schema_version: 1,
      kind: "motion_revision",
      template_id: released.id,
      revision: 1,
      profile_ref: released.profile_ref,
      frame_size_px: [128, 128],
      ground_origin_px: [64, 108],
      frame_count: 12,
      fps: 12,
      loop_mode: "loop",
      directions: [],
      tracks: [],
      published_at: "2026-09-05T12:00:00Z",
    })),
    setArchived: vi.fn(async (): Promise<MotionCard> => ({ ...released, status: "archived" })),
    remove: vi.fn(async () => undefined),
    resolveOpen: vi.fn(async (): Promise<MotionOpenTarget> => ({
      kind: "outfit_chooser",
      template_id: released.id,
      template_revision: 1,
      compatible_character_ids: [
        "66666666-6666-4666-8666-666666666666",
        "77777777-7777-4777-8777-777777777777",
      ],
    })),
  };
}

describe("AnimationDashboard", () => {
  it("routes released cards to a visible chooser and keeps dummy access visible", async () => {
    const client = mockClient();
    const onOpen = vi.fn();
    const onOpenNpcs = vi.fn();
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        characterId={selectedCharacterId}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={onOpen}
        onOpenNpcs={onOpenNpcs}
      />,
    );
    await screen.findByRole("heading", { name: "Animations" });
    fireEvent.click(screen.getByRole("button", { name: "NPCs" }));
    expect(onOpenNpcs).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Village walk labels")).toHaveTextContent("#88888888");
    fireEvent.click(screen.getByText("Village walk").closest("button")!);
    await waitFor(() =>
      expect(onOpen).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "outfit_chooser",
          compatible_character_ids: expect.any(Array),
        }),
      ),
    );
    expect(client.resolveOpen).toHaveBeenCalledWith("session", released.id, selectedCharacterId);
    fireEvent.click(screen.getByRole("button", { name: "Edit Village walk dummy" }));
    expect(onOpen).toHaveBeenLastCalledWith({ kind: "dummy_editor", template_id: released.id });

    fireEvent.contextMenu(screen.getByText("Village walk").closest("article")!);
    const menu = screen.getByRole("menu", { name: "Village walk menu" });
    expect(within(menu).getByRole("menuitem", { name: "Open dummy editor" })).toBeVisible();
  });

  it("exposes structured filters as dropdowns and every context action as a button", async () => {
    const client = mockClient();
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={vi.fn()}
      />,
    );
    await screen.findByText("Village walk");
    for (const name of ["Direction", "Status", "Profile", "Sort"]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "draft" },
    });
    expect(screen.getByText("Jump")).toBeInTheDocument();
    expect(screen.queryByText("Village walk")).not.toBeInTheDocument();
    const actions = screen.getByRole("group", { name: "Actions for Jump" });
    fireEvent.click(within(actions).getByRole("button", { name: "Duplicate" }));
    await waitFor(() => expect(client.duplicate).toHaveBeenCalledWith("session", draft.id));
  });

  it("rejects invalid timing and creates a valid draft directly into the dummy", async () => {
    const client = mockClient();
    const onOpen = vi.fn();
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={onOpen}
      />,
    );
    await screen.findByRole("heading", { name: "Animations" });
    fireEvent.click(screen.getByRole("button", { name: "New animation" }));
    const submit = screen.getByRole("button", { name: "Create and open dummy" });
    fireEvent.change(screen.getByRole("spinbutton", { name: "FPS" }), { target: { value: "0" } });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByRole("spinbutton", { name: "FPS" }), { target: { value: "24" } });
    fireEvent.click(submit);
    await waitFor(() => expect(client.create).toHaveBeenCalled());
    expect(client.create).toHaveBeenCalledWith(
      "session",
      expect.objectContaining({ preset_kind: "walk" }),
    );
    expect(onOpen).toHaveBeenCalledWith({ kind: "dummy_editor", template_id: draft.id });
  });

  it("checks all direction coverage before creating an immutable release", async () => {
    const client = mockClient();
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={vi.fn()}
      />,
    );
    await screen.findByText("Jump");
    const actions = screen.getByRole("group", { name: "Actions for Jump" });
    fireEvent.click(within(actions).getByRole("button", { name: "Release dummy" }));
    expect(screen.getByRole("dialog", { name: "Release Jump?" })).toHaveTextContent(
      "All eight directions resolve",
    );
    fireEvent.click(screen.getByRole("button", { name: "Release immutable revision" }));
    await waitFor(() => expect(client.publish).toHaveBeenCalledWith("session", draft.id));
  });

  it("blocks navigation and other motion changes while a release is publishing", async () => {
    let finishPublish: ((value: Awaited<ReturnType<MotionClient["publish"]>>) => void) | undefined;
    const client = mockClient();
    vi.mocked(client.publish).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishPublish = resolve;
        }),
    );
    const onOpen = vi.fn();
    const onOpenNpcs = vi.fn();
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={onOpen}
        onOpenNpcs={onOpenNpcs}
      />,
    );
    await screen.findByText("Jump");
    const actions = screen.getByRole("group", { name: "Actions for Jump" });
    fireEvent.click(within(actions).getByRole("button", { name: "Release dummy" }));
    fireEvent.click(screen.getByRole("button", { name: "Release immutable revision" }));

    await waitFor(() => expect(client.publish).toHaveBeenCalledWith("session", draft.id));
    expect(screen.getByRole("button", { name: "NPCs" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "New animation" })).toBeDisabled();
    expect(within(actions).getByRole("button", { name: "Edit Jump dummy" })).toBeDisabled();
    expect(within(actions).getByRole("button", { name: "Duplicate" })).toBeDisabled();
    expect(onOpen).not.toHaveBeenCalled();
    expect(onOpenNpcs).not.toHaveBeenCalled();

    finishPublish?.({
      schema_version: 1,
      kind: "motion_revision",
      template_id: released.id,
      revision: 1,
      profile_ref: released.profile_ref,
      frame_size_px: [128, 128],
      ground_origin_px: [64, 108],
      frame_count: 12,
      fps: 12,
      loop_mode: "loop",
      directions: [],
      tracks: [],
      published_at: "2026-09-05T12:00:00Z",
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "NPCs" })).toBeEnabled());
  });

  it("blocks guided release when a stored direction is missing", async () => {
    const client = mockClient();
    vi.mocked(client.dashboard).mockResolvedValue({
      ...dashboard,
      motions: [{ ...draft, direction_coverage: ["s"] }],
    });
    render(
      <AnimationDashboard
        sessionId="session"
        areaId={released.area_id}
        defaultFrameSize={[128, 128]}
        defaultGroundOrigin={[64, 108]}
        client={client}
        onOpen={vi.fn()}
      />,
    );
    await screen.findByText("Jump");
    fireEvent.click(screen.getByRole("button", { name: "Release dummy" }));
    expect(screen.getByRole("button", { name: "Release immutable revision" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("resolve every direction");
    expect(client.publish).not.toHaveBeenCalled();
  });
});
