import { describe, expect, it, vi } from "vitest";

import {
  registerNativeCloseFlush,
  type NativeCloseRequest,
  type NativeCloseWindow,
} from "./nativeCloseFlush";

function nativeWindow() {
  let handler: ((event: NativeCloseRequest) => void | Promise<void>) | null = null;
  const unlisten = vi.fn();
  const destroy = vi.fn(async () => undefined);
  const window: NativeCloseWindow = {
    async onCloseRequested(next) {
      handler = next;
      return unlisten;
    },
    destroy,
  };
  return {
    destroy,
    invoke: async () => {
      if (!handler) throw new Error("Close listener was not registered.");
      const event = { preventDefault: vi.fn() };
      await handler(event);
      return event;
    },
    unlisten,
    window,
  };
}

describe("registerNativeCloseFlush", () => {
  it("does not touch the native window in a browser session", async () => {
    const getWindow = vi.fn();
    const unlisten = await registerNativeCloseFlush(vi.fn(), vi.fn(), {
      enabled: false,
      getWindow,
    });
    unlisten();
    expect(getWindow).not.toHaveBeenCalled();
  });

  it("prevents close, flushes, and only then destroys the native window", async () => {
    const native = nativeWindow();
    const events: string[] = [];
    const stop = await registerNativeCloseFlush(
      async () => {
        events.push("flush");
      },
      vi.fn(),
      { enabled: true, getWindow: async () => native.window },
    );
    native.destroy.mockImplementation(async () => {
      events.push("destroy");
    });

    const event = await native.invoke();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(events).toEqual(["flush", "destroy"]);
    stop();
    expect(native.unlisten).toHaveBeenCalledOnce();
  });

  it("keeps the native window open and reports a failed flush", async () => {
    const native = nativeWindow();
    const failure = new Error("disk full");
    const onFailure = vi.fn();
    await registerNativeCloseFlush(
      async () => {
        throw failure;
      },
      onFailure,
      { enabled: true, getWindow: async () => native.window },
    );

    const event = await native.invoke();
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(native.destroy).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledWith(failure);
  });
});
