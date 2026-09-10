import { expect, test, type Page } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

async function openSprite(page: Page) {
  await vaultFixture(page);
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  const folder = page.getByRole("treeitem", { name: /^Parts/ });
  await folder.focus();
  await folder.press("Enter");
  await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toBeVisible();
}
test("P41 assembles exact source positions with noncentral pivots, explicit Z and source-over pixels", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openSprite(page);
  const canvas = page.getByRole("img", { name: "Sprite-Zusammenstellung im Quellpixelraum" });
  await canvas.scrollIntoViewIfNeeded();
  // Independent expected source (20x12) -> padded fit, not product geometry imports.
  const sample = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement,
      box = canvas.getBoundingClientRect(),
      scale = Math.min((box.width - 24) / 20, (box.height - 24) / 12);
    const left = (box.width - 20 * scale) / 2,
      top = (box.height - 12 * scale) / 2;
    return [
      [4.5, 3.5],
      [5.5, 3.5],
      [6.5, 3.5],
      [5.5, 4.5],
      [6.5, 4.5],
    ].map(([x, y]) =>
      Array.from(
        canvas
          .getContext("2d")!
          .getImageData(
            Math.floor(((left + x! * scale) * canvas.width) / box.width),
            Math.floor(((top + y! * scale) * canvas.height) / box.height),
            1,
            1,
          ).data,
      ),
    );
  });
  expect(sample[0]).toEqual([255, 0, 0, 255]); // head over torso, despite filename 01
  expect(sample[1]![0]).toBe(0);
  expect(sample[1]![1]).toBeCloseTo(128, 0);
  expect(sample[1]![2]).toBeCloseTo(127, 0);
  expect(sample[1]![3]).toBe(255);
  expect(sample[2]).toEqual([255, 255, 0, 255]);
  expect(sample[3]).toEqual([0, 0, 0, 0]);
  expect(sample[4]).toEqual([255, 255, 255, 91]);
  await page.getByRole("tab", { name: "View", exact: true }).click();
  const layers = page.getByRole("list", { name: "Sprite-Ebenen" });
  await expect(layers.getByRole("button").first()).toContainText("Kopf");
  await layers.getByRole("button", { name: "Torso auswählen" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Ausgewählte Ebene: torso" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Dateien", exact: true }).click();
  await page.getByRole("tab", { name: "View", exact: true }).click();
  await expect(layers.getByRole("button", { name: "Torso auswählen" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({ path: testInfo.outputPath("p41-original-assembly.png") });
  await page.evaluate(() => Reflect.set(window, "p41FailSprite", true));
  await page.getByRole("button", { name: "Teile erneut prüfen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "wurde geändert" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("P41 legacy sets are explicitly manual and the View drawer stays usable in small windows", async ({
  page,
}, testInfo) => {
  await vaultFixture(page);
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.evaluate(() => {
    const sprite = Reflect.get(window, "p41Sprite");
    Object.assign(sprite, {
      directory: "Legacy",
      sourceKind: "legacy",
      manifest: null,
      manualAlignment: true,
      warnings: [
        "Legacy-Set ohne Positionsmetadaten: manuell ausrichten. Keine rekonstruierte Originalanordnung.",
      ],
    });
    const folders = Reflect.get(window, "p36Folders");
    folders[""].push({
      name: "Legacy",
      relativePath: "Legacy",
      kind: "directory",
      technical: false,
      setCandidate: false,
      fingerprint: "a".repeat(64),
    });
  });
  await page.getByRole("button", { name: "Dateien aktualisieren" }).click();
  await page.getByRole("treeitem", { name: /^Legacy/ }).click();
  await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toContainText(
    "manuell ausrichten",
  );
  for (const [width, height] of [
    [960, 540],
    [720, 450],
    [480, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    if (width! < 800) await page.getByRole("button", { name: "Dateien / View öffnen" }).click();
    await page.getByRole("tab", { name: "View", exact: true }).click();
    const torso = page
      .getByRole("list", { name: "Sprite-Ebenen" })
      .getByRole("button", { name: "Torso auswählen" });
    await torso.scrollIntoViewIfNeeded();
    await torso.focus();
    await torso.press("Enter");
    await expect(torso).toHaveAttribute("aria-pressed", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`p41-view-${width}.png`) });
    if (width! < 800) await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toContainText(
      "manuell ausrichten",
    );
  }
});
