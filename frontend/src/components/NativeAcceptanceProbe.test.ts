import { fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NativeAcceptanceProbe, percentile } from "./NativeAcceptanceProbe";

afterEach(() => vi.restoreAllMocks());

describe("native acceptance percentile math", () => {
  it("uses a deterministic nearest-rank percentile without mutating samples", () => {
    const samples = [40, 10, 30, 20];
    expect(percentile(samples, 0.5)).toBe(20);
    expect(percentile(samples, 0.95)).toBe(40);
    expect(percentile(samples, 0)).toBe(10);
    expect(samples).toEqual([40, 10, 30, 20]);
  });

  it("rejects missing samples and invalid quantiles", () => {
    expect(() => percentile([], 0.5)).toThrow(/at least one/);
    expect(() => percentile([1], 1.1)).toThrow(/between zero and one/);
  });

  it("does not collect frames until explicitly started on the loaded view", () => {
    const request = vi.spyOn(window, "requestAnimationFrame").mockReturnValue(17);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    render(createElement(NativeAcceptanceProbe));

    expect(request).not.toHaveBeenCalled();
    expect(screen.getByTestId("native-frame-probe")).toHaveTextContent("idle");

    fireEvent.click(screen.getByRole("button", { name: "Start frame probe on this view" }));
    expect(request).toHaveBeenCalledOnce();
    expect(screen.getByTestId("native-frame-probe")).toHaveTextContent("measuring");
  });
});
