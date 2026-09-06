import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssetClient } from "../api/asset-client";
import type { PromptStudioClient } from "../api/prompt-studio-client";
import type { VaultClient } from "../api/vault-client";
import type { PromptHandoff, PromptHandoffAvailability } from "../prompt-studio/domain/handoff";
import { App } from "./App";

const testState = vi.hoisted(() => ({
  vaultMode: "read_write" as "read_only" | "read_write",
}));

const ids = vi.hoisted(() => ({
  session: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  project: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  area: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  profile: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
}));

const handoff: PromptHandoff = {
  schemaVersion: 1,
  category: "character",
  prompt: "main prompt",
  negativePrompt: "negative prompt",
  technicalPrompt: "technical prompt",
  profileReferences: ["base_world", "asset_hero"],
  createdAt: "2026-09-06T12:00:00.000Z",
};

vi.mock("../prompt-studio/app", () => ({
  PromptGeneratorRoot: ({
    handoffAvailability,
    onHandoff,
  }: {
    handoffAvailability: PromptHandoffAvailability;
    onHandoff: (value: PromptHandoff) => Promise<void>;
  }) => (
    <section aria-label="Test Prompt workspace">
      <span>{handoffAvailability.available ? "handoff ready" : handoffAvailability.reason}</span>
      <button
        type="button"
        disabled={!handoffAvailability.available}
        onClick={() => void onHandoff(handoff)}
      >
        Test handoff
      </button>
    </section>
  ),
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
            id: ids.area,
            revision: 1,
            project_id: ids.project,
            name: "Handoff Area",
            object_type: "humanoid",
            profile_ref: { id: ids.profile, revision: 1 },
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
        Open handoff area
      </button>
    ) : (
      <button
        type="button"
        onClick={() =>
          onVaultOpened({
            session_id: ids.session,
            vault_id: "handoff-vault",
            path: "/handoff-vault",
            mode: testState.vaultMode,
            indexed_objects: 2,
            notice: null,
            recovery: [],
            recovery_writable: testState.vaultMode === "read_write",
            lock_recovery: null,
          })
        }
      >
        Open handoff vault
      </button>
    ),
}));

vi.mock("../features/projects/ProjectDashboard", () => ({
  ProjectDashboard: ({ onOpen }: { onOpen: (project: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onOpen({
          id: ids.project,
          revision: 1,
          name: "Handoff Project",
          status: "active",
          labels: [],
          workspace_label_ids: [],
          created_at: "2026-09-06T00:00:00Z",
          updated_at: "2026-09-06T00:00:00Z",
        })
      }
    >
      Open handoff project
    </button>
  ),
}));

vi.mock("../features/animations/AnimationDashboard", () => ({
  AnimationDashboard: () => <section aria-label="Restored Handoff Area" />,
}));

beforeEach(() => {
  testState.vaultMode = "read_write";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Prompt handoff host boundary", () => {
  it("keeps handoff disabled while no Cutout Area is selected", async () => {
    const promptApi = createPromptApi();
    render(<App assetsApi={idleAssetsClient()} promptApi={promptApi} />);

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    expect(await screen.findByRole("button", { name: "Test handoff" })).toBeDisabled();
    expect(screen.getByText("Öffne zuerst einen Vault und wähle eine Area aus.")).toBeVisible();
    expect(promptApi.handoff).not.toHaveBeenCalled();
  });

  it("rejects a read-only Vault before invoking the native handoff", async () => {
    testState.vaultMode = "read_only";
    const promptApi = createPromptApi();
    render(
      <App assetsApi={idleAssetsClient()} promptApi={promptApi} vaultApi={testVaultClient()} />,
    );
    openArea();

    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    expect(await screen.findByRole("button", { name: "Test handoff" })).toBeDisabled();
    expect(screen.getByText("Der geöffnete Vault ist schreibgeschützt.")).toBeVisible();
    expect(promptApi.handoff).not.toHaveBeenCalled();
  });

  it("stores a valid handoff and returns to the preserved Cutout Area", async () => {
    const promptApi = createPromptApi();
    const flushPromptStorage = vi.fn(async () => undefined);
    render(
      <App
        assetsApi={idleAssetsClient()}
        flushPromptStorage={flushPromptStorage}
        promptApi={promptApi}
        vaultApi={testVaultClient()}
      />,
    );
    openArea();
    fireEvent.click(screen.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }));

    fireEvent.click(await screen.findByRole("button", { name: "Test handoff" }));

    await waitFor(() =>
      expect(promptApi.handoff).toHaveBeenCalledWith(ids.session, ids.area, handoff),
    );
    await waitFor(() => expect(flushPromptStorage).toHaveBeenCalledOnce());
    expect(await screen.findByRole("region", { name: "Restored Handoff Area" })).toBeVisible();
    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Prompt reference saved · projects/handoff/prompt-references/prompt.json",
    );
  });
});

function openArea(): void {
  fireEvent.click(screen.getByRole("button", { name: "Open handoff vault" }));
  fireEvent.click(screen.getByRole("button", { name: "Open handoff project" }));
  fireEvent.click(screen.getByRole("button", { name: "Open handoff area" }));
}

function createPromptApi(): PromptStudioClient {
  return {
    handoff: vi.fn(async () => ({
      relative_path: "projects/handoff/prompt-references/prompt.json",
    })),
  };
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
      mode: testState.vaultMode,
      recovery_writable: testState.vaultMode === "read_write",
      indexed_objects: 2,
    })),
  } as unknown as VaultClient;
}
