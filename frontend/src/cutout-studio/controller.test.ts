import { afterEach, describe, expect, it, vi } from "vitest";
import { SaveQueue, type SessionIdentity } from "../shared/storage";
import { CutoutController } from "./controller";
import { cutoutFixtureClient, savedFixture } from "./testFixtures";
import { LoadedCutoutSchema } from "./client";

afterEach(() => vi.useRealTimers());
function setup(writable = true) {
  const fixture = cutoutFixtureClient();
  let session: SessionIdentity | null = { sessionId: "session-a", generation: 1 };
  const queue = new SaveQueue(() => session);
  const controller = new CutoutController(session, writable, fixture.client, queue);
  const detach = controller.attach();
  return {
    ...fixture,
    controller,
    queue,
    detach,
    close: () => {
      session = null;
    },
    dispose: () => {
      detach();
      controller.dispose();
    },
  };
}
describe("P38 cutout owner and autosave", () => {
  it("P43 detaches only explicitly and preserves dirty masks after a source failure", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    const save = test.client.save;
    test.client.save = vi.fn(async (session, request) => {
      if (!request.detachOriginal && test.stored().project.source.originalPath)
        throw new Error("SOURCE_CHANGED");
      return save(session, request);
    });
    test.controller.stroke("positive", [[1, 7]]);
    await expect(test.controller.flush()).rejects.toThrow("SOURCE_CHANGED");
    expect(test.controller.getSnapshot().loaded?.project.source.originalPath).toBe(
      "Images/hero.png",
    );
    expect(test.controller.getSnapshot().dirty).toBe(true);
    await test.controller.continueFromSnapshot();
    expect(test.stored().project.source.originalPath).toBeUndefined();
    expect(test.stored().project.source.originalSha256).toBeUndefined();
    expect(test.stored().masks.head?.draft).toEqual([[1, 7]]);
    expect(test.controller.getSnapshot().dirty).toBe(false);
    test.controller.stroke("positive", [[12, 1]]);
    await test.controller.flush();
    expect(test.stored().masks.head?.draft).toEqual([
      [1, 7],
      [12, 1],
    ]);
    test.dispose();
    const readonly = setup(false);
    await readonly.controller.open("Images/hero.png", "b".repeat(64));
    await readonly.controller.continueFromSnapshot();
    expect(readonly.client.save).not.toHaveBeenCalled();
    readonly.dispose();
  });
  it("saves draft and confirmed channels, active part, overlaps and undo across a flush/reopen", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("rectangle", [[1, 20]]);
    test.controller.confirm();
    test.controller.selectPart("upper_arm_r");
    test.controller.stroke("positive", [[14, 10]]);
    test.controller.stroke("negative", [[18, 2]]);
    test.controller.undo();
    expect(test.controller.active()?.mask.draft).toEqual([[14, 10]]);
    test.controller.redo();
    expect(test.controller.active()?.mask.draft).toEqual([
      [14, 4],
      [20, 4],
    ]);
    await test.queue.flush();
    expect(test.stored().masks.head?.confirmed).toEqual([[1, 20]]);
    expect(test.stored().project.activePartId).toBe("upper_arm_r");
    expect(LoadedCutoutSchema.safeParse(test.stored()).success).toBe(true);
    expect(test.controller.getSnapshot().dirty).toBe(false);
    test.dispose();
    const reopened = new CutoutController(
      { sessionId: "session-a", generation: 1 },
      true,
      test.client,
      test.queue,
    );
    await reopened.open("Images/hero.png", "b".repeat(64));
    expect(reopened.active()?.mask.draft).toEqual([
      [14, 4],
      [20, 4],
    ]);
    reopened.dispose();
  });
  it("serializes late writes without losing newer edits or issuing a stale revision", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    let release!: () => void;
    const first = test.stored();
    vi.mocked(test.client.save)
      .mockImplementationOnce(async (_session, request) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return savedFixture(first, request);
      })
      .mockImplementationOnce(async (_session, request) => {
        expect(request.expectedRevision).toBe(2);
        return savedFixture({ ...first, project: { ...first.project, revision: 2 } }, request);
      });
    test.controller.stroke("positive", [[1, 2]]);
    const saving = test.controller.flush();
    test.controller.stroke("positive", [[8, 2]]);
    release();
    await saving;
    expect(test.client.save).toHaveBeenCalledTimes(2);
    expect(test.controller.active()?.mask.draft).toEqual([
      [1, 2],
      [8, 2],
    ]);
    expect(test.controller.getSnapshot().dirty).toBe(false);
    test.dispose();
  });
  it("keeps a failed write dirty, blocks the shared flush and allows an explicit retry", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("positive", [[1, 2]]);
    vi.mocked(test.client.save).mockRejectedValueOnce(new Error("write_conflict"));
    await expect(test.queue.flush()).rejects.toThrow("write_conflict");
    expect(test.controller.getSnapshot().dirty).toBe(true);
    expect(test.controller.getSnapshot().error).toBe("write_conflict");
    await test.controller.flush();
    // The queue also reports its recorded failure once; it cannot silently turn a failed switch green.
    await expect(test.queue.flush()).rejects.toThrow("At least one");
    await test.queue.flush();
    expect(test.controller.getSnapshot().dirty).toBe(false);
    test.dispose();
  });
  it("rejects empty/invisible confirmation and enforces reasons for absent required parts", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("positive", [[0, 1]]);
    test.controller.confirm();
    expect(test.controller.getSnapshot().error).toMatch(/keine sichtbaren/);
    test.controller.markAbsent("");
    expect(test.controller.active()?.status).toBe("editing");
    test.controller.markAbsent("Vom Helm verdeckt");
    expect(test.controller.active()?.status).toBe("not_present");
    await test.queue.flush();
    test.dispose();
  });
  it("does not queue mutation for read-only edits and ignores a closed session's late load", async () => {
    const test = setup(false);
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("positive", [[1, 2]]);
    test.controller.confirm();
    test.controller.selectPart("torso");
    await test.queue.flush();
    expect(test.client.save).not.toHaveBeenCalled();
    expect(test.controller.active()?.mask.draft).toEqual([]);
    test.dispose();
    const late = setup();
    let release!: () => void;
    vi.mocked(late.client.pixels).mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return late.pixels;
    });
    const opening = late.controller.open("Images/hero.png", "b".repeat(64));
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    late.close();
    release();
    await opening;
    expect(late.controller.getSnapshot().loaded).toBeNull();
    late.dispose();
  });
  it("debounces autosave and retains the previous valid source on decoding failure", async () => {
    vi.useFakeTimers();
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("rectangle", [[2, 8]]);
    await vi.advanceTimersByTimeAsync(499);
    expect(test.client.save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(test.client.save).toHaveBeenCalledTimes(1);
    vi.mocked(test.client.pixels).mockRejectedValueOnce(new Error("Ungültiges Bild"));
    await test.controller.open("Images/other.png", "c".repeat(64));
    expect(test.controller.getSnapshot().loaded?.project.source.originalPath).toBe(
      "Images/hero.png",
    );
    expect(test.controller.active()?.mask.draft).toEqual([[2, 8]]);
    test.dispose();
  });
});
