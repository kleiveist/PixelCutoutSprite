import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export interface NativeCloseRequest {
  preventDefault(): void;
}

export interface NativeCloseWindow {
  onCloseRequested(
    handler: (event: NativeCloseRequest) => void | Promise<void>,
  ): Promise<() => void>;
  destroy(): Promise<void>;
}

export interface NativeCloseFlushOptions {
  readonly enabled?: boolean;
  readonly getWindow?: () => Promise<NativeCloseWindow>;
}

/**
 * Holds a native close request until all session-bound writes are durable.
 * A failed flush deliberately leaves the window and the editable state open.
 */
export async function registerNativeCloseFlush(
  flush: () => Promise<void>,
  onFailure: (reason: unknown) => void,
  options: NativeCloseFlushOptions = {},
): Promise<() => void> {
  if (!(options.enabled ?? isTauri())) return () => undefined;
  const currentWindow = await (options.getWindow ?? (async () => getCurrentWindow()))();
  let closeInFlight = false;
  return currentWindow.onCloseRequested(async (event) => {
    event.preventDefault();
    if (closeInFlight) return;
    closeInFlight = true;
    try {
      await flush();
      await currentWindow.destroy();
    } catch (reason) {
      closeInFlight = false;
      onFailure(reason);
    }
  });
}
