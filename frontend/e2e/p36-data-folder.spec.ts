import { expect, test } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

test("P36 shares docked navigation, selects files/sets and refreshes external changes", async ({
  page,
}, testInfo) => {
  await vaultFixture(page);
  await expect(
    page.locator("[data-data-folder-module='cutout'] [data-data-folder-toolbar]"),
  ).toHaveCount(1);
  const folder = page.getByRole("treeitem", { name: /^Images/ });
  await folder.click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await expect(page.getByRole("region", { name: "Cutout-Maskeneditor" })).toContainText("hero.png");
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await expect(
    page.locator("[data-data-folder-module='sprite'] [data-data-folder-toolbar]"),
  ).toHaveCount(1);
  await page.getByRole("treeitem", { name: /^Parts/ }).click();
  await expect(page.getByRole("region", { name: "Geprüfte Dateiauswahl" })).toContainText(
    "15 Teile",
  );
  await page.getByRole("tab", { name: "View", exact: true }).click();
  await expect(page.getByRole("region", { name: "Sprite-View" })).toContainText(
    "generation_example",
  );
  await page.getByRole("tab", { name: "Dateien", exact: true }).click();
  await expect(page.getByRole("region", { name: "Geprüfte Dateiauswahl" })).toContainText(
    "15 Teile",
  );
  await page.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }).click();
  await expect(page.getByRole("region", { name: "Cutout-Maskeneditor" })).toContainText("hero.png");
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("button", { name: "Diesen Ordner durchsuchen" }).click();
  await expect(page.getByRole("navigation", { name: "Vault-Dateipfad" })).toContainText("Images");
  await page.evaluate(() => {
    const folders = Reflect.get(window, "p36Folders");
    folders.Images = [
      { ...folders.Images[0], name: "renamed.png", relativePath: "Images/renamed.png" },
    ];
  });
  await page.getByRole("button", { name: "Dateien aktualisieren" }).click();
  await expect(page.getByRole("treeitem", { name: /renamed.png/ })).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /hero.png/ })).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath("p36-docked.png") });
});

test("P36 drawer is keyboard usable at 720x450 and 480x360 and returns focus", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 720, height: 450 });
  await vaultFixture(page);
  for (const size of [
    { width: 720, height: 450 },
    { width: 480, height: 360 },
  ]) {
    await page.setViewportSize(size);
    const trigger = page.getByRole("button", { name: "Dateien öffnen", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Vault-Dateien" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeInViewport();
    expect(
      await dialog.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return (
          box.left >= 0 &&
          box.top >= 0 &&
          box.right <= innerWidth + 1 &&
          box.bottom <= innerHeight + 1 &&
          element.scrollWidth <= element.clientWidth
        );
      }),
    ).toBe(true);
    const folder = dialog.getByRole("treeitem", { name: /^Images/ });
    await folder.focus();
    if ((await folder.getAttribute("aria-expanded")) !== "true") await folder.press("ArrowRight");
    await folder.press("ArrowRight");
    const png = dialog.getByRole("treeitem", { name: /hero.png/ });
    await expect(png).toBeFocused();
    await png.press("Enter");
    await expect(dialog.getByRole("status").filter({ hasText: /Bild geprüft/ })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Dateinavigation schließen" })).toBeInViewport({
      ratio: 1,
    });
    await page.screenshot({ path: testInfo.outputPath(`p36-drawer-${size.width}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("region", { name: "Geprüfte Dateiauswahl" })).toContainText(
      "hero.png",
    );
  }
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  const trigger = page.getByRole("button", { name: "Dateien / View öffnen", exact: true });
  await trigger.click();
  await page.getByRole("tab", { name: "View", exact: true }).click();
  await page.keyboard.press("Shift+Tab");
  await page.getByRole("button", { name: "Dateinavigation schließen" }).click();
  await expect(trigger).toBeFocused();
});
