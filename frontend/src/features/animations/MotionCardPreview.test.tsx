import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MotionCardPreview } from "./MotionCardPreview";
import { shouldAnimatePreview } from "./preview-policy";

afterEach(() => vi.useRealTimers());

describe("motion preview policy", () => {
  it("animates only visible requested previews and honors reduced motion", () => {
    expect(
      shouldAnimatePreview({
        visible: true,
        hovered: true,
        focused: false,
        activated: false,
        reducedMotion: false,
      }),
    ).toBe(true);
    expect(
      shouldAnimatePreview({
        visible: false,
        hovered: true,
        focused: true,
        activated: true,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldAnimatePreview({
        visible: true,
        hovered: true,
        focused: true,
        activated: true,
        reducedMotion: true,
      }),
    ).toBe(false);
  });

  it("plays supplied stored frames on focus without a permanent render loop", () => {
    vi.useFakeTimers();
    render(
      <MotionCardPreview
        name="Walk"
        frameUrls={["frame-0.png", "frame-1.png"]}
        fps={10}
        visible
        reducedMotion={false}
      />,
    );
    const preview = screen.getByLabelText("Walk stored motion preview");
    expect(screen.getByRole("img")).toHaveAttribute("src", "frame-0.png");
    act(() => vi.advanceTimersByTime(150));
    expect(screen.getByRole("img")).toHaveAttribute("src", "frame-0.png");
    fireEvent.focus(preview);
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByRole("img")).toHaveAttribute("src", "frame-1.png");
    fireEvent.blur(preview);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole("img")).toHaveAttribute("src", "frame-1.png");
  });
});
