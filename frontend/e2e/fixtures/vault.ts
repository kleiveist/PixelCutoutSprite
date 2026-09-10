import type { Page } from "@playwright/test";
import { DEFAULT_GLOBAL_SETTINGS } from "../../src/shared/settings/globalSettingsClient";
import { PARTS } from "../../src/shared/image/parts";
import type {
  LoadedCutout,
  SaveCutoutRequest,
  GenerateRequest,
} from "../../src/cutout-studio/client";
import type { RefineRequest, RefineJobSnapshot } from "../../src/cutout-studio/assistance";
import { spriteFixture, spritePixelFixture } from "../../src/sprite-studio/testFixtures";
import type { LoadedSprite, SaveSpriteRequest } from "../../src/sprite-studio/client";

/** Real browser/production router with explicit IPC fixtures, not a native filesystem gate. */
export async function vaultFixture(page: Page, connectGeneration = false) {
  await page.addInitScript(
    ({ settings, parts, sprite, spritePixels, connectGeneration }) => {
      type Item = {
        name: string;
        relativePath: string;
        kind: "directory" | "image" | "unsupported";
        technical: boolean;
        setCandidate: boolean;
        fingerprint: string;
      };
      const item = (path: string, kind: Item["kind"] = "image", setCandidate = false): Item => ({
        name: path.split("/").at(-1)!,
        relativePath: path,
        kind,
        technical: false,
        setCandidate,
        fingerprint: "a".repeat(64),
      });
      const folders: Record<string, Item[]> = {
        "": [
          item("Images", "directory"),
          item("Parts", "directory", true),
          item("unknown.exe", "unsupported"),
        ],
        Images: [item("Images/hero.png")],
        Parts: [],
      };
      let callback = 0;
      const calls: string[] = [];
      let refine: { request: RefineRequest; polls: number; cancelled: boolean } | null = null;
      const emptyMask = () => ({
        schemaVersion: 1 as const,
        kind: "cutoutMask" as const,
        draft: [],
        confirmed: [],
        roi: [],
        positive: [],
        negative: [],
        protected: [],
      });
      let cutout: LoadedCutout = JSON.parse(
        sessionStorage.getItem("p38-cutout-fixture") ?? "null",
      ) ?? {
        projectPath: ".PixelStudio/recovery/cutout/cutout-browser/cutout.project.json",
        sha256: "a".repeat(64),
        persisted: true,
        project: {
          schemaVersion: 1,
          kind: "cutoutProject",
          id: "cutout-browser",
          revision: 1,
          createdAt: "2026-09-10T00:00:00Z",
          updatedAt: "2026-09-10T00:00:00Z",
          activePartId: "head",
          source: {
            originalPath: "Images/hero.png",
            originalSha256: "b".repeat(64),
            snapshotPath: ".source/original.png",
            sha256: "c".repeat(64),
            width: 16,
            height: 24,
          },
          parts: parts
            .filter((part) => part.partId !== "sword")
            .map((part) => ({
              partId: part.partId,
              status: part.required ? "unmarked" : "disabled",
              maskRevision: 0,
              maskPath: null,
              maskSha256: null,
              reason: null,
            })),
        },
        masks: Object.fromEntries(
          parts.filter((part) => part.partId !== "sword").map((part) => [part.partId, emptyMask()]),
        ),
      };
      if (cutout.projectPath === "Images/hero/cutout.project.json")
        folders.Images!.push(item("Images/hero", "directory", true));
      Object.assign(
        spritePixels,
        JSON.parse(sessionStorage.getItem("p43-generated-pixels") ?? "{}"),
      );
      Object.assign(window, {
        isTauri: true,
        p36Folders: folders,
        p37Calls: calls,
        p41Sprite: JSON.parse(sessionStorage.getItem("p42-sprite-fixture") ?? "null") ?? sprite,
        p41FailSprite: false,
        p42SaveConflict: false,
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { windowLabel: "main", label: "main" },
          },
          transformCallback: () => ++callback,
          unregisterCallback: () => undefined,
          invoke: async (
            command: string,
            args: {
              query?: {
                relativePath: string;
                search: string;
                filter: string;
                cursor: string | null;
                limit: number;
              };
              relativePath?: string;
              directory?: string;
              sourceKind?: "manifest" | "legacy";
              partId?: string;
              request?: SaveCutoutRequest | RefineRequest | GenerateRequest | SaveSpriteRequest;
              jobId?: string;
            },
          ) => {
            calls.push(command);
            switch (command) {
              case "open_sprite_set":
              case "inspect_sprite_set":
                if (Reflect.get(window, "p41FailSprite"))
                  throw new Error("Sprite-Datei oder Manifest wurde geändert.");
                return structuredClone(Reflect.get(window, "p41Sprite"));
              case "save_sprite_scene": {
                const request = args.request as SaveSpriteRequest;
                const current = Reflect.get(window, "p41Sprite") as LoadedSprite;
                if (
                  Reflect.get(window, "p42SaveConflict") ||
                  request.expectedSceneSha256 !== current.sceneSha256 ||
                  request.expectedBasisSha256 !== current.basisSha256 ||
                  request.expectedDocumentSha256 !== current.documentSha256 ||
                  (current.reconciliation && !request.acceptGeneration)
                )
                  throw new Error("write_conflict: Szene wurde extern geändert.");
                const revision = current.sceneSha256 ? current.scene.revision + 1 : 1;
                const saved: LoadedSprite = {
                  ...current,
                  scene: { ...structuredClone(request.scene), revision },
                  sceneSha256: String(revision).padStart(64, "0"),
                  basisSha256: String(100 + revision).padStart(64, "0"),
                  reconciliation: null,
                };
                Reflect.set(window, "p41Sprite", saved);
                sessionStorage.setItem("p42-sprite-fixture", JSON.stringify(saved));
                return structuredClone(saved);
              }
              case "read_sprite_pixels":
                if (Reflect.get(window, "p41FailSprite")) throw new Error("Sprite-PNG fehlt.");
                return new Uint8Array(spritePixels[args.partId!]).buffer;
              case "open_cutout_set":
                return structuredClone(cutout);
              case "preview_cutout_generation":
                return {
                  directory: "Images/hero",
                  alternative: false,
                  existing: cutout.projectPath === "Images/hero/cutout.project.json",
                };
              case "generate_cutout_parts": {
                const request = args.request as GenerateRequest;
                if (
                  request.expectedRevision !== cutout.project.revision ||
                  request.expectedSha256 !== cutout.sha256
                )
                  throw new Error("write_conflict");
                cutout = {
                  ...cutout,
                  projectPath: `${request.directory}/cutout.project.json`,
                  sha256: "e".repeat(64),
                  project: { ...cutout.project, revision: cutout.project.revision + 1 },
                };
                sessionStorage.setItem("p38-cutout-fixture", JSON.stringify(cutout));
                if (!folders.Images!.some((entry) => entry.relativePath === request.directory))
                  folders.Images!.push(item(request.directory, "directory", true));
                if (connectGeneration) {
                  // Test-only IPC bridge: metadata/pixel responses are derived from
                  // the masks just confirmed in this browser. Native PNG encoding,
                  // hashes and publication are proved separately by the real GUI run.
                  const generatedParts = cutout.project.parts
                    .filter((part) => part.status === "confirmed")
                    .map((part, index) => {
                      const indices = cutout.masks[part.partId]!.confirmed.flatMap(
                        ([start, length]) => Array.from({ length }, (_, i) => start + i),
                      );
                      const xs = indices.map((i) => i % 16);
                      const ys = indices.map((i) => Math.floor(i / 16));
                      const sourceRect = {
                        x: Math.min(...xs),
                        y: Math.min(...ys),
                        width: Math.max(...xs) - Math.min(...xs) + 1,
                        height: Math.max(...ys) - Math.min(...ys) + 1,
                      };
                      const pivot = { x: sourceRect.width / 2, y: sourceRect.height / 2 };
                      const selected = new Set(indices);
                      const pixels: number[] = [];
                      for (let y = 0; y < sourceRect.height; y++)
                        for (let x = 0; x < sourceRect.width; x++) {
                          const sx = x + sourceRect.x,
                            sy = y + sourceRect.y;
                          pixels.push(sx * 15, sy * 10, 90, selected.has(sy * 16 + sx) ? 255 : 0);
                        }
                      Reflect.set(spritePixels, part.partId, pixels);
                      const definition = parts.find((p) => p.partId === part.partId)!;
                      return {
                        partId: part.partId,
                        file: definition.file,
                        sha256: "a".repeat(64),
                        sourceRect,
                        pivot,
                        defaultPosition: { x: sourceRect.x + pivot.x, y: sourceRect.y + pivot.y },
                        defaultZ: index * 10,
                        parentId: definition.parentId,
                      };
                    });
                  const generated: LoadedSprite = {
                    ...sprite,
                    directory: request.directory,
                    documentSha256: "f".repeat(64),
                    manifest: {
                      ...sprite.manifest!,
                      setId: cutout.project.id,
                      generationId: `gen-browser-${cutout.project.revision}`,
                      cutoutRevision: cutout.project.revision,
                      source: cutout.project.source,
                      complete: !cutout.project.parts.some((part) => part.status === "not_present"),
                      parts: generatedParts,
                      omittedParts: cutout.project.parts
                        .filter((part) => part.status === "not_present")
                        .map((part) => ({ partId: part.partId, reason: part.reason! })),
                    },
                    assets: generatedParts.map((part) => ({
                      partId: part.partId,
                      file: part.file,
                      sha256: part.sha256,
                      width: part.sourceRect.width,
                      height: part.sourceRect.height,
                    })),
                    scene: {
                      ...sprite.scene,
                      setId: cutout.project.id,
                      generationId: `gen-browser-${cutout.project.revision}`,
                      layers: generatedParts.map((part) => ({
                        partId: part.partId,
                        position: part.defaultPosition,
                        pivot: part.pivot,
                        rotationDeg: 0,
                        scale: { x: 1, y: 1 },
                        zIndex: part.defaultZ,
                        visible: true,
                        locked: false,
                      })),
                    },
                  };
                  Reflect.set(window, "p41Sprite", generated);
                  sessionStorage.setItem("p42-sprite-fixture", JSON.stringify(generated));
                  sessionStorage.setItem("p43-generated-pixels", JSON.stringify(spritePixels));
                }
                return {
                  loaded: structuredClone(cutout),
                  directory: request.directory,
                  manifestSha256: "f".repeat(64),
                  generationId: `gen-browser-${cutout.project.revision}`,
                  complete: !cutout.project.parts.some((part) => part.status === "not_present"),
                  partCount: cutout.project.parts.filter((part) => part.status === "confirmed")
                    .length,
                };
              }
              case "start_cutout_refine": {
                const request = args.request as RefineRequest;
                refine = { request, polls: 0, cancelled: false };
                return request.jobId;
              }
              case "cancel_cutout_refine":
                if (refine?.request.jobId === args.jobId) refine.cancelled = true;
                return null;
              case "get_cutout_refine_progress": {
                if (!refine || refine.request.jobId !== args.jobId)
                  throw new Error("Unknown fixture job");
                const request = refine.request;
                const metadata = {
                  jobId: request.jobId,
                  sourceHash: request.sourceHash,
                  partId: request.partId,
                  maskRevision: request.maskRevision,
                };
                if (refine.cancelled)
                  return {
                    ...metadata,
                    progress: 100,
                    status: "cancelled",
                    result: null,
                    error: null,
                  } satisfies RefineJobSnapshot;
                if (++refine.polls < 4)
                  return {
                    ...metadata,
                    progress: refine.polls * 25,
                    status: "running",
                    result: null,
                    error: null,
                  } satisfies RefineJobSnapshot;
                // Controlled IPC result for the browser's alpha-only fixture, not a
                // substitute for the native geodesic quality/cancellation tests.
                const selected = new Set<number>();
                for (const [start, length] of [...request.mask.roi, ...request.mask.protected])
                  for (let i = start; i < start + length; i++) if (i > 0) selected.add(i);
                for (const [start, length] of request.mask.negative)
                  for (let i = start; i < start + length; i++) selected.delete(i);
                const draft: [number, number][] = [];
                for (const index of [...selected].sort((a, b) => a - b)) {
                  const last = draft.at(-1);
                  if (last && last[0] + last[1] === index) last[1]++;
                  else draft.push([index, 1]);
                }
                return {
                  ...metadata,
                  progress: 100,
                  status: "completed",
                  error: null,
                  result: {
                    draft,
                    uncertain: false,
                    advice:
                      "Transparente Außenkontur entfernt. Innere Körperteilgrenzen bitte prüfen.",
                    selectedPixels: selected.size,
                    examinedPixels: 384,
                    elapsedMs: 7,
                    estimatedWorkingBytes: 3840,
                  },
                } satisfies RefineJobSnapshot;
              }
              case "open_cutout_source":
                return structuredClone(cutout);
              case "read_cutout_pixels": {
                const pixels = new Uint8Array(16 * 24 * 4);
                for (let i = 0; i < 16 * 24; i++) {
                  pixels[i * 4] = (i % 16) * 15;
                  pixels[i * 4 + 1] = Math.floor(i / 16) * 10;
                  pixels[i * 4 + 2] = 90;
                  pixels[i * 4 + 3] = i === 0 ? 0 : i % 16 === 15 ? 91 : 255;
                }
                return pixels.buffer;
              }
              case "save_cutout_project": {
                const request = args.request as SaveCutoutRequest;
                if (
                  request.expectedRevision !== cutout.project.revision ||
                  request.expectedSha256 !== cutout.sha256
                )
                  throw new Error("write_conflict");
                cutout = {
                  ...cutout,
                  sha256: String((cutout.project.revision + 1) % 10).repeat(64),
                  project: {
                    ...cutout.project,
                    revision: cutout.project.revision + 1,
                    activePartId: request.activePartId,
                    parts: request.parts.map((part) => ({
                      partId: part.partId,
                      status: part.status,
                      reason: part.reason,
                      maskRevision: cutout.project.revision,
                      maskPath: `.masks/${part.partId}.json`,
                      maskSha256: "d".repeat(64),
                      selectionParameters: part.selectionParameters,
                    })),
                  },
                  masks: Object.fromEntries(request.parts.map((part) => [part.partId, part.mask])),
                };
                sessionStorage.setItem("p38-cutout-fixture", JSON.stringify(cutout));
                return structuredClone(cutout);
              }
              case "get_global_settings":
                return settings;
              case "recent_vaults":
                return ["/test/P36"];
              case "inspect_vault":
                return {
                  state: "valid",
                  path: "/test/P36",
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  writer_present: false,
                  lock_recovery: null,
                };
              case "open_vault":
                return {
                  session_id: "11111111-1111-4111-8111-111111111111",
                  session_generation: 1,
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  path: "/test/P36",
                  mode: "read_write",
                  indexed_objects: 0,
                  recovery: [],
                  recovery_writable: false,
                  lock_recovery: null,
                };
              case "scan_prompt_vault":
                return { baseProfile: null, profiles: [], drafts: [], issues: [] };
              case "list_workspace_entries": {
                const query = args.query!;
                const entries = (folders[query.relativePath] ?? []).filter(
                  (entry) =>
                    entry.name.toLowerCase().includes(query.search.toLowerCase()) &&
                    (query.filter !== "folders" || entry.kind === "directory") &&
                    (query.filter !== "images" || entry.kind !== "unsupported"),
                );
                const offset = Number(query.cursor ?? 0);
                return {
                  relativePath: query.relativePath,
                  entries: entries.slice(offset, offset + query.limit),
                  nextCursor:
                    offset + query.limit < entries.length ? String(offset + query.limit) : null,
                  totalMatches: entries.length,
                  skippedEntries: 0,
                };
              }
              case "inspect_workspace_entry":
                if (args.relativePath === "Legacy")
                  return {
                    kind: "legacy_set",
                    relativePath: "Legacy",
                    documentSha256: "b".repeat(64),
                    partCount: 15,
                  };
                if (args.relativePath === "Images/hero")
                  return {
                    kind: "sprite_set",
                    relativePath: "Images/hero",
                    manifestPath: "Images/hero/sprite.parts.json",
                    manifestSha256: "f".repeat(64),
                    setId: cutout.project.id,
                    generationId: `gen-browser-${cutout.project.revision}`,
                    complete: !cutout.project.parts.some((part) => part.status === "not_present"),
                    partCount: cutout.project.parts.filter((part) => part.status === "confirmed")
                      .length,
                  };
                if (args.relativePath === "Parts") {
                  const current = Reflect.get(window, "p41Sprite") as LoadedSprite;
                  return {
                    kind: "sprite_set",
                    relativePath: "Parts",
                    manifestPath: "Parts/sprite.parts.json",
                    manifestSha256: current.documentSha256,
                    setId: current.scene.setId,
                    generationId: current.scene.generationId,
                    complete: current.manifest?.complete ?? true,
                    partCount: current.assets.length,
                  };
                }
                if (args.relativePath === "Images")
                  return {
                    kind: "directory",
                    relativePath: "Images",
                    status: "ordinary",
                    message: null,
                  };
                return {
                  kind: "image",
                  relativePath: args.relativePath,
                  sha256: "b".repeat(64),
                  width: 16,
                  height: 24,
                };
              case "read_workspace_thumbnail":
                return {
                  dataUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
                  sha256: "b".repeat(64),
                };
              case "plugin:event|listen":
                return 1;
              case "plugin:event|unlisten":
              case "heartbeat_vault":
              case "close_vault":
                return null;
              default:
                throw new Error("Unexpected P36 browser fixture command: " + command);
            }
          },
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => undefined },
      });
    },
    {
      settings: DEFAULT_GLOBAL_SETTINGS,
      connectGeneration,
      parts: PARTS,
      sprite: spriteFixture(),
      spritePixels: Object.fromEntries(
        PARTS.filter((part) => part.required).map((part) => [
          part.partId,
          Array.from(spritePixelFixture(part.partId)),
        ]),
      ),
    },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
}
