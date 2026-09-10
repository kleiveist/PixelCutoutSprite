import type { PartId, SpriteSceneEnvelope } from "../shared/image/contracts";
import type { Point } from "../shared/image/viewport";
import type { SpriteAsset, SpritePixels } from "./client";
export type SpriteLayer = SpriteSceneEnvelope["layers"][number];
export type Matrix = readonly [number, number, number, number, number, number];
/** Source-local -> world: position + R(rotation) * S(scale) * (pixel - pivot). */
export function layerMatrix(layer: SpriteLayer): Matrix {
  const angle = (layer.rotationDeg * Math.PI) / 180,
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const a = cos * layer.scale.x,
    b = sin * layer.scale.x,
    c = -sin * layer.scale.y,
    d = cos * layer.scale.y;
  return [
    a,
    b,
    c,
    d,
    layer.position.x - a * layer.pivot.x - c * layer.pivot.y,
    layer.position.y - b * layer.pivot.x - d * layer.pivot.y,
  ];
}
export function transform(point: Point, [a, b, c, d, e, f]: Matrix): Point {
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f };
}
export function inverse(point: Point, [a, b, c, d, e, f]: Matrix): Point {
  const determinant = a * d - b * c,
    x = point.x - e,
    y = point.y - f;
  return { x: (d * x - c * y) / determinant, y: (-b * x + a * y) / determinant };
}
export const backToFront = (layers: readonly SpriteLayer[]): SpriteLayer[] =>
  [...layers].sort((a, b) => a.zIndex - b.zIndex || a.partId.localeCompare(b.partId, "en"));
export function hitTest(
  world: Point,
  layers: readonly SpriteLayer[],
  assets: readonly SpriteAsset[],
  pixels: SpritePixels,
): PartId | null {
  for (const layer of backToFront(layers).reverse()) {
    if (!layer.visible) continue;
    const local = inverse(world, layerMatrix(layer)),
      x = Math.floor(local.x),
      y = Math.floor(local.y);
    const asset = assets.find((asset) => asset.partId === layer.partId),
      rgba = pixels.get(layer.partId);
    if (
      asset &&
      rgba &&
      x >= 0 &&
      y >= 0 &&
      x < asset.width &&
      y < asset.height &&
      rgba[(y * asset.width + x) * 4 + 3]! > 0
    )
      return layer.partId;
  }
  return null;
}
export function sceneBounds(layers: readonly SpriteLayer[], assets: readonly SpriteAsset[]) {
  const points = layers
    .filter((layer) => layer.visible)
    .flatMap((layer) => {
      const asset = assets.find((asset) => asset.partId === layer.partId);
      return asset
        ? [
            { x: 0, y: 0 },
            { x: asset.width, y: 0 },
            { x: asset.width, y: asset.height },
            { x: 0, y: asset.height },
          ].map((point) => transform(point, layerMatrix(layer)))
        : [];
    });
  const x = Math.min(0, ...points.map((point) => point.x)),
    y = Math.min(0, ...points.map((point) => point.y));
  return {
    x,
    y,
    width: Math.max(1, ...points.map((point) => point.x)) - x,
    height: Math.max(1, ...points.map((point) => point.y)) - y,
  };
}
