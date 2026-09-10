import { vi } from "vitest";
import { PARTS } from "../shared/image/parts";
import type { CutoutClient, LoadedCutout, SaveCutoutRequest } from "./client";
import { emptyMask } from "./masks";

export function loadedFixture(): LoadedCutout {
  const parts = PARTS.filter((part) => part.partId !== "sword");
  return {
    projectPath: ".PixelStudio/recovery/cutout/cutout-test/cutout.project.json",
    sha256: "a".repeat(64),
    persisted: true,
    project: {
      schemaVersion: 1,
      kind: "cutoutProject",
      id: "cutout-test",
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
      parts: parts.map((part) => ({
        partId: part.partId,
        status: part.required ? "unmarked" : "disabled",
        maskRevision: 0,
        maskPath: null,
        maskSha256: null,
        reason: null,
      })),
    },
    masks: Object.fromEntries(parts.map((part) => [part.partId, emptyMask()])),
  };
}
export function savedFixture(old: LoadedCutout, request: SaveCutoutRequest): LoadedCutout {
  return {
    ...old,
    sha256: String((old.project.revision + 1) % 10).repeat(64),
    project: {
      ...old.project,
      source: request.detachOriginal
        ? { ...old.project.source, originalPath: undefined, originalSha256: undefined }
        : old.project.source,
      revision: old.project.revision + 1,
      activePartId: request.activePartId,
      parts: request.parts.map((part) => ({
        partId: part.partId,
        status: part.status,
        reason: part.reason,
        maskRevision: old.project.revision,
        maskPath: `.masks/${part.partId}.json`,
        maskSha256: "d".repeat(64),
        selectionParameters: part.selectionParameters,
      })),
    },
    masks: Object.fromEntries(request.parts.map((part) => [part.partId, part.mask])),
  };
}
export function cutoutFixtureClient() {
  let stored = loadedFixture();
  const pixels = new Uint8ClampedArray(16 * 24 * 4);
  for (let i = 0; i < 16 * 24; i++) {
    pixels[i * 4] = (i % 16) * 15;
    pixels[i * 4 + 1] = Math.floor(i / 16) * 10;
    pixels[i * 4 + 3] = i === 0 ? 0 : i % 16 === 15 ? 91 : 255;
  }
  const client: CutoutClient = {
    openSet: vi.fn(async () => stored),
    previewGeneration: vi.fn(async () => ({
      directory: "Images/hero",
      alternative: false,
      existing: !stored.projectPath.startsWith(".PixelStudio/"),
    })),
    generate: vi.fn(async (_session, request) => {
      stored = {
        ...stored,
        projectPath: `${request.directory}/cutout.project.json`,
        project: { ...stored.project, revision: stored.project.revision + 1 },
      };
      return {
        loaded: stored,
        directory: request.directory,
        generationId: "gen-test",
        manifestSha256: "e".repeat(64),
        complete: !stored.project.parts.some((part) => part.status === "not_present"),
        partCount: stored.project.parts.filter((part) => part.status === "confirmed").length,
      };
    }),
    startRefine: vi.fn(),
    refineProgress: vi.fn(),
    cancelRefine: vi.fn(async () => undefined),
    open: vi.fn(async () => stored),
    pixels: vi.fn(async () => pixels),
    save: vi.fn(async (_session, request) => {
      if (
        request.expectedRevision !== stored.project.revision ||
        request.expectedSha256 !== stored.sha256
      )
        throw new Error("write_conflict");
      stored = savedFixture(stored, request);
      return stored;
    }),
  };
  return { client, pixels, stored: () => stored };
}
