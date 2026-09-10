import { describe, expect, it } from "vitest";
import { spriteFixture, spritePixelFixture } from "./testFixtures";
import { backToFront, hitTest, inverse, layerMatrix, sceneBounds, transform } from "./geometry";
import { toSource, toView } from "../shared/image/viewport";

describe("P41 manifest assembly geometry", () => {
  it("places every local pixel at sourceRect.origin + pixel with noncentral pivots", () => {
    const fixture = spriteFixture();
    for (const part of fixture.manifest!.parts) {
      const layer = fixture.scene.layers.find((layer) => layer.partId === part.partId)!;
      for (let y = 0; y < part.sourceRect.height; y++)
        for (let x = 0; x < part.sourceRect.width; x++) {
          expect(transform({ x, y }, layerMatrix(layer))).toEqual({
            x: x + part.sourceRect.x,
            y: y + part.sourceRect.y,
          });
        }
    }
    expect(backToFront(fixture.scene.layers).at(-1)?.partId).toBe("head");
    expect(backToFront(fixture.scene.layers)[0]?.partId).toBe("torso");
  });
  it("hit-tests the frontmost visible alpha pixel independently of CSS zoom and DPR", () => {
    const fixture = spriteFixture(),
      pixels = new Map(
        fixture.assets.map((asset) => [asset.partId, spritePixelFixture(asset.partId)]),
      );
    for (const scale of [0.2, 1, 1.25, 2, 13]) {
      const view = { scale, offset: { x: -35, y: 17 } };
      const world = toSource(toView({ x: 5.5, y: 3.5 }, view), view);
      expect(hitTest(world, fixture.scene.layers, fixture.assets, pixels)).toBe("head");
      expect(hitTest({ x: 5.5, y: 4.5 }, fixture.scene.layers, fixture.assets, pixels)).toBeNull();
      expect(hitTest({ x: 3.5, y: 3.5 }, fixture.scene.layers, fixture.assets, pixels)).toBe(
        "torso",
      );
    }
    fixture.scene.layers[0]!.visible = false;
    expect(hitTest({ x: 5.5, y: 3.5 }, fixture.scene.layers, fixture.assets, pixels)).toBe("torso");
  });
  it("inverts rotation, nonuniform scale and off-image pivots and bounds transformed layers", () => {
    const fixture = spriteFixture(),
      layer = {
        ...fixture.scene.layers[0]!,
        rotationDeg: 73,
        scale: { x: 1.75, y: 0.25 },
        pivot: { x: -4, y: 7 },
        position: { x: 32, y: -15 },
      };
    const local = { x: 1.5, y: 0.5 },
      world = transform(local, layerMatrix(layer)),
      result = inverse(world, layerMatrix(layer));
    expect(result.x).toBeCloseTo(local.x, 10);
    expect(result.y).toBeCloseTo(local.y, 10);
    const bounds = sceneBounds([layer], fixture.assets);
    expect(world.x).toBeGreaterThanOrEqual(bounds.x);
    expect(world.x).toBeLessThanOrEqual(bounds.x + bounds.width);
    expect(world.y).toBeGreaterThanOrEqual(bounds.y);
    expect(world.y).toBeLessThanOrEqual(bounds.y + bounds.height);
  });
});
