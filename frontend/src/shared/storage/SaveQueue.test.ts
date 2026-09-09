import { describe, expect, it, vi } from "vitest";

import { RepositoryError, SaveQueue, type SessionIdentity } from "./SaveQueue";

describe("SaveQueue", () => {
  it("serializes writes and flushes the durable result", async () => {
    const session = { sessionId: "one", generation: 1 } satisfies SessionIdentity;
    const events: string[] = [];
    const queue = new SaveQueue(() => session);
    const first = queue.enqueue(session, async () => {
      events.push("first:start");
      await Promise.resolve();
      events.push("first:end");
      return 1;
    });
    const second = queue.enqueue(session, async () => {
      events.push("second");
      return 2;
    });

    await queue.flush(session);
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    expect(events).toEqual(["first:start", "first:end", "second"]);
  });

  it("rejects a delayed result after a vault generation changes", async () => {
    let active: SessionIdentity = { sessionId: "one", generation: 1 };
    let release: (() => void) | undefined;
    const queue = new SaveQueue(() => active);
    const pending = queue.enqueue(active, async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return "late";
    });

    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    active = { sessionId: "two", generation: 2 };
    release?.();
    await expect(pending).rejects.toMatchObject<Partial<RepositoryError>>({
      code: "stale_session",
    });
  });

  it("keeps a failed flush observable to a vault switch", async () => {
    const session = { sessionId: "one", generation: 1 };
    const queue = new SaveQueue(() => session);
    void queue
      .enqueue(session, async () => {
        throw new Error("disk full");
      })
      .catch(() => undefined);

    await expect(queue.flush(session)).rejects.toMatchObject<Partial<RepositoryError>>({
      code: "flush_failed",
    });
  });

  it("commits registered debounce work before waiting for durable writes", async () => {
    const session = { sessionId: "one", generation: 1 };
    const events: string[] = [];
    const queue = new SaveQueue(() => session);
    const unregister = queue.registerBeforeFlush(async () => {
      events.push("prepare");
      await queue.enqueue(session, async () => {
        events.push("write");
      });
    });

    await queue.flush(session);
    unregister();
    await queue.flush(session);

    expect(events).toEqual(["prepare", "write"]);
  });
});
