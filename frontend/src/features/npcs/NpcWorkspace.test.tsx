import { useCallback, useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  DuplicatedNpc,
  NpcClient,
  NpcWorkspaceContext,
  RenamedNpc,
} from "../../api/npc-client";
import type { AnimationBinding, Appearance, Character } from "../../domain";
import { NpcWorkspace } from "./NpcWorkspace";

const maraId = "11111111-1111-4111-8111-111111111111";
const jonId = "22222222-2222-4222-8222-222222222222";
const appearanceId = "33333333-3333-4333-8333-333333333333";
const bindingId = "44444444-4444-4444-8444-444444444444";
const jumpBindingId = "44444444-4444-4444-8444-555555555555";
const walkId = "55555555-5555-4555-8555-555555555555";
const sprintId = "66666666-6666-4666-8666-666666666666";
const jumpId = "66666666-6666-4666-8666-777777777777";
const areaId = "77777777-7777-4777-8777-777777777777";
const profileId = "88888888-8888-4888-8888-888888888888";
const duplicateId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("NPC workspace", () => {
  it("shows names, labels, coverage, requirements, export state and dropdown filters", async () => {
    const client = mockClient();
    render(<NpcWorkspace sessionId="session" areaId={areaId} client={client} />);

    expect(await screen.findByRole("heading", { name: "NPCs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Mara/ })).toHaveTextContent("Villagers");
    expect(screen.getByRole("button", { name: /Mara/ })).toHaveTextContent("walk 8/8");
    expect(screen.getByRole("button", { name: /Mara/ })).toHaveTextContent("Missing: sprint");
    expect(screen.getByRole("button", { name: /Mara/ })).toHaveTextContent("stale");
    for (const name of [
      "Label",
      "Completeness",
      "Required motion",
      "Export status",
      "Approval",
      "Sort",
    ]) {
      expect(screen.getByRole("combobox", { name })).toBeInTheDocument();
    }

    fireEvent.change(screen.getByRole("combobox", { name: "Completeness" }), {
      target: { value: "complete" },
    });
    expect(screen.queryByRole("button", { name: /Mara/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Jon/ })).toBeInTheDocument();
  });

  it("keeps area context when switching tabs and never adopts a revision automatically", async () => {
    const client = mockClient();
    const onSectionChange = vi.fn();
    const onStatus = vi.fn();
    render(
      <NpcWorkspace
        sessionId="session"
        areaId={areaId}
        client={client}
        onSectionChange={onSectionChange}
        onStatus={onStatus}
      />,
    );
    await screen.findByRole("heading", { name: "Mara" });
    expect(client.adoptRevision).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Animations" }));
    expect(onSectionChange).toHaveBeenCalledWith("animations", {
      areaId,
      npcId: maraId,
      bindingId,
    });
    fireEvent.click(screen.getByRole("button", { name: "Keep r1" }));
    expect(onStatus).toHaveBeenCalledWith("Kept pinned walk r1");
    expect(client.adoptRevision).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Adopt r2" }));
    await waitFor(() =>
      expect(client.adoptRevision).toHaveBeenCalledWith("session", areaId, bindingId, 1, {
        id: walkId,
        revision: 2,
      }),
    );
  });

  it("routes explicit variants, binding-local corrections, duplication and rename", async () => {
    const client = mockClient();
    render(<NpcWorkspace sessionId="session" areaId={areaId} client={client} />);
    await screen.findByRole("heading", { name: "Mara" });

    fireEvent.change(screen.getByLabelText("Released motion"), {
      target: { value: `${sprintId}:r1` },
    });
    fireEvent.change(screen.getByLabelText("Variant action key (optional)"), {
      target: { value: "sprint_fast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Assign pinned motion" }));
    await waitFor(() =>
      expect(client.addBinding).toHaveBeenCalledWith("session", areaId, {
        character_id: maraId,
        template_ref: { id: sprintId, revision: 1 },
        variant_action_key: "sprint_fast",
      }),
    );
    await screen.findByText("Assigned sprint_fast r1");

    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    fireEvent.change(screen.getByLabelText("walk correction 1 offset X"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save local corrections" }));
    await waitFor(() =>
      expect(client.updateOverrides).toHaveBeenCalledWith("session", areaId, {
        binding_id: bindingId,
        expected_revision: 1,
        local_overrides: [
          {
            slot_id: "hand_l",
            direction: "n",
            transform: { offset_px: [3, 0], rotation_deg: 0 },
          },
        ],
      }),
    );
    await screen.findByText("Saved local walk corrections");

    fireEvent.change(screen.getByLabelText("Duplicate name"), {
      target: { value: "Mara Twin" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Duplicate with shared releases" }));
    await waitFor(() =>
      expect(client.duplicate).toHaveBeenCalledWith("session", areaId, maraId, "Mara Twin"),
    );
    await screen.findByText("Duplicated Mara as Mara Twin");
    fireEvent.change(screen.getByLabelText("New display name"), {
      target: { value: "Mara Smith" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename NPC and folder" }));
    await waitFor(() =>
      expect(client.rename).toHaveBeenCalledWith("session", areaId, maraId, 1, "Mara Smith"),
    );
  });

  it("focuses motions and directions while preserving another binding's dirty draft", async () => {
    const client = mockClient();
    const onSelectionChange = vi.fn();
    render(<SelectionHarness client={client} onSelectionChange={onSelectionChange} />);

    const activeMotion = await screen.findByRole("combobox", { name: "Active motion" });
    expect(activeMotion).toHaveValue(jumpBindingId);
    expect(screen.getByRole("heading", { name: "Jump" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Active direction" }), {
      target: { value: "nw" },
    });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("NW is missing from jump"),
    );

    fireEvent.change(activeMotion, { target: { value: bindingId } });
    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    fireEvent.change(screen.getByLabelText("walk correction 1 offset X"), {
      target: { value: "3" },
    });
    fireEvent.change(activeMotion, { target: { value: jumpBindingId } });
    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    fireEvent.change(screen.getByLabelText("jump correction 1 offset X"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save local corrections" }));
    await waitFor(() =>
      expect(client.updateOverrides).toHaveBeenCalledWith("session", areaId, {
        binding_id: jumpBindingId,
        expected_revision: 1,
        local_overrides: [
          {
            slot_id: "hand_l",
            direction: "n",
            transform: { offset_px: [7, 0], rotation_deg: 0 },
          },
        ],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Mark binding reviewed" }));
    await waitFor(() =>
      expect(client.reviewBinding).toHaveBeenCalledWith("session", areaId, jumpBindingId, 2),
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Active motion" }), {
      target: { value: bindingId },
    });
    expect(screen.getByLabelText("walk correction 1 offset X")).toHaveValue(3);
    expect(screen.getByRole("button", { name: "Save local corrections" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Duplicate with shared releases" })).toBeDisabled();
    expect(onSelectionChange).toHaveBeenCalledWith({ npcId: maraId, bindingId });
  });

  it("prevents duplicate local targets and exposes release comparison details", async () => {
    const client = mockClient();
    render(<NpcWorkspace sessionId="session" areaId={areaId} client={client} />);
    await screen.findByRole("heading", { name: "Mara" });

    expect(screen.getByLabelText("Release comparison")).toHaveTextContent("r1: 8 frames at 8 FPS");
    expect(screen.getByLabelText("Release comparison")).toHaveTextContent(
      "r2: 10 frames at 12 FPS",
    );
    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    const secondDirection = screen.getByLabelText("walk correction 2 direction");
    expect(within(secondDirection).getByRole("option", { name: "N" })).toBeDisabled();
    fireEvent.change(secondDirection, { target: { value: "n" } });
    expect(screen.getByRole("alert")).toHaveTextContent("unique slot and direction");
    expect(screen.getByLabelText("walk correction 1 slot")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save local corrections" })).toBeDisabled();
  });

  it("reports unsaved local corrections and guards switching NPCs", async () => {
    const client = mockClient();
    const onDirtyChange = vi.fn();
    const onStatus = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <NpcWorkspace
        sessionId="session"
        areaId={areaId}
        client={client}
        onDirtyChange={onDirtyChange}
        onStatus={onStatus}
      />,
    );
    await screen.findByRole("heading", { name: "Mara" });

    fireEvent.click(screen.getByRole("button", { name: "Add correction" }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    fireEvent.click(screen.getByRole("button", { name: /Jon/ }));

    expect(confirm).toHaveBeenCalledWith(
      "Discard unsaved binding-local corrections and open another NPC?",
    );
    expect(screen.getByRole("heading", { name: "Mara" })).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith("NPC selection cancelled · save local corrections first");

    fireEvent.click(screen.getByRole("button", { name: "Save local corrections" }));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    confirm.mockRestore();
  });

  it("disables every NPC mutation control in a read-only vault", async () => {
    const client = mockClient();
    render(<NpcWorkspace sessionId="session" areaId={areaId} client={client} readOnly />);
    await screen.findByRole("heading", { name: "Mara" });

    expect(screen.getByLabelText("Released motion")).toBeDisabled();
    expect(screen.getByLabelText("Variant action key (optional)")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add correction" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save local corrections" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Adopt r2" })).toBeDisabled();
    expect(screen.getByLabelText("New display name")).toBeDisabled();
    expect(screen.getByLabelText("Duplicate name")).toBeDisabled();
  });
});

function SelectionHarness({
  client,
  onSelectionChange,
}: {
  client: NpcClient;
  onSelectionChange: (selection: { npcId: string | null; bindingId: string | null }) => void;
}) {
  const [selection, setSelection] = useState<{
    npcId: string | null;
    bindingId: string | null;
  }>({ npcId: maraId, bindingId: jumpBindingId });
  const reportSelection = useCallback(
    (next: { npcId: string | null; bindingId: string | null }) => {
      setSelection((current) =>
        current.npcId === next.npcId && current.bindingId === next.bindingId ? current : next,
      );
      onSelectionChange(next);
    },
    [onSelectionChange],
  );
  return (
    <NpcWorkspace
      sessionId="session"
      areaId={areaId}
      initialNpcId={selection.npcId ?? undefined}
      initialBindingId={selection.bindingId ?? undefined}
      client={client}
      onSelectionChange={reportSelection}
    />
  );
}

function mockClient(): NpcClient {
  const context = fixtureContext();
  const binding = context.npcs[0].bindings[0].binding;
  const character = context.npcs[0].character;
  return {
    inspect: vi.fn(async () => structuredClone(context)),
    addBinding: vi.fn(async () => binding),
    updateOverrides: vi.fn(async (_session, _area, request) => {
      for (const npc of context.npcs) {
        const index = npc.bindings.findIndex((view) => view.binding.id === request.binding_id);
        if (index === -1) continue;
        const current = npc.bindings[index];
        const updated = {
          ...current.binding,
          revision: current.binding.revision + 1,
          local_overrides: request.local_overrides,
        };
        npc.bindings[index] = { ...current, binding: updated };
        return updated;
      }
      throw new Error("binding fixture not found");
    }),
    adoptRevision: vi.fn(async () => binding),
    reviewBinding: vi.fn(async () => binding),
    setStatus: vi.fn(async () => character),
    duplicate: vi.fn(async () => duplicatedFixture(context)),
    rename: vi.fn(async () => renamedFixture(character)),
  };
}

function fixtureContext(): NpcWorkspaceContext {
  const binding = bindingFixture();
  const mara = characterFixture(maraId, "Mara", "draft", ["walk", "sprint"]);
  const jon = characterFixture(jonId, "Jon", "reviewed", ["walk"]);
  return {
    area_id: areaId,
    area_name: "Village NPCs",
    available_labels: [
      { id: "99999999-9999-4999-8999-999999999999", name: "Villagers", color: "#ffcc66" },
    ],
    npcs: [
      {
        character: mara,
        labels: [
          {
            id: "99999999-9999-4999-8999-999999999999",
            name: "Villagers",
            color: "#ffcc66",
          },
        ],
        bindings: [
          {
            binding,
            template_name: "Walk",
            covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
            missing_directions: [],
            effective_source_fingerprint: "c".repeat(64),
            revision_offer: {
              template_ref: { id: walkId, revision: 2 },
              compatibility: "compatible",
              reason: null,
              comparison: {
                current_frame_count: 8,
                candidate_frame_count: 10,
                current_fps: 8,
                candidate_fps: 12,
                current_covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
                candidate_covered_directions: ["n", "ne", "e", "se", "s", "sw", "w"],
                retained_local_override_count: 0,
              },
            },
          },
          {
            binding: {
              ...binding,
              id: jumpBindingId,
              action_key: "jump",
              template_ref: { id: jumpId, revision: 1 },
            },
            template_name: "Jump",
            covered_directions: ["n", "ne", "e", "se", "s", "sw", "w"],
            missing_directions: ["nw"],
            effective_source_fingerprint: "e".repeat(64),
            revision_offer: null,
          },
        ],
        missing_actions: ["sprint"],
        completeness: "missing_actions",
        export_status: "stale",
        effective_source_fingerprint: "a".repeat(64),
        available_slots: ["hand_l", "head"],
        motion_options: [
          {
            template_ref: { id: sprintId, revision: 1 },
            template_name: "Sprint",
            default_action_key: "sprint",
            frame_count: 6,
            covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
            missing_directions: [],
            compatibility: "compatible",
            reason: null,
          },
        ],
      },
      {
        character: jon,
        labels: [],
        bindings: [
          {
            binding: {
              ...binding,
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              character_id: jonId,
            },
            template_name: "Walk",
            covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
            missing_directions: [],
            effective_source_fingerprint: "d".repeat(64),
            revision_offer: null,
          },
        ],
        missing_actions: [],
        completeness: "complete",
        export_status: "current",
        effective_source_fingerprint: "b".repeat(64),
        available_slots: ["hand_l", "head"],
        motion_options: [],
      },
    ],
  };
}

function characterFixture(
  id: string,
  name: string,
  status: Character["status"],
  requiredActions: string[],
): Character {
  return {
    schema_version: 1,
    kind: "character",
    id,
    revision: 1,
    area_id: areaId,
    name,
    description: "Village resident",
    status,
    profile_ref: { id: profileId, revision: 1 },
    default_appearance_id: appearanceId,
    label_ids: [],
    required_actions: requiredActions,
    created_at: "2026-09-05T09:00:00Z",
    updated_at: "2026-09-05T09:00:00Z",
  };
}

function bindingFixture(): AnimationBinding {
  return {
    schema_version: 1,
    kind: "animation_binding",
    id: bindingId,
    revision: 1,
    character_id: maraId,
    action_key: "walk",
    template_ref: { id: walkId, revision: 1 },
    appearance_id: appearanceId,
    local_overrides: [],
    review_state: "draft",
    created_at: "2026-09-05T09:00:00Z",
    updated_at: "2026-09-05T09:00:00Z",
  };
}

function duplicatedFixture(context: NpcWorkspaceContext): DuplicatedNpc {
  const source = context.npcs[0];
  return {
    character: { ...source.character, id: duplicateId, name: "Mara Twin" },
    appearance: appearanceFixture(),
    bindings: [source.bindings[0].binding],
    character_folder: "game/village/mara-twin--22222222",
  };
}

function renamedFixture(character: Character): RenamedNpc {
  return {
    character: { ...character, name: "Mara Smith", revision: 2 },
    character_folder: "game/village/mara-smith--11111111",
  };
}

function appearanceFixture(): Appearance {
  return {
    schema_version: 1,
    kind: "appearance",
    id: appearanceId,
    revision: 1,
    character_id: maraId,
    profile_ref: { id: profileId, revision: 1 },
    name: "Default",
    slots: [],
    asset_fallback_approvals: [],
    equipment: [],
    created_at: "2026-09-05T09:00:00Z",
    updated_at: "2026-09-05T09:00:00Z",
  };
}
