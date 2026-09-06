import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AssetClient } from "../api/asset-client";
import type { VaultClient } from "../api/vault-client";
import type { AssetImportJobView } from "../domain/inventory";
import { App } from "./App";

const testIds = vi.hoisted(() => ({
  sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  projectId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  areaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  profileId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  templateId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  npcId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
  bindingId: "11111111-1111-4111-8111-111111111111",
}));

vi.mock("../components/PlaceholderView", () => ({
  PlaceholderView: ({
    onOpenAreaAnimations,
    onVaultOpened,
    vault,
  }: {
    onOpenAreaAnimations: (area: unknown) => void;
    onVaultOpened: (vault: unknown) => void;
    vault: unknown;
  }) =>
    vault ? (
      <button
        type="button"
        onClick={() =>
          onOpenAreaAnimations({
            id: testIds.areaId,
            revision: 1,
            project_id: testIds.projectId,
            name: "Test Area",
            object_type: "humanoid",
            profile_ref: { id: testIds.profileId, revision: 1 },
            reference_height_px: 80,
            direction_model: "eight_way",
            default_frame_size_px: [128, 128],
            default_ground_origin_px: [64, 108],
            label_ids: [],
            created_at: "2026-09-06T00:00:00Z",
            updated_at: "2026-09-06T00:00:00Z",
          })
        }
      >
        Open test area
      </button>
    ) : (
      <button
        type="button"
        onClick={() =>
          onVaultOpened({
            session_id: testIds.sessionId,
            vault_id: "test-vault",
            path: "/test-vault",
            mode: "read_write",
            indexed_objects: 3,
            notice: null,
            recovery: [],
            recovery_writable: true,
            lock_recovery: null,
          })
        }
      >
        Open test vault
      </button>
    ),
}));

vi.mock("../features/projects/ProjectDashboard", () => ({
  ProjectDashboard: ({ onOpen }: { onOpen: (project: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onOpen({
          id: testIds.projectId,
          revision: 1,
          name: "Test Project",
          status: "active",
          labels: [],
          workspace_label_ids: [],
          created_at: "2026-09-06T00:00:00Z",
          updated_at: "2026-09-06T00:00:00Z",
        })
      }
    >
      Open test project
    </button>
  ),
}));

vi.mock("../features/animations/AnimationDashboard", () => ({
  AnimationDashboard: ({ onOpen }: { onOpen: (target: unknown) => void }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onOpen({
            kind: "binding_editor",
            template_id: testIds.templateId,
            character_id: testIds.npcId,
            binding_id: testIds.bindingId,
          })
        }
      >
        Open test binding
      </button>
      <button
        type="button"
        onClick={() => onOpen({ kind: "dummy_editor", template_id: testIds.templateId })}
      >
        Open dirty test editor
      </button>
    </div>
  ),
}));

vi.mock("../features/npcs", async () => {
  const { useEffect } = await import("react");
  return {
    NpcWorkspace: ({
      areaId: selectedAreaId,
      initialBindingId,
      initialNpcId,
      onDirtyChange,
      sessionId: selectedSessionId,
    }: {
      areaId: string;
      initialBindingId?: string;
      initialNpcId?: string;
      onDirtyChange: (dirty: boolean) => void;
      sessionId: string;
    }) => {
      useEffect(() => {
        onDirtyChange(true);
        return () => onDirtyChange(false);
      }, [onDirtyChange]);
      return (
        <section
          aria-label="Test NPC workspace"
          data-area-id={selectedAreaId}
          data-binding-id={initialBindingId}
          data-npc-id={initialNpcId}
          data-session-id={selectedSessionId}
        />
      );
    },
  };
});

vi.mock("../features/dummy-editor/MotionDummyEditorRoute", async () => {
  const { useEffect } = await import("react");
  return {
    MotionDummyEditorRoute: ({
      onEditorControllerChange,
      templateId: selectedTemplateId,
    }: {
      onEditorControllerChange: (controller: unknown) => void;
      templateId: string;
    }) => {
      useEffect(() => {
        onEditorControllerChange({
          id: "test-editor",
          label: "test editor",
          getState: () => ({
            saveState: "dirty",
            status: "Unsaved",
            dirty: true,
            mutationInFlight: false,
            writable: true,
            canUndo: true,
            canRedo: false,
          }),
          save: async () => undefined,
          undo: () => undefined,
          redo: () => undefined,
        });
        return () => onEditorControllerChange(null);
      }, [onEditorControllerChange]);
      return <section aria-label="Dirty test editor" data-template-id={selectedTemplateId} />;
    },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("shared studio shell", () => {
  it("preserves the complete Cutout context and flushes Prompt state before returning", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValue(true);
    const flushPromptStorage = vi.fn(async () => undefined);
    const { container } = render(
      <App
        assetsApi={idleAssetsClient()}
        flushPromptStorage={flushPromptStorage}
        vaultApi={testVaultClient()}
      />,
    );

    openTestArea();
    fireEvent.click(screen.getByRole("button", { name: "Open test binding" }));
    const workspace = await screen.findByRole("region", { name: "Test NPC workspace" });
    expect(workspace).toHaveAttribute("data-session-id", testIds.sessionId);
    expect(workspace).toHaveAttribute("data-area-id", testIds.areaId);
    expect(workspace).toHaveAttribute("data-npc-id", testIds.npcId);
    expect(workspace).toHaveAttribute("data-binding-id", testIds.bindingId);

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    expect(confirm).toHaveBeenCalledWith("Discard the unsaved NPC binding changes?");
    expect(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Navigation cancelled · save the NPC binding first",
    );

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    expect(await screen.findByRole("main", { name: "PixelPromptStudio Generator" })).toHaveFocus();
    expect(screen.queryByRole("navigation", { name: "Studio sections" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("banner")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));
    await waitFor(() => expect(flushPromptStorage).toHaveBeenCalledOnce());

    const restored = await screen.findByRole("region", { name: "Test NPC workspace" });
    expect(restored).toHaveAttribute("data-session-id", testIds.sessionId);
    expect(restored).toHaveAttribute("data-area-id", testIds.areaId);
    expect(restored).toHaveAttribute("data-npc-id", testIds.npcId);
    expect(restored).toHaveAttribute("data-binding-id", testIds.bindingId);
    expect(container.querySelector("[data-selected-template]")).toHaveAttribute(
      "data-selected-template",
      testIds.templateId,
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent(
      "Test Project",
    );
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toHaveTextContent("Test Area");
  });

  it("reuses the controlled editor navigation guard for a studio switch", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<App assetsApi={idleAssetsClient()} vaultApi={testVaultClient()} />);

    openTestArea();
    fireEvent.click(screen.getByRole("button", { name: "Open dirty test editor" }));
    await screen.findByRole("region", { name: "Dirty test editor" });
    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    expect(confirm).toHaveBeenCalledWith("Discard the unsaved test editor changes?");
    expect(screen.queryByRole("main", { name: "PixelPromptStudio Generator" })).toBeNull();
    expect(screen.getByRole("region", { name: "Dirty test editor" })).toBeInTheDocument();
  });

  it("blocks switching while a Cutout mutation is active", async () => {
    const importJob: AssetImportJobView = {
      job_id: "22222222-2222-4222-8222-222222222222",
      session_id: testIds.sessionId,
      area_id: testIds.areaId,
      state: "running",
      progress: { stage: "staging", completed: 1, total: 2, message: "Staging assets" },
      result: null,
      error: null,
    };
    const assetsApi = {
      activeImportJobs: vi.fn(async () => [importJob]),
      importJob: vi.fn(() => new Promise<AssetImportJobView>(() => undefined)),
    } as unknown as AssetClient;
    render(<App assetsApi={assetsApi} vaultApi={testVaultClient()} />);

    fireEvent.click(screen.getByRole("button", { name: "Open test vault" }));
    await screen.findByRole("region", { name: "Active asset import" });
    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    expect(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Studio switch blocked · cancel the active asset import first",
    );
  });

  it("keeps Prompt active when its lifecycle flush fails", async () => {
    const flushPromptStorage = vi.fn(async () => {
      throw new Error("disk full");
    });
    render(<App flushPromptStorage={flushPromptStorage} />);

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));
    await screen.findByRole("main", { name: "PixelPromptStudio Generator" });
    fireEvent.click(screen.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }));

    await waitFor(() => expect(flushPromptStorage).toHaveBeenCalledOnce());
    expect(
      screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Studio switch blocked · prompt data was not saved · disk full",
    );
  });
});

function openTestArea(): void {
  fireEvent.click(screen.getByRole("button", { name: "Open test vault" }));
  fireEvent.click(screen.getByRole("button", { name: "Open test project" }));
  fireEvent.click(screen.getByRole("button", { name: "Open test area" }));
}

function idleAssetsClient(): AssetClient {
  return {
    activeImportJobs: vi.fn(async () => []),
  } as unknown as AssetClient;
}

function testVaultClient(): VaultClient {
  return {
    close: vi.fn(async () => undefined),
    heartbeat: vi.fn(async () => undefined),
    listRecovery: vi.fn(async () => ({
      recovery: [],
      mode: "read_write",
      recovery_writable: true,
      indexed_objects: 3,
    })),
  } as unknown as VaultClient;
}
