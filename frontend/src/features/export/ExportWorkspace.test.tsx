import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  ExportClient,
  NpcExportInspection,
  StoredNpcExportProfile,
} from "../../api/export-client";
import type { NpcClient, NpcWorkspaceContext } from "../../api/npc-client";
import { DEFAULT_EXPORT_PROFILE, toProfileSnapshot } from "./export-model";
import { ExportWorkspace } from "./ExportWorkspace";

const characterId = "11111111-1111-4111-8111-111111111111";
const otherCharacterId = "22222222-2222-4222-8222-222222222222";
const bindingId = "33333333-3333-4333-8333-333333333333";
const storedProfileId = "44444444-4444-4444-8444-444444444444";

describe("ExportWorkspace", () => {
  it("loads authoritative pinned data and persists a profile inside the selected area", async () => {
    const savedProfile: StoredNpcExportProfile = {
      id: storedProfileId,
      revision: 1,
      format: "godot_package",
      include_godot_scene: false,
      profile: { ...toProfileSnapshot(DEFAULT_EXPORT_PROFILE), name: "Area sheets" },
      root_motion_mode: "external",
      jump_mode: "baked",
    };
    const client = mockExportClient({ profiles: [savedProfile] });
    const onStatus = vi.fn();
    render(
      <ExportWorkspace
        sessionId="session"
        areaId="area"
        initialNpcId={characterId}
        initialBindingId={bindingId}
        client={client}
        npcsClient={mockNpcClient()}
        onStatus={onStatus}
      />,
    );

    expect(
      await screen.findByRole("dialog", { name: "Export PNG sheets + JSON" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(client.inspect).toHaveBeenCalledWith("session", "area", characterId),
    );
    expect(client.listProfiles).toHaveBeenCalledWith("session", "area");
    expect(screen.getByRole("combobox", { name: "Animation assignment" })).toHaveValue(bindingId);
    expect(screen.getByRole("option", { name: "Area sheets" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Profile name" }), {
      target: { value: "Portable game sheets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(client.saveProfile).toHaveBeenCalledWith("session", "area", {
        profile_id: null,
        expected_revision: null,
        format: "png_json",
        include_godot_scene: true,
        profile: expect.objectContaining({ name: "Portable game sheets" }),
        root_motion_mode: "baked",
        jump_mode: "external",
      }),
    );
    expect(onStatus).toHaveBeenCalledWith("Portable game sheets saved in this area");

    fireEvent.change(screen.getByRole("combobox", { name: "Saved profile" }), {
      target: { value: storedProfileId },
    });
    expect(screen.getByRole("combobox", { name: "Format" })).toHaveValue("godot_package");
    expect(
      screen.getByRole("checkbox", { name: "Include AnimatedSprite2D scene" }),
    ).not.toBeChecked();
    fireEvent.change(screen.getByRole("textbox", { name: "Profile name" }), {
      target: { value: "Updated area sheets" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(client.saveProfile).toHaveBeenLastCalledWith("session", "area", {
        profile_id: storedProfileId,
        expected_revision: 1,
        format: "godot_package",
        include_godot_scene: false,
        profile: expect.objectContaining({ name: "Updated area sheets" }),
        root_motion_mode: "external",
        jump_mode: "baked",
      }),
    );
  });

  it("re-inspects stable IDs when the NPC changes and reports the selection", async () => {
    const client = mockExportClient();
    const onSelectionChange = vi.fn();
    render(
      <ExportWorkspace
        sessionId="session"
        areaId="area"
        client={client}
        npcsClient={mockNpcClient()}
        onSelectionChange={onSelectionChange}
      />,
    );
    await screen.findByRole("dialog", { name: "Export PNG sheets + JSON" });
    fireEvent.change(screen.getByRole("combobox", { name: "NPC" }), {
      target: { value: otherCharacterId },
    });

    await waitFor(() =>
      expect(client.inspect).toHaveBeenCalledWith("session", "area", otherCharacterId),
    );
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith({
        npcId: otherCharacterId,
        bindingId: null,
      }),
    );
  });

  it("runs the selected Godot format and exposes its managed native package", async () => {
    const client = mockExportClient();
    const onStatus = vi.fn();
    render(
      <ExportWorkspace
        sessionId="session"
        areaId="area"
        client={client}
        npcsClient={mockNpcClient()}
        onStatus={onStatus}
      />,
    );
    await screen.findByRole("dialog", { name: "Export PNG sheets + JSON" });
    fireEvent.change(screen.getByRole("combobox", { name: "Format" }), {
      target: { value: "godot_package" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    await waitFor(() =>
      expect(client.run).toHaveBeenCalledWith(
        "session",
        "area",
        expect.objectContaining({
          character_id: characterId,
          format: "godot_package",
          include_godot_scene: true,
        }),
        expect.any(AbortSignal),
        expect.any(Function),
      ),
    );
    expect(
      await screen.findByText("characters/mara/_exports/godot/godot-v1-hash-scene"),
    ).toBeInTheDocument();
    expect(onStatus).toHaveBeenCalledWith("Godot package + PNG/JSON published");
  });

  it("never starts a managed export from a read-only vault", async () => {
    const client = mockExportClient();
    render(
      <ExportWorkspace
        sessionId="session"
        areaId="area"
        readOnly
        client={client}
        npcsClient={mockNpcClient()}
      />,
    );
    await screen.findByRole("dialog", { name: "Export PNG sheets + JSON" });
    expect(screen.getByRole("button", { name: "Export" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(client.run).not.toHaveBeenCalled();
  });
});

function mockExportClient({
  profiles = [],
}: { profiles?: StoredNpcExportProfile[] } = {}): ExportClient {
  return {
    inspect: vi.fn(async (_session, _area, selectedCharacterId) => inspection(selectedCharacterId)),
    listProfiles: vi.fn(async () => profiles),
    saveProfile: vi.fn(async (_session, _area, request) => ({
      id: request.profile_id ?? "55555555-5555-4555-8555-555555555555",
      revision: request.expected_revision === null ? 1 : request.expected_revision + 1,
      format: request.format,
      include_godot_scene: request.include_godot_scene,
      profile: request.profile,
      root_motion_mode: request.root_motion_mode,
      jump_mode: request.jump_mode,
    })),
    deleteProfile: vi.fn(async () => undefined),
    run: vi.fn(async (_session, _area, request) =>
      request.format === "godot_package"
        ? {
            build: "build-hash",
            source_fingerprint: "a".repeat(64),
            complete: true,
            reused_existing_build: false,
            format: "godot_package" as const,
            godot_package: {
              package_directory: "characters/mara/_exports/godot/godot-v1-hash-scene",
              animation_names: ["walk_s"],
              scene: "character.tscn",
              reused_existing_package: false,
            },
          }
        : {
            build: "build-hash",
            source_fingerprint: "a".repeat(64),
            complete: true,
            reused_existing_build: false,
            format: "png_json" as const,
            godot_package: null,
          },
    ),
  };
}

function inspection(selectedCharacterId: string): NpcExportInspection {
  return {
    character_id: selectedCharacterId,
    bindings: [
      {
        binding_id: bindingId,
        action_key: "walk",
        frame_size_px: [128, 128],
        ground_origin_px: [64, 108],
        frame_count: 8,
        fps: 8,
        loop_mode: "loop",
        covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
        missing_directions: [],
        reviewed: true,
        ready: true,
        issue: null,
      },
    ],
    missing_required_actions: [],
    common_frame_size_px: [128, 128],
    common_ground_origin_px: [64, 108],
  };
}

function mockNpcClient(): NpcClient {
  return {
    inspect: vi.fn(
      async () =>
        ({
          area_id: "area",
          area_name: "Village",
          available_labels: [],
          npcs: [
            { character: { id: characterId, name: "Mara", status: "reviewed" } },
            { character: { id: otherCharacterId, name: "Jon", status: "reviewed" } },
          ],
        }) as unknown as NpcWorkspaceContext,
    ),
  } as unknown as NpcClient;
}
