import { describe, expect, it, vi } from "vitest";

import { createIntegratedPromptNavigationAdapter } from "./navigationAdapter";

describe("integrated prompt navigation adapter", () => {
  it("keeps prompt navigation in host state without browser history", () => {
    const onNavigate = vi.fn();
    const listener = vi.fn();
    const adapter = createIntegratedPromptNavigationAdapter("dashboard", onNavigate);
    const unsubscribe = adapter.subscribe(listener);

    expect(adapter.readView()).toBe("dashboard");

    adapter.navigate("profiles");
    expect(adapter.readView()).toBe("profiles");
    expect(onNavigate).toHaveBeenCalledWith("profiles");
    expect(listener).toHaveBeenCalledOnce();

    adapter.navigate("profiles");
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();

    adapter.setView("output");
    expect(adapter.readView()).toBe("output");
    expect(onNavigate).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    adapter.setView("settings");
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
