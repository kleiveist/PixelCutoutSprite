import { SpriteSceneEnvelopeSchema, type SpriteSceneEnvelope } from "../shared/image/contracts";
import { defaultZ } from "../shared/image/parts";
import type { LoadedSprite, SpriteReconciliation } from "./client";

export function checkedScene(scene: SpriteSceneEnvelope): SpriteSceneEnvelope {
  const value = SpriteSceneEnvelopeSchema.parse(scene);
  if (
    value.layers.some((layer) =>
      [layer.position.x, layer.position.y, layer.pivot.x, layer.pivot.y].some(
        (n) => Math.abs(n) > 10_000_000,
      ),
    )
  )
    throw new Error("Position und Pivot sind auf ±10 Millionen Quellpixel begrenzt.");
  return value;
}
export function originalLayers(loaded: LoadedSprite): SpriteSceneEnvelope["layers"] {
  return loaded.assets.map((asset) => {
    const part = loaded.manifest?.parts.find((part) => part.partId === asset.partId);
    const pivot = part?.pivot ?? {
      x: Math.floor(asset.width / 2),
      y: Math.floor(asset.height / 2),
    };
    return {
      partId: asset.partId,
      pivot,
      position: part?.defaultPosition ?? pivot,
      rotationDeg: 0,
      scale: { x: 1, y: 1 },
      zIndex: part?.defaultZ ?? defaultZ(asset.partId),
      visible: true,
      locked: false,
    };
  });
}
/** Reconcile the in-memory scene, including unsaved edits, by stable part ID.
 * A moved crop origin changes the local pivot, not the world/source anchor. */
export function reconcileMemory(
  previous: LoadedSprite,
  scene: SpriteSceneEnvelope,
  next: LoadedSprite,
): { scene: SpriteSceneEnvelope; change: SpriteReconciliation } {
  if (scene.setId !== next.scene.setId)
    throw new Error("Der Ordner enthält ein anderes Set; keine automatische Übernahme.");
  const oldSource = previous.manifest?.source,
    newSource = next.manifest?.source;
  const sameSource =
    !!oldSource &&
    !!newSource &&
    oldSource.sha256 === newSource.sha256 &&
    oldSource.width === newSource.width &&
    oldSource.height === newSource.height;
  const change: SpriteReconciliation = {
    previousGenerationId: scene.generationId,
    addedParts: [],
    removedParts: scene.layers
      .filter((layer) => !next.assets.some((asset) => asset.partId === layer.partId))
      .map((layer) => layer.partId),
    geometryChangedParts: [],
    sourceChanged: !!oldSource && !!newSource && !sameSource,
    geometryUnknown: false,
  };
  const layers = originalLayers(next).map((defaultLayer) => {
    const old = scene.layers.find((layer) => layer.partId === defaultLayer.partId);
    if (!old) {
      change.addedParts.push(defaultLayer.partId);
      return defaultLayer;
    }
    const layer = structuredClone(old);
    const before = previous.manifest?.parts.find((part) => part.partId === layer.partId),
      after = next.manifest?.parts.find((part) => part.partId === layer.partId);
    if (before && after) {
      if (
        JSON.stringify(before.sourceRect) !== JSON.stringify(after.sourceRect) ||
        JSON.stringify(before.pivot) !== JSON.stringify(after.pivot) ||
        !sameSource
      )
        change.geometryChangedParts.push(layer.partId);
      if (sameSource)
        layer.pivot = {
          x: layer.pivot.x + before.sourceRect.x - after.sourceRect.x,
          y: layer.pivot.y + before.sourceRect.y - after.sourceRect.y,
        };
    } else {
      const a = previous.assets.find((asset) => asset.partId === layer.partId),
        b = next.assets.find((asset) => asset.partId === layer.partId);
      if (!a || !b || a.width !== b.width || a.height !== b.height)
        change.geometryChangedParts.push(layer.partId);
    }
    return layer;
  });
  return { scene: checkedScene({ ...next.scene, pixelSnap: scene.pixelSnap, layers }), change };
}
