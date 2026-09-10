import { expect, test, type Page } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

async function openImage(page: Page) {
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await expect(page.getByRole("region", { name: "Cutout-Maskeneditor" })).toBeVisible();
}
test("P38 marks, confirms overlapping parts, flushes on mode switch and reopens drafts", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await vaultFixture(page);
  await openImage(page);
  await expect(
    page.getByRole("group", { name: /Körperteilgruppen/ }).getByRole("button"),
  ).toHaveCount(6);
  const numeric = page.getByRole("group", {
    name: "Rechteck über Quellpixelkoordinaten markieren",
  });
  await numeric.getByRole("spinbutton", { name: "X", exact: true }).fill("2");
  await numeric.getByRole("spinbutton", { name: "Y", exact: true }).fill("3");
  await numeric.getByRole("spinbutton", { name: "Breite" }).fill("5");
  await numeric.getByRole("spinbutton", { name: "Höhe" }).fill("7");
  await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "35 markierte Quellpixel",
  );
  await page.getByRole("button", { name: "Auswahl bestätigen" }).click();
  await expect(page.getByRole("heading", { name: "Kopf · bestätigt" })).toBeVisible();
  await page.getByRole("button", { name: /^Rechter Arm,/ }).click();
  const flyout = page.getByRole("dialog", { name: "Rechter Arm: Teil auswählen" });
  await expect(flyout.locator("button[aria-pressed]")).toHaveCount(3);
  await flyout.getByRole("button", { name: /Oberarm rechts/ }).click();
  await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await expect(page.getByRole("button", { name: "PixelSpriteStudio öffnen" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }).click();
  await expect(
    page.getByRole("heading", { name: "Oberarm rechts · in Bearbeitung" }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "35 markierte Quellpixel",
  );
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("p38-cutout-fixture")!),
  );
  expect(stored.masks.head.confirmed).toEqual(stored.masks.upper_arm_r.draft);
  await page.screenshot({ path: testInfo.outputPath("p38-manual-overlap.png") });
  await page.reload();
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
  await openImage(page);
  await expect(
    page.getByRole("heading", { name: "Oberarm rechts · in Bearbeitung" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("P38 pointer coordinates, cancelled strokes and responsive flyouts remain usable", async ({
  page,
}, testInfo) => {
  await vaultFixture(page);
  await openImage(page);
  const canvas = page.getByRole("img", { name: "Maskeneditor im Quellpixelraum" });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  const scale = Math.min(box.width / 16, box.height / 24),
    left = box.x + (box.width - 16 * scale) / 2,
    top = box.y + (box.height - 24 * scale) / 2;
  await page.mouse.move(left + 2 * scale + 0.1, top + 3 * scale + 0.1);
  await page.mouse.down();
  await page.mouse.move(left + 6 * scale - 0.1, top + 8 * scale - 0.1);
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "20 markierte Quellpixel",
  );
  await page.getByRole("button", { name: "Pinsel +", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const cancelBox = (await canvas.boundingBox())!;
  await page.mouse.move(cancelBox.x + cancelBox.width / 2, cancelBox.y + cancelBox.height / 2);
  await page.mouse.down();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "20 markierte Quellpixel",
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "0 markierte Quellpixel",
  );
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await canvas.scrollIntoViewIfNeeded();
  const resizingBox = (await canvas.boundingBox())!;
  await page.mouse.move(
    resizingBox.x + resizingBox.width / 2,
    resizingBox.y + resizingBox.height / 2,
  );
  await page.mouse.down();
  await page.setViewportSize({ width: 720, height: 450 });
  await expect(page.getByRole("status").filter({ hasText: "Größenwechsel:" })).toContainText(
    "Strich verworfen",
  );
  await page.mouse.up();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "20 markierte Quellpixel",
  );
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [960, 540],
    [720, 450],
    [640, 480],
    [480, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const group = page.getByRole("button", { name: /^Extras,/ });
    await group.click();
    const popup = page.getByRole("dialog", { name: "Extras: Teil auswählen" });
    await expect(popup).toBeInViewport();
    expect(
      await popup.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight
        );
      }),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(group).toBeFocused();
    await group.click();
    await popup.getByRole("button", { name: "Extras: Teilwahl schließen" }).click();
    await expect(popup).not.toBeVisible();
    await expect(group).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
      "20 markierte Quellpixel",
    );
    await page.screenshot({ path: testInfo.outputPath(`p38-editor-${width}.png`) });
  }
});

test("P38 source pixels stay exact at fractional/high DPR after zoom and pan", async ({
  browser,
}) => {
  for (const deviceScaleFactor of [1.25, 2]) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
      viewport: { width: 960, height: 540 },
      deviceScaleFactor,
    });
    try {
      const page = await context.newPage();
      await vaultFixture(page);
      await openImage(page);
      await page.getByRole("button", { name: "Vergrößern", exact: true }).click();
      const canvas = page.getByRole("img", { name: "Maskeneditor im Quellpixelraum" });
      await canvas.scrollIntoViewIfNeeded();
      const box = (await canvas.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down({ button: "middle" });
      await page.mouse.move(box.x + box.width / 2 + 30, box.y + box.height / 2 - 20);
      await page.mouse.up({ button: "middle" });
      const scale = Math.min(box.width / 16, box.height / 24) * 1.25;
      const left = box.x + (box.width - 16 * scale) / 2 + 30,
        top = box.y + (box.height - 24 * scale) / 2 - 20;
      await page.mouse.move(left + 2 * scale + 0.2, top + 6 * scale + 0.2);
      await page.mouse.down();
      await page.mouse.move(left + 7 * scale - 0.2, top + 10 * scale - 0.2);
      await page.mouse.up();
      await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
        "20 markierte Quellpixel",
      );
    } finally {
      await context.close();
    }
  }
});
