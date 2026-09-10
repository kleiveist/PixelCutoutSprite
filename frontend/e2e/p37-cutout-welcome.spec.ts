import { expect, test } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

test("P37 Welcome cannot reach retired Cutout functions or issue legacy RPCs", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await vaultFixture(page);
  await expect(page.getByRole("heading", { name: "Willkommen im Cutout-Studio" })).toBeVisible();
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await expect(page.getByRole("region", { name: "Cutout-Maskeneditor" })).toContainText("hero.png");
  for (const module of [
    "PixelPromptStudio Generator öffnen",
    "PixelSpriteStudio öffnen",
    "PixelCutoutSprite Studio öffnen",
  ]) {
    await page.getByRole("button", { name: module }).click();
    await expect(page.getByRole("button", { name: module })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("[data-module-navigation]")).toHaveCount(1);
    await expect(
      page.getByRole("button", {
        name: /^(Projects|Areas|Animations|Dummy Editor|Outfit|NPCs|Export|Inventory|An Cutout übergeben)$/i,
      }),
    ).toHaveCount(0);
  }
  for (const route of ["projects", "areas", "animations", "outfit", "npcs", "export"]) {
    await page.evaluate((route) => {
      history.pushState({ route }, "", "/?route=" + route + "#" + route);
      dispatchEvent(new PopStateEvent("popstate", { state: { route } }));
    }, route);
    await expect(page.getByRole("heading", { name: "hero.png" })).toBeVisible();
  }
  const calls: string[] = await page.evaluate(() => Reflect.get(window, "p37Calls"));
  expect(calls).toContain("open_vault");
  expect(calls).toContain("inspect_workspace_entry");
  expect(
    calls.filter(
      (command) =>
        /project|area|motion|npc|outfit|export|handoff|example/.test(command) &&
        command !== "save_cutout_project",
    ),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test("P37 Welcome fits required sizes and the 200% zoom-equivalent CSS viewport", async ({
  page,
  browser,
}, testInfo) => {
  await page.goto("/");
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [960, 540],
    [720, 450],
    [640, 480],
    [480, 360],
  ]) {
    await page.setViewportSize({ width: width!, height: height! });
    await expect(page.getByRole("button", { name: /Choose vault/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const instructions = page.getByRole("region", { name: "Ablauf zum Schneiden" });
    await instructions.scrollIntoViewIfNeeded();
    await expect(instructions).toBeVisible();
    await page
      .getByRole("heading", { name: "Willkommen im Cutout-Studio" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath("p37-welcome-" + width + "x" + height + ".png"),
    });
  }
  // 960×720 device pixels at 200% correspond to 480×360 CSS pixels. CSS `zoom`
  // alone does not change media-query/matchMedia breakpoints and is not browser zoom.
  // This is a layout equivalent, not native OS-DPI acceptance.
  const zoomContext = await browser.newContext({
    viewport: { width: 480, height: 360 },
    deviceScaleFactor: 2,
  });
  try {
    const zoomPage = await zoomContext.newPage();
    await zoomPage.goto("http://127.0.0.1:4173/");
    await zoomPage.getByRole("button", { name: /Choose vault/ }).scrollIntoViewIfNeeded();
    await expect(zoomPage.getByRole("button", { name: /Choose vault/ })).toBeInViewport();
    expect(await zoomPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await zoomPage.screenshot({
      path: testInfo.outputPath("p37-welcome-200-percent-equivalent.png"),
    });
  } finally {
    await zoomContext.close();
  }
});
