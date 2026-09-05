import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MotionClient } from "../../api/motion-client";
import type { MotionCard } from "../../domain/animations";
import { LiveMotionCardPreview } from "./LiveMotionCardPreview";

afterEach(() => vi.unstubAllGlobals());

describe("LiveMotionCardPreview", () => {
  it("does not request stored frames until the card enters the viewport", async () => {
    let notify: IntersectionObserverCallback = () => undefined;
    class Observer {
      constructor(callback: IntersectionObserverCallback) {
        notify = callback;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
      readonly root = null;
      readonly rootMargin = "120px";
      readonly thresholds = [0];
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    const cardPreview = vi.fn(async () => ({
      frame_urls: ["stored-frame.png"],
      sample_indices: [0],
      fps: 1,
      direction: "s" as const,
      clipping_count: 0,
    }));
    const client = { cardPreview } as unknown as MotionClient;
    const motion: MotionCard = {
      id: "11111111-1111-4111-8111-111111111111",
      revision: 1,
      area_id: "22222222-2222-4222-8222-222222222222",
      name: "Walk",
      action_key: "walk",
      status: "new",
      label_ids: [],
      profile_ref: { id: "33333333-3333-4333-8333-333333333333", revision: 1 },
      frame_count: 12,
      fps: 12,
      loop_mode: "loop",
      direction_coverage: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
      released_revisions: [],
      latest_release: null,
      updated_at: "2026-09-05T10:00:00Z",
    };
    const view = render(
      <LiveMotionCardPreview client={client} sessionId="session" motion={motion} />,
    );
    expect(cardPreview).not.toHaveBeenCalled();
    act(() =>
      notify([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver),
    );
    await waitFor(() => expect(cardPreview).toHaveBeenCalledWith("session", motion.id, false));
    expect(screen.getByRole("img", { name: "Walk preview frame 1" })).toHaveAttribute(
      "src",
      "stored-frame.png",
    );
    view.rerender(
      <LiveMotionCardPreview
        client={client}
        sessionId="session"
        motion={{ ...motion, revision: 2, updated_at: "2026-09-05T10:01:00Z" }}
      />,
    );
    await waitFor(() => expect(cardPreview).toHaveBeenCalledTimes(2));
  });
});
