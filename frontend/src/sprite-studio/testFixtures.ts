import { PARTS, defaultZ } from "../shared/image/parts";
import type { LoadedSprite } from "./client";

/** Synthetic asymmetric RGBA fixtures; no production fallback or stored app data. */
export function spriteFixture(directory = "Parts"): LoadedSprite {
  const parts = PARTS.filter((part) => part.required).map((part, index) => {
    const sourceRect =
      index === 0
        ? { x: 4, y: 3, width: 3, height: 2 }
        : index === 1
          ? { x: 3, y: 3, width: 3, height: 1 }
          : { x: index - 2, y: 8, width: 1, height: 1 };
    const pivot = index === 0 ? { x: 0, y: 1 } : { x: 2, y: 0 };
    return {
      partId: part.partId,
      file: part.file,
      sha256: "a".repeat(64),
      sourceRect,
      pivot,
      defaultPosition: { x: sourceRect.x + pivot.x, y: sourceRect.y + pivot.y },
      defaultZ: index === 0 ? 40 : index === 1 ? -2 : defaultZ(part.partId),
      parentId: part.parentId,
    };
  });
  return {
    directory,
    sourceKind: "manifest",
    documentSha256: "b".repeat(64),
    manualAlignment: false,
    warnings: [],
    sceneSha256: null,
    basisSha256: null,
    reconciliation: null,
    manifest: {
      schemaVersion: 1,
      kind: "spriteParts",
      setId: "set_example",
      generationId: "generation_example",
      cutoutRevision: 1,
      source: {
        snapshotPath: ".source/original.png",
        sha256: "c".repeat(64),
        width: 20,
        height: 12,
      },
      complete: true,
      parts,
      omittedParts: [],
      createdAt: "2026-09-10T00:00:00Z",
    },
    assets: parts.map((part) => ({
      partId: part.partId,
      file: part.file,
      sha256: part.sha256,
      width: part.sourceRect.width,
      height: part.sourceRect.height,
    })),
    scene: {
      schemaVersion: 1,
      kind: "spriteScene",
      id: "scene-example",
      revision: 1,
      setId: "set_example",
      generationId: "generation_example",
      blendMode: "source-over",
      pixelSnap: true,
      layers: parts.map((part) => ({
        partId: part.partId,
        position: { ...part.defaultPosition },
        pivot: { ...part.pivot },
        rotationDeg: 0,
        scale: { x: 1, y: 1 },
        zIndex: part.defaultZ,
        visible: true,
        locked: false,
      })),
      createdAt: "2026-09-10T00:00:00Z",
      updatedAt: "2026-09-10T00:00:00Z",
    },
  };
}
export function spritePixelFixture(partId: string): Uint8ClampedArray {
  if (partId === "head")
    return new Uint8ClampedArray([
      255, 0, 0, 255, 0, 255, 0, 128, 255, 255, 0, 255, 255, 0, 255, 255, 0, 0, 0, 0, 255, 255, 255,
      91,
    ]);
  if (partId === "torso")
    return new Uint8ClampedArray([0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255]);
  return new Uint8ClampedArray([80, 180, 120, 255]);
}
