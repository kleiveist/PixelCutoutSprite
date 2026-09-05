import { describe, expect, it, vi } from "vitest";

import {
  createExportClient,
  EXPORT_FINISHED_EVENT,
  EXPORT_PROGRESS_EVENT,
  type ExportJobView,
  type ExportRuntime,
  type StartNpcExportRequest,
} from "./export-client";

const request: StartNpcExportRequest = {
  character_id: "character-1",
  binding_ids: ["binding-1"],
  format: "godot_package",
  include_godot_scene: true,
  profile: {
    name: "Compact sheets",
    directions: ["s", "sw", "w", "nw", "n", "ne", "e", "se"],
    max_page_size_px: [2048, 2048],
    max_pages: 16,
    memory_budget_bytes: 256 * 1024 * 1024,
    padding_px: 0,
    extrude_edges: false,
    individual_frames: false,
    include_shadow: true,
    normalize_geometry: false,
    clipping_policy: "block",
    allow_incomplete_test: false,
  },
  root_motion_mode: "baked",
  jump_mode: "external",
};

describe("export client", () => {
  it("uses stable-ID inspection and vault-owned profile command payloads", async () => {
    const calls: Array<[string, Record<string, unknown>]> = [];
    const runtime = runtimeWith(async (command, args) => {
      calls.push([command, args]);
      if (command === "inspect_npc_export")
        return {
          character_id: "character-1",
          bindings: [],
          missing_required_actions: [],
          common_frame_size_px: null,
          common_ground_origin_px: null,
        };
      if (command === "list_npc_export_profiles") return [];
      if (command === "save_npc_export_profile")
        return {
          id: "profile-1",
          revision: 1,
          format: "godot_package",
          include_godot_scene: false,
          profile: request.profile,
          root_motion_mode: "baked",
          jump_mode: "external",
        };
      return undefined;
    });
    const client = createExportClient(runtime);

    await client.inspect("session", "area", "character-1");
    await client.listProfiles("session", "area");
    await client.saveProfile("session", "area", {
      profile_id: null,
      expected_revision: null,
      format: "godot_package",
      include_godot_scene: false,
      profile: request.profile,
      root_motion_mode: "baked",
      jump_mode: "external",
    });
    await client.deleteProfile("session", "area", "profile-1", 1);

    expect(calls).toEqual([
      ["inspect_npc_export", { sessionId: "session", areaId: "area", characterId: "character-1" }],
      ["list_npc_export_profiles", { sessionId: "session", areaId: "area" }],
      [
        "save_npc_export_profile",
        {
          sessionId: "session",
          areaId: "area",
          request: {
            profile_id: null,
            expected_revision: null,
            format: "godot_package",
            include_godot_scene: false,
            profile: request.profile,
            root_motion_mode: "baked",
            jump_mode: "external",
          },
        },
      ],
      [
        "delete_npc_export_profile",
        {
          sessionId: "session",
          areaId: "area",
          request: { profile_id: "profile-1", expected_revision: 1 },
        },
      ],
    ]);
  });

  it("buffers native events that finish before start returns and cleans up listeners", async () => {
    const events = new Map<string, (payload: unknown) => void>();
    const stopped = [vi.fn<() => void>(), vi.fn<() => void>()];
    const report = vi.fn();
    const runtime: ExportRuntime = {
      async invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
        if (command !== "start_npc_export") throw new Error(`unexpected ${command}`);
        expect(args).toEqual({ sessionId: "session", areaId: "area", request });
        const queued = job("queued");
        events.get(EXPORT_PROGRESS_EVENT)?.(
          job("running", {
            stage: "godot_packaging",
            completed: 2,
            total: 4,
            message: "Validated portable Godot resources",
          }),
        );
        events.get(EXPORT_FINISHED_EVENT)?.(completedJob());
        return queued as T;
      },
      async subscribe<T>(event: string, receive: (payload: T) => void): Promise<() => void> {
        events.set(event, receive as (payload: unknown) => void);
        return event === EXPORT_PROGRESS_EVENT ? stopped[0] : stopped[1];
      },
      delay: vi.fn(async () => undefined),
    };
    const result = await createExportClient(runtime).run(
      "session",
      "area",
      request,
      new AbortController().signal,
      report,
    );

    expect(result).toEqual(completedJob().result);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "godot_packaging", completed: 2 }),
    );
    expect(stopped[0]).toHaveBeenCalledOnce();
    expect(stopped[1]).toHaveBeenCalledOnce();
  });

  it("polls when an event is missed", async () => {
    const calls: string[] = [];
    const report = vi.fn();
    const runtime = runtimeWith(async (command) => {
      calls.push(command);
      if (command === "start_npc_export")
        return job("running", {
          stage: "godot_packaging",
          completed: 1,
          total: 4,
          message: "Copying validated generic artifacts",
        });
      if (command === "get_npc_export_job") return completedJob();
      throw new Error(`unexpected ${command}`);
    });

    await expect(
      createExportClient(runtime).run(
        "session",
        "area",
        request,
        new AbortController().signal,
        report,
      ),
    ).resolves.toEqual(completedJob().result);
    expect(calls).toEqual(["start_npc_export", "get_npc_export_job"]);
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "godot_packaging", completed: 1 }),
    );
  });

  it("turns AbortSignal into exactly one native cancel and waits for cancelled terminal state", async () => {
    const controller = new AbortController();
    let cancelCalls = 0;
    const runtime = runtimeWith(async (command) => {
      if (command === "start_npc_export") {
        queueMicrotask(() => controller.abort());
        return job("running", {
          stage: "godot_packaging",
          completed: 2,
          total: 4,
          message: "Validating portable Godot package",
        });
      }
      if (command === "cancel_npc_export") {
        cancelCalls += 1;
        return job("running");
      }
      if (command === "get_npc_export_job")
        return job("cancelled", {
          stage: "godot_packaging",
          completed: 2,
          total: 4,
          message: "Validating portable Godot package",
        });
      throw new Error(`unexpected ${command}`);
    });

    await expect(
      createExportClient(runtime).run("session", "area", request, controller.signal, vi.fn()),
    ).rejects.toThrow(
      "Godot packaging cancelled; previous generic current and previous Godot package unchanged. Validated orphan artifacts may remain.",
    );
    expect(cancelCalls).toBe(1);
  });

  it("rejects a terminal result whose format and native artifact metadata disagree", async () => {
    const runtime = runtimeWith(async (command) => {
      if (command !== "start_npc_export") throw new Error(`unexpected ${command}`);
      const completed = completedJob();
      return {
        ...completed,
        result: completed.result ? { ...completed.result, godot_package: null } : null,
      };
    });

    await expect(
      createExportClient(runtime).run(
        "session",
        "area",
        request,
        new AbortController().signal,
        vi.fn(),
      ),
    ).rejects.toThrow(/mismatched output metadata/i);
  });
});

function runtimeWith(
  handle: (command: string, args: Record<string, unknown>) => Promise<unknown>,
): ExportRuntime {
  return {
    async invoke<T>(command: string, args: Record<string, unknown>): Promise<T> {
      return (await handle(command, args)) as T;
    },
    async subscribe(): Promise<() => void> {
      return () => undefined;
    },
    delay: vi.fn(async () => undefined),
  };
}

function job(
  state: ExportJobView["state"],
  progress: ExportJobView["progress"] = null,
): ExportJobView {
  return {
    job_id: "job-1",
    session_id: "session",
    character_id: "character-1",
    state,
    progress,
    result: null,
    error: null,
  };
}

function completedJob(): ExportJobView {
  return {
    ...job("completed"),
    result: {
      build: "build-hash",
      source_fingerprint: "a".repeat(64),
      complete: true,
      reused_existing_build: false,
      format: "godot_package",
      godot_package: {
        package_directory: "characters/merchant/_exports/godot/package-hash-scene",
        animation_names: ["walk_s"],
        scene: "character.tscn",
        reused_existing_package: false,
      },
    },
  };
}
