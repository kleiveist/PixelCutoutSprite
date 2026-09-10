export interface Point {
  readonly x: number;
  readonly y: number;
}
export interface Size {
  readonly width: number;
  readonly height: number;
}
export interface ImageViewport {
  readonly scale: number;
  readonly offset: Point;
}
export function fitImage(image: Size, view: Size): ImageViewport {
  const scale = Math.max(0.0001, Math.min(view.width / image.width, view.height / image.height));
  return {
    scale,
    offset: {
      x: (view.width - image.width * scale) / 2,
      y: (view.height - image.height * scale) / 2,
    },
  };
}
export const toSource = (point: Point, view: ImageViewport): Point => ({
  x: (point.x - view.offset.x) / view.scale,
  y: (point.y - view.offset.y) / view.scale,
});
export const toView = (point: Point, view: ImageViewport): Point => ({
  x: point.x * view.scale + view.offset.x,
  y: point.y * view.scale + view.offset.y,
});
export function zoomAt(view: ImageViewport, point: Point, factor: number): ImageViewport {
  const source = toSource(point, view),
    scale = Math.min(128, Math.max(0.01, view.scale * factor));
  return { scale, offset: { x: point.x - source.x * scale, y: point.y - source.y * scale } };
}
export function flyoutPosition(anchor: DOMRect, size: Size, view: Size): Point {
  const margin = 8;
  const left = anchor.left - size.width - margin;
  const x =
    left >= margin
      ? left
      : anchor.right + size.width + margin <= view.width - margin
        ? anchor.right + margin
        : anchor.left;
  return {
    x: Math.max(margin, Math.min(x, view.width - size.width - margin)),
    y: Math.max(margin, Math.min(anchor.top, view.height - size.height - margin)),
  };
}
