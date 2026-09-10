import { describe, expect, it, vi } from "vitest";
import { SaveQueue } from "../shared/storage";
import type { RefineJobSnapshot, RefineRequest } from "./assistance";
import { CutoutController } from "./controller";
import { cutoutFixtureClient } from "./testFixtures";

function setup(writable = true) {
  const fixture = cutoutFixtureClient(),
    session = { sessionId: "session-a", generation: 1 };
  const queue = new SaveQueue(() => session),
    controller = new CutoutController(session, writable, fixture.client, queue);
  const detach = controller.attach();
  let request: RefineRequest;
  vi.mocked(fixture.client.startRefine).mockImplementation(async (_session, next) => {
    request = next;
    return next.jobId;
  });
  const completed = (draft: [number, number][] | null = [[2, 3]]): RefineJobSnapshot => ({
    jobId: request.jobId,
    sourceHash: request.sourceHash,
    partId: request.partId,
    maskRevision: request.maskRevision,
    progress: 100,
    status: "completed",
    result: {
      draft,
      advice: draft ? "Kontur bitte prüfen." : "Mehrere Inseln: positive Seeds ergänzen.",
      uncertain: true,
      selectedPixels: 3,
      examinedPixels: 10,
      elapsedMs: 8,
      estimatedWorkingBytes: 128,
    },
    error: null,
  });
  return {
    ...fixture,
    queue,
    controller,
    completed,
    dispose: () => {
      detach();
      controller.dispose();
    },
  };
}
describe("P39 asynchronous selection ownership", () => {
  it("refines only the active draft, keeps confirmations/neighbors, records undo and persists parameters", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("rectangle", [[1, 10]]);
    test.controller.confirm();
    test.controller.selectPart("torso");
    test.controller.stroke("rectangle", [[2, 8]]);
    test.controller.setSelectionParameters({ alphaThreshold: 1, tolerance: 70, edgeWeight: 6 });
    vi.mocked(test.client.refineProgress).mockImplementation(async () => test.completed());
    await test.controller.assist();
    expect(test.controller.active()?.mask.draft).toEqual([[2, 3]]);
    expect(
      test.controller.getSnapshot().parts.find((part) => part.partId === "head")?.mask.confirmed,
    ).toEqual([[1, 10]]);
    expect(test.controller.getSnapshot().refineAdvice).toContain("Manuelle Prüfung nötig");
    test.controller.undo();
    expect(test.controller.active()?.mask.draft).toEqual([[2, 8]]);
    test.controller.redo();
    await test.queue.flush();
    expect(
      test.stored().project.parts.find((part) => part.partId === "torso")?.selectionParameters,
    ).toEqual({ alphaThreshold: 1, tolerance: 70, edgeWeight: 6 });
    test.dispose();
  });
  it.each(["manual", "part"])(
    "discards a late result after %s changes and asks the worker to cancel",
    async (change) => {
      const test = setup();
      await test.controller.open("Images/hero.png", "b".repeat(64));
      test.controller.stroke("rectangle", [[1, 10]]);
      let release!: () => void;
      vi.mocked(test.client.refineProgress).mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return test.completed();
      });
      const work = test.controller.assist();
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      if (change === "manual") test.controller.stroke("negative", [[2, 3]]);
      else test.controller.selectPart("torso");
      release();
      await work;
      expect(test.client.cancelRefine).toHaveBeenCalledTimes(1);
      expect(
        test.controller.getSnapshot().parts.find((part) => part.partId === "head")?.mask.draft,
      ).toEqual(
        change === "manual"
          ? [
              [1, 1],
              [5, 6],
            ]
          : [[1, 10]],
      );
      expect(test.controller.getSnapshot().refineProgress).toBeNull();
      test.dispose();
    },
  );
  it("does not accept mismatched job/source/part/revision metadata", async () => {
    for (const patch of [
      { jobId: "wrong-job" },
      { sourceHash: "0".repeat(64) },
      { partId: "torso" as const },
      { maskRevision: 999 },
    ]) {
      const test = setup();
      await test.controller.open("Images/hero.png", "b".repeat(64));
      test.controller.stroke("rectangle", [[1, 10]]);
      vi.mocked(test.client.refineProgress).mockImplementation(async () => ({
        ...test.completed(),
        ...patch,
      }));
      await test.controller.assist();
      expect(test.controller.active()?.mask.draft).toEqual([[1, 10]]);
      expect(test.controller.getSnapshot().refineAdvice).toContain("Veraltetes");
      test.dispose();
    }
  });
  it("cancels a start response that arrives after the user's cancel click", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    let release!: () => void;
    vi.mocked(test.client.startRefine).mockImplementation(async (_session, request) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return request.jobId;
    });
    const work = test.controller.assist();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await test.controller.cancelAssistance();
    release();
    await work;
    expect(test.client.cancelRefine).toHaveBeenCalledTimes(1);
    expect(test.client.refineProgress).not.toHaveBeenCalled();
    test.dispose();
  });
  it("leaves ambiguous and failed selections unchanged and never mutates in read-only mode", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    test.controller.stroke("rectangle", [[1, 10]]);
    vi.mocked(test.client.refineProgress).mockImplementation(async () => test.completed(null));
    await test.controller.assist();
    expect(test.controller.active()?.mask.draft).toEqual([[1, 10]]);
    expect(test.controller.getSnapshot().refineAdvice).toContain("Mehrere Inseln");
    vi.mocked(test.client.refineProgress).mockImplementation(async () => ({
      ...test.completed(),
      status: "failed",
      result: null,
      error: "SOURCE_CHANGED",
    }));
    await test.controller.assist();
    expect(test.controller.active()?.mask.draft).toEqual([[1, 10]]);
    expect(test.controller.getSnapshot().error).toBe("SOURCE_CHANGED");
    test.dispose();
    const readonly = setup(false);
    await readonly.controller.open("Images/hero.png", "b".repeat(64));
    await readonly.controller.assist();
    expect(readonly.client.startRefine).not.toHaveBeenCalled();
    readonly.dispose();
  });
  it("cancels unfinished work at the shared module/vault flush gate", async () => {
    const test = setup();
    await test.controller.open("Images/hero.png", "b".repeat(64));
    let release!: () => void;
    vi.mocked(test.client.refineProgress).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return test.completed();
    });
    const work = test.controller.assist();
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await test.queue.flush();
    release();
    await work;
    expect(test.client.cancelRefine).toHaveBeenCalledTimes(1);
    expect(test.controller.active()?.mask.draft).toEqual([]);
    test.dispose();
  });
});
