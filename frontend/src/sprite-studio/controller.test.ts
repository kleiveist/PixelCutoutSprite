import { describe, expect, it, vi } from "vitest";
import { SaveQueue, type SessionIdentity } from "../shared/storage";
import { SpriteController } from "./controller";
import { LoadedSpriteSchema, type SpriteClient } from "./client";
import { spriteFixture, spritePixelFixture } from "./testFixtures";

function setup() {
  let session: SessionIdentity | null = { sessionId: "sprite-session", generation: 1 };
  const client: SpriteClient = {
    current: vi.fn(async (_session, path) => spriteFixture(path)),
    save: vi.fn(async (_session, request) => ({
      ...spriteFixture(request.directory),
      scene: request.scene,
    })),
    open: vi.fn(async (_session, path) => spriteFixture(path)),
    pixels: vi.fn(async (_session, _loaded, id) => spritePixelFixture(id)),
  };
  const queue = new SaveQueue(() => session),
    owner = new SpriteController(session, true, client, queue);
  return {
    owner,
    client,
    queue,
    close: () => {
      session = null;
    },
  };
}
describe("P41 sprite load ownership", () => {
  it("publishes a complete source only after two-pass validation and bounded binary reads", async () => {
    const test = setup();
    try {
      let running = 0,
        peak = 0;
      vi.mocked(test.client.pixels).mockImplementation(async (_session, _loaded, id) => {
        running++;
        peak = Math.max(peak, running);
        await Promise.resolve();
        running--;
        return spritePixelFixture(id);
      });
      await test.owner.open("Parts", "manifest", "b".repeat(64));
      expect(test.owner.getSnapshot().pixels.size).toBe(15);
      expect(peak).toBe(2);
      expect(test.client.open).toHaveBeenCalledTimes(2);
      expect(test.owner.getSnapshot().selected).toBe("head");
      test.owner.select("torso");
      await test.owner.open("Parts", "manifest", "b".repeat(64));
      expect(test.owner.getSnapshot().selected).toBe("torso");
      expect(test.client.open).toHaveBeenCalledTimes(2);
    } finally {
      test.owner.dispose();
    }
    expect(test.owner.getSnapshot().pixels.size).toBe(0);
  });
  it("preserves the last valid scene on missing pixels or a scene changed during transfer", async () => {
    const test = setup();
    try {
      await test.owner.open("Parts", "manifest", "b".repeat(64));
      const previous = test.owner.getSnapshot().scene;
      vi.mocked(test.client.pixels).mockResolvedValueOnce(new Uint8ClampedArray(0));
      await test.owner.open("Broken", "manifest", "b".repeat(64));
      expect(test.owner.getSnapshot().scene).toBe(previous);
      expect(test.owner.getSnapshot().error).toContain("unvollständig");
      const changed = spriteFixture("Parts");
      changed.sceneSha256 = "a".repeat(64);
      vi.mocked(test.client.open)
        .mockResolvedValueOnce(spriteFixture("Parts"))
        .mockResolvedValueOnce(changed);
      await test.owner.open("Parts", "manifest", "b".repeat(64), true);
      expect(test.owner.getSnapshot().scene).toBe(previous);
      expect(test.owner.getSnapshot().error).toContain("während des Ladens");
    } finally {
      test.owner.dispose();
    }
  });
  it("discards delayed replies after a later selection or closed vault", async () => {
    const test = setup();
    try {
      let release!: () => void;
      vi.mocked(test.client.open).mockImplementationOnce(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return spriteFixture("Old");
      });
      const first = test.owner.open("Old", "manifest", "b".repeat(64));
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      const second = test.owner.open("New", "manifest", "b".repeat(64));
      release();
      await Promise.all([first, second]);
      expect(test.owner.getSnapshot().loaded?.directory).toBe("New");
      test.close();
      await test.owner.open("Other", "manifest", "b".repeat(64));
      expect(test.owner.getSnapshot().loaded?.directory).toBe("New");
    } finally {
      test.owner.dispose();
    }
  });
  it("rejects wrong files, out-of-source crops, inconsistent omissions and cyclic parents", () => {
    expect(LoadedSpriteSchema.safeParse(spriteFixture()).success).toBe(true);
    for (const mutate of [
      (value: ReturnType<typeof spriteFixture>) => {
        value.manifest!.parts[0]!.file = "../head.png";
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.manifest!.parts[0]!.sourceRect.width = 999;
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.manifest!.parts.pop();
        value.assets.pop();
        value.scene.layers.pop();
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.manifest!.parts[0]!.parentId = "torso";
        value.manifest!.parts[1]!.parentId = "head";
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.assets[1]!.partId = "head";
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.scene.generationId = "stale-gen";
      },
      (value: ReturnType<typeof spriteFixture>) => {
        value.manualAlignment = true;
      },
    ]) {
      const value = spriteFixture();
      mutate(value);
      expect(LoadedSpriteSchema.safeParse(value).success).toBe(false);
    }
  });
});
