import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import type {
  Direction,
  ExportFormat,
  ExportJumpMode,
  ExportProfileSnapshot,
  ExportRootMotionMode,
  LoopMode,
  PixelPoint,
  PixelSize,
} from "../domain";

export const EXPORT_PROGRESS_EVENT = "pixelcutoutsprite://export-progress";
export const EXPORT_FINISHED_EVENT = "pixelcutoutsprite://export-finished";

export interface NpcExportBindingInspection {
  binding_id: string;
  action_key: string;
  frame_size_px: PixelSize;
  ground_origin_px: PixelPoint;
  frame_count: number;
  fps: number;
  loop_mode: LoopMode;
  covered_directions: Direction[];
  missing_directions: Direction[];
  reviewed: boolean;
  ready: boolean;
  issue: string | null;
}

export interface NpcExportInspection {
  character_id: string;
  bindings: NpcExportBindingInspection[];
  missing_required_actions: string[];
  common_frame_size_px: PixelSize | null;
  common_ground_origin_px: PixelPoint | null;
}

export interface StartNpcExportRequest {
  character_id: string;
  binding_ids: string[];
  format: ExportFormat;
  include_godot_scene: boolean;
  profile: ExportProfileSnapshot;
  root_motion_mode: ExportRootMotionMode;
  jump_mode: ExportJumpMode;
}

export interface StoredNpcExportProfile {
  id: string;
  revision: number;
  format: ExportFormat;
  include_godot_scene: boolean;
  profile: ExportProfileSnapshot;
  root_motion_mode: ExportRootMotionMode;
  jump_mode: ExportJumpMode;
}

export interface SaveNpcExportProfileRequest {
  profile_id: string | null;
  expected_revision: number | null;
  format: ExportFormat;
  include_godot_scene: boolean;
  profile: ExportProfileSnapshot;
  root_motion_mode: ExportRootMotionMode;
  jump_mode: ExportJumpMode;
}

export type ExportJobState = "queued" | "running" | "completed" | "cancelled" | "failed";

export interface ExportProgress {
  stage: "preflight" | "rendering" | "packing" | "validating" | "publishing" | "godot_packaging";
  completed: number;
  total: number;
  message: string;
}

export interface ExportJobResult {
  build: string;
  source_fingerprint: string;
  complete: boolean;
  reused_existing_build: boolean;
  format: ExportFormat;
  godot_package: GodotPackageResult | null;
}

export interface GodotPackageResult {
  package_directory: string;
  animation_names: string[];
  scene: string | null;
  reused_existing_package: boolean;
}

export interface ExportJobView {
  job_id: string;
  session_id: string;
  character_id: string;
  state: ExportJobState;
  progress: ExportProgress | null;
  result: ExportJobResult | null;
  error: string | null;
}

export interface ExportClient {
  inspect(sessionId: string, areaId: string, characterId: string): Promise<NpcExportInspection>;
  listProfiles(sessionId: string, areaId: string): Promise<StoredNpcExportProfile[]>;
  saveProfile(
    sessionId: string,
    areaId: string,
    request: SaveNpcExportProfileRequest,
  ): Promise<StoredNpcExportProfile>;
  deleteProfile(
    sessionId: string,
    areaId: string,
    profileId: string,
    expectedRevision: number,
  ): Promise<void>;
  run(
    sessionId: string,
    areaId: string,
    request: StartNpcExportRequest,
    signal: AbortSignal,
    onProgress: (progress: ExportProgress) => void,
  ): Promise<ExportJobResult>;
}

export interface ExportRuntime {
  invoke<T>(command: string, args: Record<string, unknown>): Promise<T>;
  subscribe<T>(event: string, receive: (payload: T) => void): Promise<() => void>;
  delay(milliseconds: number): Promise<void>;
}

const defaultRuntime: ExportRuntime = {
  invoke,
  async subscribe<T>(event: string, receive: (payload: T) => void) {
    return listen<T>(event, ({ payload }) => receive(payload));
  },
  delay(milliseconds: number) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  },
};

const TERMINAL_STATES: readonly ExportJobState[] = ["completed", "cancelled", "failed"];
const POLL_INTERVAL_MS = 200;

export class ExportCancelledError extends Error {
  constructor(message = "Export cancelled. The last good build is unchanged.") {
    super(message);
    this.name = "ExportCancelledError";
  }
}

export function createExportClient(runtime: ExportRuntime = defaultRuntime): ExportClient {
  return {
    inspect(sessionId, areaId, characterId) {
      return runtime.invoke<NpcExportInspection>("inspect_npc_export", {
        sessionId,
        areaId,
        characterId,
      });
    },

    listProfiles(sessionId, areaId) {
      return runtime.invoke<StoredNpcExportProfile[]>("list_npc_export_profiles", {
        sessionId,
        areaId,
      });
    },

    saveProfile(sessionId, areaId, request) {
      return runtime.invoke<StoredNpcExportProfile>("save_npc_export_profile", {
        sessionId,
        areaId,
        request,
      });
    },

    deleteProfile(sessionId, areaId, profileId, expectedRevision) {
      return runtime.invoke<void>("delete_npc_export_profile", {
        sessionId,
        areaId,
        request: { profile_id: profileId, expected_revision: expectedRevision },
      });
    },

    async run(sessionId, areaId, request, signal, onProgress) {
      if (signal.aborted) throw new ExportCancelledError();

      const buffered = new Map<string, ExportJobView>();
      const bufferedProgress = new Map<string, ExportProgress[]>();
      const unlisten: Array<() => void> = [];
      let jobId: string | null = null;
      let current: ExportJobView | null = null;
      let wake: (() => void) | null = null;
      let cancellationRequested = false;
      let cancellationSent = false;
      let lastProgress = "";

      const emitProgress = (progress: ExportProgress): void => {
        const key = progressKey(progress);
        if (key === lastProgress) return;
        lastProgress = key;
        onProgress(progress);
      };

      const accept = (view: ExportJobView): void => {
        if (view.session_id !== sessionId) return;
        buffered.set(view.job_id, preferJobView(buffered.get(view.job_id) ?? null, view));
        if (view.progress && jobId === null) {
          const history = bufferedProgress.get(view.job_id) ?? [];
          if (
            progressKey(history.at(-1) ?? view.progress) !== progressKey(view.progress) ||
            history.length === 0
          )
            bufferedProgress.set(view.job_id, [...history, view.progress]);
        }
        if (view.job_id !== jobId) return;
        current = preferJobView(current, view);
        if (current.progress) emitProgress(current.progress);
        wake?.();
      };

      const requestCancellation = (): void => {
        cancellationRequested = true;
        if (!jobId || cancellationSent) return;
        cancellationSent = true;
        void runtime
          .invoke<ExportJobView>("cancel_npc_export", { sessionId, jobId })
          .then(accept)
          .catch(() => wake?.());
      };

      signal.addEventListener("abort", requestCancellation);
      try {
        for (const event of [EXPORT_PROGRESS_EVENT, EXPORT_FINISHED_EVENT]) {
          unlisten.push(await runtime.subscribe<ExportJobView>(event, accept));
        }
        const started = await runtime.invoke<ExportJobView>("start_npc_export", {
          sessionId,
          areaId,
          request,
        });
        jobId = started.job_id;
        current = preferJobView(started, buffered.get(jobId) ?? null);
        for (const item of bufferedProgress.get(jobId) ?? []) emitProgress(item);
        if (current?.progress) emitProgress(current.progress);
        if (signal.aborted || cancellationRequested) requestCancellation();

        while (current && !isTerminal(current.state)) {
          await Promise.race([
            runtime.delay(POLL_INTERVAL_MS),
            new Promise<void>((resolve) => {
              wake = resolve;
            }),
          ]);
          wake = null;
          if (current && isTerminal(current.state)) break;
          accept(
            await runtime.invoke<ExportJobView>("get_npc_export_job", {
              sessionId,
              jobId,
            }),
          );
        }
        if (!current) throw new Error("Native export job did not return a state.");
        return terminalResult(current);
      } finally {
        signal.removeEventListener("abort", requestCancellation);
        for (const stop of unlisten) stop();
      }
    },
  };
}

function terminalResult(view: ExportJobView): ExportJobResult {
  switch (view.state) {
    case "completed":
      if (!view.result || view.error)
        throw new Error("Native export completed without a valid result.");
      if (view.result.format !== "png_json" && view.result.format !== "godot_package")
        throw new Error("Native export completed with an unsupported output format.");
      if (
        (view.result.format === "godot_package" && !view.result.godot_package) ||
        (view.result.format === "png_json" && view.result.godot_package)
      )
        throw new Error("Native export completed with mismatched output metadata.");
      return view.result;
    case "cancelled":
      throw new ExportCancelledError(
        view.progress?.stage === "godot_packaging"
          ? "Godot packaging cancelled; previous generic current and previous Godot package unchanged. Validated orphan artifacts may remain."
          : undefined,
      );
    case "failed":
      throw new Error(view.error ?? "Native export failed without an error message.");
    default:
      throw new Error("Native export stopped before reaching a terminal state.");
  }
}

function preferJobView(
  current: ExportJobView | null,
  candidate: ExportJobView | null,
): ExportJobView {
  if (!candidate) {
    if (!current) throw new Error("Native export job did not return a state.");
    return current;
  }
  if (!current || isTerminal(candidate.state) || !isTerminal(current.state)) return candidate;
  return current;
}

function isTerminal(state: ExportJobState): boolean {
  return TERMINAL_STATES.includes(state);
}

function progressKey(progress: ExportProgress): string {
  return `${progress.stage}\u0000${progress.completed}\u0000${progress.total}\u0000${progress.message}`;
}

export const exportClient = createExportClient();
