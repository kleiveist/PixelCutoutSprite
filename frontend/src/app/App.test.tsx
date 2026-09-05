import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AreaClient } from "../api/area-client";
import {
  ExportCancelledError,
  type ExportClient,
  type StartNpcExportRequest,
} from "../api/export-client";
import type { MotionClient } from "../api/motion-client";
import type { NpcClient } from "../api/npc-client";
import type { OutfitClient } from "../api/outfit-client";
import type { ProjectClient } from "../api/project-client";
import type { OpenVault, VaultClient, VaultInspection } from "../api/vault-client";
import { App } from "./App";

describe("desktop shell", () => {
  it("boots the production shell with all structural regions", () => {
    render(<App />);

    expect(screen.getByRole("banner")).toHaveTextContent("PixelCutoutSprite");
    expect(screen.getByRole("navigation", { name: "Studio sections" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("Cutout animation");
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Ready");
  });

  it("keeps animation navigation inside a selected area context", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Animations/ }));

    expect(screen.getByRole("heading", { name: "Areas" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Open an area");
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("requires a selected area before opening the NPC workspace", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "NPCs" }));

    expect(screen.getByRole("heading", { name: "Areas" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Open an area");
  });

  it("requires a selected area before opening export", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(screen.getByRole("heading", { name: "Areas" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toHaveTextContent("Open an area");
  });

  it("mounts the NPC workspace with the selected stable area identity", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const areaId = "22222222-2222-4222-8222-222222222222";
    const profileId = "33333333-3333-4333-8333-333333333333";
    const templateId = "44444444-4444-4444-8444-444444444444";
    const characterId = "55555555-5555-4555-8555-555555555555";
    const appearanceId = "66666666-6666-4666-8666-666666666666";
    const bindingId = "77777777-7777-4777-8777-777777777777";
    const otherTemplateId = "88888888-8888-4888-8888-888888888888";
    const otherBindingId = "99999999-9999-4999-8999-999999999999";
    const vaultApi = {
      chooseDirectory: vi.fn(async () => "/vault"),
      inspect: vi.fn(async () => ({
        state: "valid",
        path: "/vault",
        vault_id: "vault",
        writer_present: false,
      })),
      open: vi.fn(async () => ({
        session_id: "session",
        vault_id: "vault",
        path: "/vault",
        mode: "read_write",
        indexed_objects: 2,
        notice: null,
      })),
      close: vi.fn(async () => undefined),
      recent: vi.fn(async () => []),
    } as unknown as VaultClient;
    const projectsApi = {
      dashboard: vi.fn(async () => ({
        projects: [
          {
            id: projectId,
            revision: 1,
            name: "My RPG",
            status: "active",
            labels: [],
            workspace_label_ids: [],
            created_at: "2026-09-05T09:00:00Z",
            updated_at: "2026-09-05T10:00:00Z",
          },
        ],
        labels: [],
        writable: true,
        view: {
          schema_version: 1,
          kind: "project_view",
          revision: 1,
          search: "",
          label_ids: [],
          label_match: "any",
          status: "any",
          sort: "updated_desc",
          updated_at: "2026-09-05T10:00:00Z",
        },
      })),
    } as unknown as ProjectClient;
    const area = {
      id: areaId,
      revision: 1,
      project_id: projectId,
      name: "Village",
      object_type: "humanoid",
      profile_ref: { id: profileId, revision: 1 },
      reference_height_px: 80,
      direction_model: "eight_way",
      default_frame_size_px: [128, 128],
      default_ground_origin_px: [64, 108],
      label_ids: [],
      created_at: "2026-09-05T09:00:00Z",
      updated_at: "2026-09-05T10:00:00Z",
    } as const;
    const areasApi = {
      preview: vi.fn(async () => ({
        preset_version: 1,
        reference_height_px: 80,
        measured_height_px: 80,
        suggested_frame_size_px: [128, 128],
        suggested_ground_origin_px: [64, 108],
        slots: [],
        views: [],
        mirror_pairs: [],
        direction_previews: [],
      })),
      dashboard: vi.fn(async () => ({
        project_id: projectId,
        areas: [area],
        labels: [],
        writable: true,
      })),
    } as unknown as AreaClient;
    const motionsApi = {
      dashboard: vi.fn(async () => ({
        area_id: areaId,
        writable: true,
        profiles: [area.profile_ref],
        motions: [
          {
            id: templateId,
            revision: 1,
            area_id: areaId,
            name: "Village walk",
            action_key: "walk",
            status: "released",
            label_ids: [],
            profile_ref: area.profile_ref,
            frame_count: 8,
            fps: 8,
            loop_mode: "loop",
            direction_coverage: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
            released_revisions: [1],
            latest_release: 1,
            updated_at: "2026-09-05T10:00:00Z",
          },
        ],
      })),
      cardPreview: vi.fn(async () => ({
        frame_urls: [],
        sample_indices: [],
        fps: 8,
        direction: "s",
        clipping_count: 0,
      })),
      resolveOpen: vi.fn(async () => ({
        kind: "binding_editor",
        template_id: templateId,
        binding_id: bindingId,
        character_id: characterId,
      })),
    } as unknown as MotionClient;
    const npcsApi = {
      inspect: vi.fn(async () => ({
        area_id: areaId,
        area_name: "Village",
        available_labels: [],
        npcs: [
          {
            character: {
              schema_version: 1,
              kind: "character",
              id: characterId,
              revision: 1,
              area_id: areaId,
              name: "Mara",
              description: "Village resident",
              status: "reviewed",
              profile_ref: area.profile_ref,
              default_appearance_id: appearanceId,
              label_ids: [],
              required_actions: ["walk"],
              created_at: "2026-09-05T09:00:00Z",
              updated_at: "2026-09-05T10:00:00Z",
            },
            labels: [],
            bindings: [
              {
                binding: {
                  schema_version: 1,
                  kind: "animation_binding",
                  id: otherBindingId,
                  revision: 1,
                  character_id: characterId,
                  action_key: "idle",
                  template_ref: { id: otherTemplateId, revision: 1 },
                  appearance_id: appearanceId,
                  local_overrides: [],
                  review_state: "reviewed",
                  created_at: "2026-09-05T09:00:00Z",
                  updated_at: "2026-09-05T10:00:00Z",
                },
                template_name: "Village idle",
                covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
                missing_directions: [],
                effective_source_fingerprint: "c".repeat(64),
                revision_offer: null,
              },
              {
                binding: {
                  schema_version: 1,
                  kind: "animation_binding",
                  id: bindingId,
                  revision: 1,
                  character_id: characterId,
                  action_key: "walk",
                  template_ref: { id: templateId, revision: 1 },
                  appearance_id: appearanceId,
                  local_overrides: [],
                  review_state: "reviewed",
                  created_at: "2026-09-05T09:00:00Z",
                  updated_at: "2026-09-05T10:00:00Z",
                },
                template_name: "Village walk",
                covered_directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
                missing_directions: [],
                effective_source_fingerprint: "a".repeat(64),
                revision_offer: null,
              },
            ],
            missing_actions: [],
            completeness: "complete",
            export_status: "not_exported",
            effective_source_fingerprint: "b".repeat(64),
            available_slots: [],
            motion_options: [],
          },
        ],
      })),
    } as unknown as NpcClient;
    const exportsApi = {
      inspect: vi.fn(async (_session, _area, requestedCharacterId) => ({
        character_id: requestedCharacterId,
        bindings: [
          {
            binding_id: otherBindingId,
            action_key: "idle",
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
      })),
      listProfiles: vi.fn(async () => []),
      saveProfile: vi.fn(),
      deleteProfile: vi.fn(),
      run: vi.fn(
        (_session: string, _area: string, _request: StartNpcExportRequest, signal: AbortSignal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new ExportCancelledError()));
          }),
      ),
    } as unknown as ExportClient;

    render(
      <App
        areasApi={areasApi}
        exportsApi={exportsApi}
        motionsApi={motionsApi}
        npcsApi={npcsApi}
        projectsApi={projectsApi}
        vaultApi={vaultApi}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    fireEvent.click(await screen.findByRole("button", { name: /My RPG/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Open animations" }));
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Area workspace" })).getByRole("button", {
        name: "NPCs",
      }),
    );

    expect(await screen.findByLabelText("Village NPC workspace")).toBeInTheDocument();
    expect(npcsApi.inspect).toHaveBeenCalledWith("session", areaId);
    expect(screen.getByRole("combobox", { name: "Active motion" })).toHaveValue(otherBindingId);

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Area workspace modes" })).getByRole("button", {
        name: "Animations",
      }),
    );
    fireEvent.click((await screen.findByText("Village walk")).closest("button")!);
    await waitFor(() =>
      expect(motionsApi.resolveOpen).toHaveBeenCalledWith("session", templateId, characterId),
    );
    expect(await screen.findByLabelText("Village NPC workspace")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Active motion" })).toHaveValue(bindingId);

    fireEvent.click(screen.getByRole("button", { name: "Export this motion" }));
    expect(
      await screen.findByRole("dialog", { name: "Export PNG sheets + JSON" }),
    ).toBeInTheDocument();
    expect(exportsApi.inspect).toHaveBeenCalledWith("session", areaId, characterId);
    expect(screen.getByRole("combobox", { name: "Animation assignment" })).toHaveValue(bindingId);
    const exportDialog = screen.getByRole("dialog", { name: "Export PNG sheets + JSON" });
    await waitFor(() =>
      expect(within(exportDialog).getByRole("button", { name: "Export" })).toBeEnabled(),
    );
    fireEvent.click(within(exportDialog).getByRole("button", { name: "Export" }));
    expect(await screen.findByRole("button", { name: "Cancel export" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));
    expect(screen.getByRole("dialog", { name: "Export PNG sheets + JSON" })).toBeInTheDocument();
    expect(screen.getByText(/Navigation blocked · cancel the active export/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancel export" }));
    await screen.findByText(/last good build is unchanged/i);
  });

  it("opens and dismisses the shortcut dialog from the keyboard", () => {
    render(<App />);
    const help = screen.getByRole("button", { name: "Open shortcut help" });
    help.focus();
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Studio shortcuts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close shortcut help" })).toHaveFocus();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Studio shortcuts" })).not.toBeInTheDocument();
    expect(help).toHaveFocus();
  });

  it("shows the real project dashboard immediately after a vault opens", async () => {
    const vaultApi: VaultClient = {
      chooseDirectory: vi.fn(async () => "/vault"),
      inspect: vi.fn(async (): Promise<VaultInspection> => ({
        state: "valid",
        path: "/vault",
        vault_id: "vault",
        writer_present: false,
      })),
      initialize: vi.fn(),
      open: vi.fn(async (): Promise<OpenVault> => ({
        session_id: "session",
        vault_id: "vault",
        path: "/vault",
        mode: "read_write",
        indexed_objects: 1,
        notice: null,
      })),
      close: vi.fn(async () => undefined),
      recent: vi.fn(async () => []),
    };
    const projectsApi = {
      dashboard: vi.fn(async () => ({
        projects: [],
        labels: [],
        writable: true,
        view: {
          schema_version: 1,
          kind: "project_view",
          revision: 1,
          search: "",
          label_ids: [],
          label_match: "any",
          status: "any",
          sort: "updated_desc",
          updated_at: "2026-09-05T12:00:00Z",
        },
      })),
    } as unknown as ProjectClient;

    render(<App vaultApi={vaultApi} projectsApi={projectsApi} />);
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("No projects yet")).toBeInTheDocument();
  });

  it("passes the exact released card revision into the outfit workflow", async () => {
    const projectId = "11111111-1111-4111-8111-111111111111";
    const areaId = "22222222-2222-4222-8222-222222222222";
    const profileId = "33333333-3333-4333-8333-333333333333";
    const templateId = "44444444-4444-4444-8444-444444444444";
    const exactRelease = 3;
    const vaultApi = {
      chooseDirectory: vi.fn(async () => "/vault"),
      inspect: vi.fn(async () => ({
        state: "valid",
        path: "/vault",
        vault_id: "vault",
        writer_present: false,
      })),
      initialize: vi.fn(),
      open: vi.fn(async () => ({
        session_id: "session",
        vault_id: "vault",
        path: "/vault",
        mode: "read_write",
        indexed_objects: 4,
        notice: null,
      })),
      close: vi.fn(async () => undefined),
      recent: vi.fn(async () => []),
    } as unknown as VaultClient;
    const projectsApi = {
      dashboard: vi.fn(async () => ({
        projects: [
          {
            id: projectId,
            revision: 1,
            name: "My RPG",
            status: "active",
            labels: [],
            workspace_label_ids: [],
            created_at: "2026-09-05T09:00:00Z",
            updated_at: "2026-09-05T10:00:00Z",
          },
        ],
        labels: [],
        writable: true,
        view: {
          schema_version: 1,
          kind: "project_view",
          revision: 1,
          search: "",
          label_ids: [],
          label_match: "any",
          status: "any",
          sort: "updated_desc",
          updated_at: "2026-09-05T10:00:00Z",
        },
      })),
    } as unknown as ProjectClient;
    const area = {
      id: areaId,
      revision: 1,
      project_id: projectId,
      name: "NPCs",
      object_type: "humanoid",
      profile_ref: { id: profileId, revision: 1 },
      reference_height_px: 80,
      direction_model: "eight_way",
      default_frame_size_px: [128, 128],
      default_ground_origin_px: [64, 108],
      label_ids: [],
      created_at: "2026-09-05T09:00:00Z",
      updated_at: "2026-09-05T10:00:00Z",
    } as const;
    const areasApi = {
      preview: vi.fn(async () => ({
        preset_version: 1,
        reference_height_px: 80,
        measured_height_px: 80,
        suggested_frame_size_px: [128, 128],
        suggested_ground_origin_px: [64, 108],
        slots: [],
        views: [],
        mirror_pairs: [],
        direction_previews: [],
      })),
      dashboard: vi.fn(async () => ({
        project_id: projectId,
        areas: [area],
        labels: [],
        writable: true,
      })),
    } as unknown as AreaClient;
    const motionsApi = {
      dashboard: vi.fn(async () => ({
        area_id: areaId,
        writable: true,
        profiles: [area.profile_ref],
        motions: [
          {
            id: templateId,
            revision: 12,
            area_id: areaId,
            name: "Released walk",
            action_key: "walk",
            status: "released",
            label_ids: [],
            profile_ref: area.profile_ref,
            frame_count: 8,
            fps: 8,
            loop_mode: "loop",
            direction_coverage: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
            released_revisions: [1, exactRelease, 9],
            latest_release: 9,
            updated_at: "2026-09-05T10:00:00Z",
          },
        ],
      })),
      cardPreview: vi.fn(async () => ({
        frame_urls: [],
        sample_indices: [],
        fps: 8,
        direction: "s",
        clipping_count: 0,
      })),
      resolveOpen: vi.fn(async () => ({
        kind: "outfit_chooser",
        template_id: templateId,
        template_revision: exactRelease,
        compatible_character_ids: [],
      })),
    } as unknown as MotionClient;
    const outfitsApi = {
      launch: vi.fn(() => new Promise<never>(() => undefined)),
    } as unknown as OutfitClient;

    render(
      <App
        areasApi={areasApi}
        motionsApi={motionsApi}
        outfitsApi={outfitsApi}
        projectsApi={projectsApi}
        vaultApi={vaultApi}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Choose vault/ }));
    fireEvent.click(await screen.findByRole("button", { name: /My RPG/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Open animations" }));
    fireEvent.click((await screen.findByText("Released walk")).closest("button")!);

    await waitFor(() => {
      expect(outfitsApi.launch).toHaveBeenCalledTimes(1);
      expect(outfitsApi.launch).toHaveBeenNthCalledWith(1, "session", areaId, {
        id: templateId,
        revision: exactRelease,
      });
    });
  });
});
