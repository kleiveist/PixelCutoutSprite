import { expect, test, type Page } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

async function openSprite(page: Page) {
  await vaultFixture(page);
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("treeitem", { name: /^Parts/ }).click();
  await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toBeVisible();
}
async function view(page: Page) {
  const toggle = page.getByRole("button", { name: "Dateien / View öffnen" });
  if (await toggle.isVisible()) await toggle.click();
  await page.getByRole("tab", { name: "View", exact: true }).click();
}
async function saved(page: Page) {
  await expect(page.getByRole("status").filter({ hasText: /^Szene gespeichert/ })).toBeVisible();
}
async function headPosition(page: Page) {
  return page.evaluate(
    () =>
      Reflect.get(window, "p41Sprite").scene.layers.find(
        (layer: { partId: string }) => layer.partId === "head",
      ).position,
  );
}
test("P42 View order changes canvas pixels; transforms, locks and visibility survive restart", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await openSprite(page);
  await view(page);
  // Keyboard alternative to DnD: bring the last layer to the top.
  const forward = page.getByRole("button", { name: "Torso nach vorn", exact: true });
  for (let i = 0; i < 14; i++) {
    await forward.focus();
    await forward.press("Enter");
  }
  const layers = page.getByRole("list", { name: "Sprite-Ebenen" });
  await expect(layers.getByRole("button").first()).toHaveAccessibleName("Torso auswählen");
  const canvas = page.getByRole("img", { name: "Sprite-Zusammenstellung im Quellpixelraum" });
  await canvas.scrollIntoViewIfNeeded();
  const pixel = await canvas.evaluate((element) => {
    const canvas = element as HTMLCanvasElement,
      box = canvas.getBoundingClientRect();
    const scale = Math.min((box.width - 24) / 20, (box.height - 24) / 12);
    return Array.from(
      canvas
        .getContext("2d")!
        .getImageData(
          Math.floor((((box.width - 20 * scale) / 2 + 4.5 * scale) * canvas.width) / box.width),
          Math.floor((((box.height - 12 * scale) / 2 + 3.5 * scale) * canvas.height) / box.height),
          1,
          1,
        ).data,
    );
  });
  expect(pixel).toEqual([0, 0, 255, 255]);
  await page.getByRole("checkbox", { name: "Torso sichtbar", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Torso sperren", exact: true }).check();
  await page.getByRole("button", { name: "Torso auswählen", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Kopf auswählen", exact: true }).click();
  await page.getByRole("checkbox", { name: "Freie Transformationen aktivieren" }).check();
  for (const [name, value] of [
    ["Position X", "10.25"],
    ["Position Y", "-5.5"],
    ["Pivot X", "0.25"],
    ["Rotation in Grad", "90"],
    ["Skalierung X", "1.5"],
    ["Skalierung Y", "2"],
  ]) {
    await page.getByRole("spinbutton", { name: name!, exact: true }).fill(value!);
  }
  await page.getByRole("spinbutton", { name: "Skalierung Y", exact: true }).press("Tab");
  await saved(page);
  const expected = await page.evaluate(() => Reflect.get(window, "p41Sprite").scene);
  expect(
    expected.layers.find((layer: { partId: string }) => layer.partId === "head"),
  ).toMatchObject({
    position: { x: 10.25, y: -5.5 },
    pivot: { x: 0.25, y: 1 },
    rotationDeg: 90,
    scale: { x: 1.5, y: 2 },
  });
  await page.reload();
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("treeitem", { name: /^Parts/ }).click();
  await view(page);
  await expect(
    page.getByRole("checkbox", { name: "Torso sichtbar", exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Torso sperren", exact: true })).toBeChecked();
  await page.getByRole("button", { name: "Kopf auswählen", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue(
    "10.25",
  );
  expect(await page.evaluate(() => Reflect.get(window, "p41Sprite").scene)).toEqual(expected);
  // Same ordering action through real browser drag-and-drop, then keyboard undo.
  const headRow = layers
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Kopf auswählen", exact: true }) });
  const torsoRow = layers
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Torso auswählen", exact: true }) });
  await headRow.dragTo(torsoRow);
  await expect(layers.getByRole("button").first()).toHaveAccessibleName("Kopf auswählen");
  await page.getByRole("button", { name: "Szene rückgängig", exact: true }).click();
  await expect(layers.getByRole("button").first()).toHaveAccessibleName("Torso auswählen");
  await page
    .getByRole("button", { name: "Originalanordnung wiederherstellen", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Originalanordnung jetzt wiederherstellen", exact: true })
    .click();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue("4");
  await page.getByRole("button", { name: "Szene rückgängig", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue(
    "10.25",
  );
  await page.screenshot({ path: testInfo.outputPath("p42-scene-restored.png") });
});

test("P42 pointer moves are source-pixel/DPR independent, resize cancels and invalid fields block switches", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();
  try {
    await openSprite(page);
    const canvas = page.getByRole("img", { name: "Sprite-Zusammenstellung im Quellpixelraum" });
    await canvas.scrollIntoViewIfNeeded();
    let box = (await canvas.boundingBox())!;
    let scale = Math.min((box.width - 24) / 20, (box.height - 12 * 2) / 12);
    const point = () => ({
      x: box.x + (box.width - 20 * scale) / 2 + 4.5 * scale,
      y: box.y + (box.height - 12 * scale) / 2 + 3.5 * scale,
    });
    await page.mouse.move(point().x, point().y);
    await page.mouse.down();
    await page.mouse.move(point().x + 2 * scale, point().y + scale, { steps: 5 });
    await page.mouse.up();
    await saved(page);
    expect(await headPosition(page)).toEqual({ x: 6, y: 5 });
    await canvas.focus();
    await canvas.press("ArrowRight");
    await saved(page);
    expect(await headPosition(page)).toEqual({ x: 7, y: 5 });
    await canvas.press("Control+z");
    await saved(page);
    expect(await headPosition(page)).toEqual({ x: 6, y: 5 });
    await page
      .getByRole("button", { name: "Originalanordnung wiederherstellen", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Originalanordnung jetzt wiederherstellen", exact: true })
      .click();
    await saved(page);
    await canvas.scrollIntoViewIfNeeded();
    box = (await canvas.boundingBox())!;
    scale = Math.min((box.width - 24) / 20, (box.height - 24) / 12);
    await page.mouse.move(point().x, point().y);
    await page.mouse.down();
    await page.mouse.move(point().x + 3 * scale, point().y + scale);
    await page.setViewportSize({ width: 480, height: 360 });
    await page.mouse.up();
    await expect.poll(() => headPosition(page)).toEqual({ x: 4, y: 4 });
    const x = page.getByRole("spinbutton", { name: "Position X", exact: true });
    await x.fill("");
    await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
    await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toBeVisible();
    await page
      .getByRole("button", { name: "Eingabe Position X zurücksetzen", exact: true })
      .click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath("p42-scene-480x360.png") });
  } finally {
    await context.close();
  }
});

test("P42 save conflicts preserve local work and a replaced manifest requires explicit reconciliation", async ({
  page,
}, testInfo) => {
  await openSprite(page);
  await page.evaluate(() => Reflect.set(window, "p42SaveConflict", true));
  await page.getByRole("spinbutton", { name: "Position X", exact: true }).fill("42");
  await page.getByRole("spinbutton", { name: "Position X", exact: true }).press("Tab");
  await expect(page.getByRole("alert").filter({ hasText: "write_conflict" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue("42");
  await page.evaluate(() => {
    const next = Reflect.get(window, "p41Sprite");
    next.documentSha256 = "f".repeat(64);
    next.manifest.generationId = "generation-next";
    next.scene.generationId = "generation-next";
    next.manifest.parts[0].sourceRect.x += 2;
    next.manifest.parts[0].defaultPosition.x += 2;
    next.manifest.parts = next.manifest.parts.filter(
      (part: { partId: string }) => part.partId !== "torso",
    );
    next.manifest.omittedParts = [{ partId: "torso", reason: "nicht mehr vorhanden" }];
    next.manifest.complete = false;
    next.assets = next.assets.filter((part: { partId: string }) => part.partId !== "torso");
    next.scene.layers = next.scene.layers.filter(
      (part: { partId: string }) => part.partId !== "torso",
    );
    Reflect.set(window, "p42SaveConflict", false);
  });
  await page.getByRole("button", { name: "Teile erneut prüfen" }).click();
  const comparison = page.getByRole("region", { name: "Teilegeneration abgleichen" });
  await expect(comparison).toContainText("Entfernt: Torso");
  await expect(comparison).toContainText("Geometrie prüfen: Kopf");
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue("42");
  await page.screenshot({ path: testInfo.outputPath("p42-generation-review.png") });
  await page.getByRole("button", { name: "Abgleich bestätigen und speichern" }).click();
  await expect(comparison).not.toBeVisible();
  await expect.poll(() => headPosition(page)).toEqual({ x: 42, y: 4 });
  expect(
    await page.evaluate(() =>
      Reflect.get(window, "p41Sprite").scene.layers.some(
        (part: { partId: string }) => part.partId === "torso",
      ),
    ),
  ).toBe(false);
  await expect(page.getByRole("spinbutton", { name: "Pivot X", exact: true })).toHaveValue("-2");
});
