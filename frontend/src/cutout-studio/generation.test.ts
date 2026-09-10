import { describe, expect, it, vi } from "vitest";
import { SaveQueue } from "../shared/storage";
import { CutoutController } from "./controller";
import { cutoutFixtureClient } from "./testFixtures";
import { PARTS } from "../shared/image/parts";

function setup(writable = true) {
  const fixture = cutoutFixtureClient();
  const session = { sessionId: "session-p40", generation: 1 };
  const queue = new SaveQueue(() => session);
  const owner = new CutoutController(session, writable, fixture.client, queue);
  return { ...fixture, owner, queue };
}
function confirmAll(owner: CutoutController) {
  for (const part of PARTS.filter((part) => part.required)) {
    owner.selectPart(part.partId);
    owner.stroke("rectangle", [[1, 8]]);
    owner.confirm();
  }
}
describe("P40 generation ownership and explicit confirmation", () => {
  it("gates incomplete work, flushes before preview, and uses the canonical receipt for later autosaves", async () => {
    const test = setup();
    try {
      await test.owner.open("Images/hero.png", "b".repeat(64));
      await test.owner.prepareGeneration();
      expect(test.owner.getSnapshot().error).toContain("Noch offen");
      expect(test.client.previewGeneration).not.toHaveBeenCalled();
      confirmAll(test.owner);
      await test.owner.prepareGeneration();
      expect(
        test.stored().project.parts.filter((part) => part.status === "confirmed"),
      ).toHaveLength(15);
      expect(test.client.generate).not.toHaveBeenCalled();
      await test.owner.generate(2);
      expect(test.owner.getSnapshot().notice).toContain("15 PNG-Teile erfolgreich geprüft");
      expect(test.owner.getSnapshot().loaded?.projectPath).toBe("Images/hero/cutout.project.json");
      test.owner.stroke("positive", [[20, 2]]);
      await test.owner.flush();
      expect(vi.mocked(test.client.save).mock.lastCall?.[1].projectPath).toBe(
        "Images/hero/cutout.project.json",
      );
    } finally {
      test.owner.dispose();
    }
  });
  it("keeps the single accessory mask when changing variants and marks absences as incomplete", async () => {
    const test = setup();
    try {
      await test.owner.open("Images/hero.png", "b".repeat(64));
      confirmAll(test.owner);
      test.owner.selectPart("head");
      test.owner.markAbsent("Im Original verdeckt");
      test.owner.selectPart("belt_accessory");
      test.owner.stroke("positive", [[15, 3]]);
      test.owner.confirm();
      test.owner.chooseAccessory("sword");
      expect(test.owner.active()?.partId).toBe("sword");
      expect(test.owner.active()?.mask.confirmed).toEqual([[15, 3]]);
      expect(test.owner.getSnapshot().parts.some((part) => part.partId === "belt_accessory")).toBe(
        false,
      );
      await test.owner.prepareGeneration();
      await test.owner.generate(0);
      expect(test.owner.getSnapshot().generated?.complete).toBe(false);
      expect(test.owner.getSnapshot().notice).toContain("bewusst unvollständig");
      test.owner.chooseAccessory("belt_accessory");
      expect(test.owner.active()?.mask.confirmed).toEqual([[15, 3]]);
    } finally {
      test.owner.dispose();
    }
  });
  it("never claims success after a conflict and preserves work during read-only and failed opens", async () => {
    const test = setup();
    try {
      await test.owner.open("Images/hero.png", "b".repeat(64));
      confirmAll(test.owner);
      vi.mocked(test.client.previewGeneration).mockResolvedValue({
        directory: "Images/hero-cutout-test",
        alternative: true,
        existing: false,
      });
      await test.owner.prepareGeneration();
      expect(test.owner.getSnapshot().generationTarget?.alternative).toBe(true);
      vi.mocked(test.client.generate).mockRejectedValue(new Error("write_conflict"));
      await test.owner.generate(0);
      expect(test.owner.getSnapshot().generated).toBeNull();
      expect(test.owner.getSnapshot().notice).toContain("Kein bestätigter Ausgabeerfolg");
      expect(
        test.owner.getSnapshot().parts.filter((part) => part.status === "confirmed"),
      ).toHaveLength(15);
      vi.mocked(test.client.openSet).mockRejectedValue(new Error("tampered manifest"));
      await test.owner.open("Parts", "c".repeat(64), true);
      expect(test.owner.getSnapshot().loaded?.project.source.originalPath).toBe("Images/hero.png");
    } finally {
      test.owner.dispose();
    }
    const readonly = setup(false);
    try {
      await readonly.owner.open("Parts", "a".repeat(64), true);
      await readonly.owner.prepareGeneration();
      await readonly.owner.generate(0);
      readonly.owner.chooseAccessory("sword");
      expect(readonly.client.openSet).toHaveBeenCalledOnce();
      expect(readonly.client.generate).not.toHaveBeenCalled();
      expect(readonly.client.save).not.toHaveBeenCalled();
    } finally {
      readonly.owner.dispose();
    }
  });
  it("invalidates a preview on subsequent edits and keeps the controls locked until commit", async () => {
    const test = setup();
    try {
      await test.owner.open("Images/hero.png", "b".repeat(64));
      confirmAll(test.owner);
      await test.owner.prepareGeneration();
      test.owner.selectPart("torso");
      expect(test.owner.getSnapshot().generationTarget).toBeNull();
      await test.owner.generate(0);
      expect(test.client.generate).not.toHaveBeenCalled();
      await test.owner.prepareGeneration();
      let release!: () => void;
      const original = test.client.generate;
      const implementation = vi.mocked(original).getMockImplementation()!;
      vi.mocked(original).mockImplementation(async (...args) => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return implementation(...args);
      });
      const generating = test.owner.generate(0);
      await vi.waitFor(() => expect(release).toBeTypeOf("function"));
      const before = test.owner.active();
      test.owner.stroke("positive", [[20, 2]]);
      expect(test.owner.active()).toBe(before);
      expect(test.owner.getSnapshot().busy).toBe(true);
      release();
      await generating;
      expect(test.owner.getSnapshot().busy).toBe(false);
      expect(test.owner.getSnapshot().generated?.complete).toBe(true);
    } finally {
      test.owner.dispose();
    }
  });
});
