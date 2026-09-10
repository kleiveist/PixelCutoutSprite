import { expect, test } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";
import { PARTS, PART_GROUPS } from "../src/shared/image/parts";

test("P43 integrated cutout generation opens the same masks as a persistent sprite scene", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await vaultFixture(page, true);
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  const numeric = page.getByRole("group", {
    name: "Rechteck über Quellpixelkoordinaten markieren",
  });
  for (const part of PARTS.filter((part) => part.required)) {
    const group = PART_GROUPS.find((group) => group.id === part.group)!;
    await page.getByRole("button", { name: new RegExp(`^${group.label},`) }).click();
    await page
      .getByRole("dialog", { name: `${group.label}: Teil auswählen` })
      .getByRole("button", { name: new RegExp(part.label) })
      .click();
    await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
      part.label,
    );
    if (["head", "torso"].includes(part.partId)) {
      const coords = part.partId === "head" ? [2, 3, 5, 7] : [4, 7, 6, 8];
      for (const [i, name] of ["X", "Y", "Breite", "Höhe"].entries())
        await numeric.getByRole("spinbutton", { name, exact: true }).fill(String(coords[i]));
      await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
      await page.getByRole("button", { name: "Auswahl bestätigen" }).click();
    } else {
      await page.getByLabel("Begründung für „nicht vorhanden“").fill("Synthetisches Zweiteilebild");
      await page.getByRole("button", { name: "Als nicht vorhanden markieren" }).click();
      await expect(
        page.getByRole("heading", { name: `${part.label} · nicht vorhanden`, exact: true }),
      ).toBeVisible();
    }
  }
  await page.getByRole("button", { name: "Ausgabe prüfen" }).click();
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("p38-cutout-fixture")!),
  );
  expect(stored.masks.head.confirmed).toHaveLength(7);
  await page.getByRole("button", { name: "PNG-Teile jetzt erzeugen" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "2 PNG-Teile erfolgreich geprüft" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /^hero Teile-Set/ }).click();
  await expect(page.getByRole("region", { name: "Sprite-Kompositionseditor" })).toBeVisible();
  const loaded = await page.evaluate(() => Reflect.get(window, "p41Sprite"));
  expect(loaded.manifest.setId).toBe(stored.project.id);
  expect(loaded.assets).toHaveLength(2);
  expect(loaded.manifest.parts[0].sourceRect).toEqual({ x: 2, y: 3, width: 5, height: 7 });
  expect(loaded.scene.layers[0].position).toEqual({ x: 4.5, y: 6.5 });
  await page.getByRole("tab", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Kopf auswählen", exact: true }).click();
  await page.getByRole("spinbutton", { name: "Position X", exact: true }).fill("42");
  await page.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }).click();
  await expect(page.getByRole("region", { name: "Cutout-Maskeneditor" })).toBeVisible();
  const scene = await page.evaluate(() => Reflect.get(window, "p41Sprite").scene);
  expect(scene.layers[0].position.x).toBe(42);
  await page.reload();
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /^hero Teile-Set/ }).click();
  await page.getByRole("tab", { name: "View", exact: true }).click();
  await page.getByRole("button", { name: "Kopf auswählen", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Position X", exact: true })).toHaveValue("42");
  expect(await page.evaluate(() => Reflect.get(window, "p41Sprite").scene)).toEqual(scene);
  await page.screenshot({ path: testInfo.outputPath("p43-integrated-scene.png") });
});

test("P43 sprite View and settings remain keyboard accessible across the complete size matrix", async ({
  page,
  browser,
}, testInfo) => {
  await vaultFixture(page);
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("treeitem", { name: /^Parts/ }).click();
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [960, 540],
    [720, 450],
    [640, 480],
    [480, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    const drawer = page.getByRole("button", { name: "Dateien / View öffnen" });
    if (width! < 800) await drawer.click();
    await page.getByRole("tab", { name: "View", exact: true }).click();
    const head = page.getByRole("button", { name: "Kopf auswählen", exact: true });
    await head.focus();
    await head.press("Enter");
    await expect(page.getByRole("checkbox", { name: "Kopf sichtbar", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    const settings = page.getByRole("button", { name: "Globale Einstellungen öffnen" });
    await settings.focus();
    await settings.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Globale Einstellungen", exact: true });
    await expect(dialog).toBeInViewport();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press(i < 4 ? "Tab" : "Shift+Tab");
      expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(settings).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`p43-view-${width}.png`) });
  }
  // 960x720 device pixels at 200% = 480x360 CSS pixels. CSS `zoom` alone does
  // not re-evaluate matchMedia and is not browser zoom. Native hotkeys have a
  // separate real-WebKit acceptance probe.
  const zoomContext = await browser.newContext({
    viewport: { width: 480, height: 360 },
    deviceScaleFactor: 2,
    baseURL: "http://127.0.0.1:4173",
  });
  try {
    const zoomPage = await zoomContext.newPage();
    await vaultFixture(zoomPage);
    await zoomPage.getByRole("button", { name: "Globale Einstellungen öffnen" }).click();
    const dialog = zoomPage.getByRole("dialog", { name: "Globale Einstellungen", exact: true });
    await expect(dialog).toBeInViewport();
    expect(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await zoomPage.screenshot({
      path: testInfo.outputPath("p43-settings-200-percent-equivalent.png"),
    });
  } finally {
    await zoomContext.close();
  }
});
