import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveQueue } from "../shared/storage";
import { SpriteController } from "./controller";
import { LoadedSpriteSchema, type LoadedSprite, type SpriteClient } from "./client";
import { originalLayers, reconcileMemory } from "./editing";
import { spriteFixture, spritePixelFixture } from "./testFixtures";

const owners: SpriteController[] = [];
afterEach(() => {
  owners.splice(0).forEach((owner) => owner.dispose());
  vi.useRealTimers();
});
function setup(writable = true) {
  let disk = spriteFixture();
  const session = { sessionId: "sprite-session", generation: 1 };
  const queue = new SaveQueue(() => session);
  const client: SpriteClient = {
    open: vi.fn(async (_session, path, kind, hash) => {
      if (path !== disk.directory || kind !== disk.sourceKind || hash !== disk.documentSha256)
        throw new Error("Manifest geändert");
      return structuredClone(disk);
    }),
    current: vi.fn(async () => structuredClone(disk)),
    pixels: vi.fn(async (_session, _loaded, id) => spritePixelFixture(id)),
    save: vi.fn(async (_session, request) => {
      if (
        request.expectedSceneSha256 !== disk.sceneSha256 ||
        request.expectedBasisSha256 !== disk.basisSha256 ||
        request.expectedDocumentSha256 !== disk.documentSha256 ||
        (disk.reconciliation && !request.acceptGeneration)
      )
        throw new Error("write_conflict");
      const revision = disk.sceneSha256 ? disk.scene.revision + 1 : 1;
      disk = {
        ...disk,
        scene: { ...structuredClone(request.scene), revision },
        sceneSha256: String(revision).padStart(64, "0"),
        basisSha256: String(revision + 100).padStart(64, "0"),
        reconciliation: null,
      };
      return structuredClone(disk);
    }),
  };
  const owner = new SpriteController(session, writable, client, queue);
  owners.push(owner);
  owner.attach();
  return {
    owner,
    client,
    queue,
    disk: () => disk,
    replace: (next: LoadedSprite) => {
      disk = next;
    },
  };
}
const open = (owner: SpriteController) => owner.open("Parts", "manifest", "b".repeat(64));
const layer = (owner: SpriteController, id = "head") =>
  owner.getSnapshot().scene!.layers.find((layer) => layer.partId === id)!;
describe("P42 scene editing and persistence", () => {
  it("P43 retains raster references on scene autosave and blocks history while a field is invalid", async () => {
    const test = setup();
    await open(test.owner);
    const loaded = test.owner.getSnapshot().loaded!;
    test.owner.updateLayer("head", { position: { x: 42, y: 9 } });
    await test.owner.flush();
    expect(test.owner.getSnapshot().loaded!.assets).toBe(loaded.assets);
    expect(test.owner.getSnapshot().loaded!.manifest).toBe(loaded.manifest);
    expect(test.client.pixels).toHaveBeenCalledTimes(loaded.assets.length);
    test.owner.setInputError("position.x", "Ungültige Zahl");
    test.owner.undo();
    test.owner.restoreOriginal();
    expect(layer(test.owner).position).toEqual({ x: 42, y: 9 });
    await expect(test.owner.flush()).rejects.toThrow("Ungültige Zahl");
    test.owner.setInputError("position.x", null);
    test.owner.undo();
    expect(layer(test.owner).position).toEqual(loaded.scene.layers[0]!.position);
  });
  it("keeps a drag preview visible when an earlier autosave receipt arrives", async () => {
    const test = setup();
    await open(test.owner);
    const save = test.client.save;
    let release!: () => void;
    test.client.save = vi.fn(async (...args: Parameters<SpriteClient["save"]>) => {
      if (!release)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return save(...args);
    });
    test.owner.updateLayer("torso", { visible: false });
    const saving = test.owner.flush();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    test.owner.beginMove("head");
    test.owner.previewMove({ x: 3, y: 2 });
    const preview = layer(test.owner).position;
    release();
    await saving;
    expect(layer(test.owner).position).toEqual(preview);
    expect(test.owner.getSnapshot().dirty).toBe(false);
    test.owner.finishMove();
    await test.owner.flush();
    expect(test.disk().scene.layers[0]!.position).toEqual(preview);
    expect(test.disk().scene.revision).toBe(2);
  });
  it("debounces edits, blocks locked transforms and restores every property after reopening", async () => {
    vi.useFakeTimers();
    const test = setup();
    await open(test.owner);
    test.owner.updateLayer("head", { position: { x: 17.6, y: -3.2 } });
    expect(layer(test.owner).position).toEqual({ x: 18, y: -3 });
    test.owner.setPixelSnap(false);
    test.owner.updateLayer("head", {
      pivot: { x: 0.5, y: 0.75 },
      rotationDeg: 90,
      scale: { x: 2, y: 3 },
    });
    test.owner.updateLayer("torso", { visible: false });
    test.owner.moveOrder("head", "back");
    test.owner.updateLayer("head", { locked: true });
    const expected = layer(test.owner);
    test.owner.updateLayer("head", { position: { x: 999, y: 999 } });
    test.owner.moveOrder("head", "front");
    expect(layer(test.owner)).toEqual(expected);
    expect(test.owner.beginMove("head")).toBe(false);
    await vi.advanceTimersByTimeAsync(499);
    expect(test.client.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(test.client.save).toHaveBeenCalledTimes(1);
    expect(test.owner.getSnapshot().dirty).toBe(false);
    expect(test.disk().scene.layers.find((layer) => layer.partId === "head")).toEqual(expected);
    expect(test.disk().manifest).toEqual(spriteFixture().manifest);
    test.owner.dispose();
    const reopened = new SpriteController(
      { sessionId: "sprite-session", generation: 1 },
      true,
      test.client,
      test.queue,
    );
    owners.push(reopened);
    await open(reopened);
    expect(layer(reopened)).toEqual(expected);
    expect(layer(reopened, "torso").visible).toBe(false);
  });
  it("records one undo step per drag, cancels previews and deliberately restores defaults", async () => {
    const test = setup();
    await open(test.owner);
    const initial = layer(test.owner);
    expect(test.owner.beginMove("head")).toBe(true);
    test.owner.previewMove({ x: 3.4, y: -2.7 });
    expect(layer(test.owner).position).toEqual({
      x: initial.position.x + 3,
      y: initial.position.y - 3,
    });
    test.owner.cancelMove();
    expect(layer(test.owner)).toEqual(initial);
    expect(test.owner.getSnapshot().canUndo).toBe(false);
    test.owner.beginMove("head");
    test.owner.previewMove({ x: 3, y: 1 });
    test.owner.previewMove({ x: 5, y: 2 });
    test.owner.finishMove();
    const moved = layer(test.owner);
    test.owner.undo();
    expect(layer(test.owner)).toEqual(initial);
    expect(test.owner.getSnapshot().canUndo).toBe(false);
    test.owner.redo();
    expect(layer(test.owner)).toEqual(moved);
    test.owner.updateLayer("head", { locked: true });
    test.owner.restoreOriginal();
    expect(layer(test.owner)).toEqual(initial);
    test.owner.undo();
    expect(layer(test.owner)).toEqual({ ...moved, locked: true });
    await test.queue.flush();
    expect(test.owner.getSnapshot().dirty).toBe(false);
  });
  it("flushes edits made during a slow save using the returned revision before a switch", async () => {
    const test = setup();
    await open(test.owner);
    const save = test.client.save;
    let release!: () => void;
    test.client.save = vi.fn(async (...args: Parameters<SpriteClient["save"]>) => {
      if (!release)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return save(...args);
    });
    test.owner.updateLayer("head", { position: { x: 30, y: 10 } });
    const saving = test.owner.flush();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    test.owner.updateLayer("head", { position: { x: 31, y: 11 } });
    const reopening = test.owner.open("Parts", "manifest", "b".repeat(64), true);
    release();
    await Promise.all([saving, reopening]);
    expect(test.client.save).toHaveBeenCalledTimes(2);
    expect(test.disk().scene.revision).toBe(2);
    expect(layer(test.owner).position).toEqual({ x: 31, y: 11 });
    expect(test.owner.getSnapshot().dirty).toBe(false);
  });
  it("keeps local edits on conflicts and only discards them after the explicit reload action", async () => {
    const test = setup();
    await open(test.owner);
    test.owner.updateLayer("head", { position: { x: 88, y: 99 } });
    const external = structuredClone(test.disk());
    external.sceneSha256 = "d".repeat(64);
    external.basisSha256 = "e".repeat(64);
    external.scene.layers[0]!.position.x = 200;
    test.replace(external);
    await expect(test.owner.flush()).rejects.toThrow("write_conflict");
    expect(layer(test.owner).position.x).toBe(88);
    expect(test.owner.getSnapshot().dirty).toBe(true);
    await test.owner.refresh();
    expect(test.owner.getSnapshot().error).toContain("extern geändert");
    expect(layer(test.owner).position.x).toBe(88);
    await test.owner.refresh(true);
    expect(layer(test.owner).position.x).toBe(200);
    expect(test.owner.getSnapshot().dirty).toBe(false);
    expect(test.client.save).toHaveBeenCalledTimes(1);
  });
  it("previews a new generation without losing unsaved transforms or reintroducing omitted parts", async () => {
    const test = setup();
    await open(test.owner);
    test.owner.updateLayer("head", {
      position: { x: 55, y: 66 },
      rotationDeg: 90,
      scale: { x: 2, y: 3 },
    });
    const old = test.owner.getSnapshot().scene;
    const next = structuredClone(test.disk());
    next.documentSha256 = "f".repeat(64);
    next.manifest!.generationId = "generation-next";
    next.scene.generationId = "generation-next";
    next.manifest!.parts[0]!.sourceRect.x += 2;
    next.manifest!.parts[0]!.defaultPosition.x += 2;
    next.manifest!.parts = next.manifest!.parts.filter((part) => part.partId !== "torso");
    next.manifest!.omittedParts = [{ partId: "torso", reason: "verdeckt" }];
    next.manifest!.complete = false;
    next.assets = next.assets.filter((asset) => asset.partId !== "torso");
    next.scene.layers = next.scene.layers.filter((layer) => layer.partId !== "torso");
    test.replace(next);
    await test.owner.refresh();
    expect(test.owner.getSnapshot().scene).toBe(old);
    const pending = test.owner.getSnapshot().pending!;
    expect(pending.loaded.reconciliation?.removedParts).toEqual(["torso"]);
    expect(pending.loaded.scene.layers[0]!.pivot.x).toBe(-2);
    expect(pending.loaded.scene.layers[0]!.position).toEqual({ x: 55, y: 66 });
    await expect(test.owner.flush()).rejects.toThrow("Generationsabgleich");
    expect(test.client.save).not.toHaveBeenCalled();
    await test.owner.acceptReconciliation();
    expect(test.owner.getSnapshot().pending).toBeNull();
    expect(test.owner.getSnapshot().canUndo).toBe(false);
    expect(layer(test.owner).position).toEqual({ x: 55, y: 66 });
    expect(test.disk().scene.layers.some((layer) => layer.partId === "torso")).toBe(false);
  });
  it("keeps read-only scenes unchanged and blocks flush for invalid in-progress numeric input", async () => {
    const readOnly = setup(false);
    await open(readOnly.owner);
    readOnly.owner.updateLayer("head", { visible: false });
    readOnly.owner.restoreOriginal();
    readOnly.owner.undo();
    expect(layer(readOnly.owner).visible).toBe(true);
    expect(readOnly.owner.beginMove("head")).toBe(false);
    await readOnly.queue.flush();
    expect(readOnly.client.save).not.toHaveBeenCalled();
    const writable = setup();
    await open(writable.owner);
    writable.owner.updateLayer("head", { visible: false });
    writable.owner.setInputError("Position X", "Ungültige Position X");
    await expect(writable.queue.flush()).rejects.toThrow("Ungültige Position X");
    expect(writable.client.save).not.toHaveBeenCalled();
    writable.owner.setInputError("Position X", null);
    await writable.queue.flush();
    expect(writable.client.save).toHaveBeenCalledTimes(1);
  });
  it("bounds history to 48 snapshots and preserves the current revision when undoing a saved edit", async () => {
    const test = setup();
    await open(test.owner);
    for (let index = 0; index < 60; index++)
      test.owner.updateLayer("head", { position: { x: 100 + index, y: 1 } });
    await test.owner.flush();
    let undone = 0;
    while (test.owner.getSnapshot().canUndo) {
      test.owner.undo();
      undone++;
    }
    expect(undone).toBe(48);
    await test.owner.flush();
    expect(test.disk().scene.revision).toBe(2);
    expect(layer(test.owner).position.x).toBe(111);
  });
  it("preserves alpha-independent affine anchors when a crop changes and reports unknown geometry", () => {
    const previous = spriteFixture(),
      next = spriteFixture();
    const scene = structuredClone(previous.scene);
    scene.layers[0]!.position = { x: 42, y: -7 };
    scene.layers[0]!.rotationDeg = 90;
    scene.layers[0]!.scale = { x: 2, y: 3 };
    next.manifest!.generationId = "next-gen";
    next.scene.generationId = "next-gen";
    next.manifest!.parts[0]!.sourceRect.x += 2;
    next.manifest!.parts[0]!.defaultPosition.x += 2;
    const result = reconcileMemory(previous, scene, next);
    expect(result.scene.layers[0]!.pivot).toEqual({ x: -2, y: 1 });
    expect(result.change.geometryChangedParts).toEqual(["head"]);
    expect(originalLayers(previous)[0]).toEqual(previous.scene.layers[0]);
    expect(
      LoadedSpriteSchema.safeParse({ ...next, scene: result.scene, reconciliation: result.change })
        .success,
    ).toBe(true);
  });
});
