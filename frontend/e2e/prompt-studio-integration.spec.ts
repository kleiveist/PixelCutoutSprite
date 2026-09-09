import { expect, test, type Page } from "@playwright/test";

const studioButtons = {
  cutout: "PixelCutoutSprite Studio öffnen",
  prompt: "PixelPromptStudio Generator öffnen",
  sprite: "PixelSpriteStudio öffnen",
} as const;

async function openStudio(page: Page, studio: keyof typeof studioButtons): Promise<void> {
  await page.getByRole("button", { name: studioButtons[studio] }).click();
  await expect(page.getByRole("button", { name: studioButtons[studio] })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(`[data-module-navigation="${studio}"]`)).toHaveCount(1);
  await expect(page.locator("[data-module-navigation]")).toHaveCount(1);
}

test("renders one shared shell and retains independent module navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("header.app-header")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Globale Einstellungen öffnen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open shortcut help" })).toBeVisible();
  await openStudio(page, "cutout");

  await page.getByRole("button", { name: "Areas" }).click();
  await expect(page.getByRole("heading", { name: "Areas" })).toBeVisible();

  await openStudio(page, "prompt");
  await expect(page.getByRole("region", { name: "PixelPromptStudio Generator" })).toBeVisible();
  await expect(page.locator("[data-module-navigation='prompt'] nav")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Kein Vault geöffnet" })).toBeVisible();

  await openStudio(page, "sprite");
  await expect(
    page.getByRole("heading", { name: "Sprites aus geprüften Teilen zusammensetzen." }),
  ).toBeVisible();
  await expect(page.getByText(/Noch nicht funktionsbereit/)).toBeVisible();

  await openStudio(page, "cutout");
  await expect(page.getByRole("heading", { name: "Areas" })).toBeVisible();
  await openStudio(page, "prompt");
  await expect(page.getByRole("heading", { name: "Kein Vault geöffnet" })).toBeVisible();
});

test("global settings commit once and apply to all three modules", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Globale Einstellungen öffnen" });
  const initialTheme = await page.locator("html").getAttribute("data-theme");
  expect(["light", "dark"]).toContain(initialTheme);
  const savedTheme = initialTheme === "light" ? "dark" : "light";

  await opener.click();
  let dialog = page.getByRole("dialog", { name: "Globale Einstellungen" });
  await dialog.getByRole("combobox", { name: "Theme" }).selectOption(savedTheme);
  await dialog.getByRole("combobox", { name: "Dichte" }).selectOption("compact");
  await dialog.getByRole("combobox", { name: "Sprache der Oberfläche" }).selectOption("en");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", initialTheme!);

  await opener.click();
  dialog = page.getByRole("dialog", { name: "Globale Einstellungen" });
  await expect(dialog.getByRole("combobox", { name: "Theme" })).toHaveValue(savedTheme);
  await dialog.getByRole("button", { name: "Speichern" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", savedTheme);
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  for (const studio of ["cutout", "prompt", "sprite"] as const) {
    await openStudio(page, studio);
    await expect(page.locator("html")).toHaveAttribute("data-theme", savedTheme);
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
  }
});

for (const viewport of [
  { width: 720, height: 450 },
  { width: 480, height: 360 },
] as const) {
  test(`keeps shell and modal controls reachable at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    for (const studio of ["cutout", "prompt", "sprite"] as const) {
      await openStudio(page, studio);
      const geometry = await page.evaluate(() => {
        const header = document.querySelector<HTMLElement>(".app-header");
        const row = document.querySelector<HTMLElement>("[data-module-navigation]");
        const headerBox = header?.getBoundingClientRect();
        const rowBox = row?.getBoundingClientRect();
        return {
          documentFits: document.documentElement.scrollWidth <= window.innerWidth,
          headerFits:
            !!headerBox && headerBox.left >= 0 && headerBox.right <= window.innerWidth + 0.5,
          rowFits: !!rowBox && rowBox.left >= 0 && rowBox.right <= window.innerWidth + 0.5,
        };
      });
      expect(geometry).toEqual({ documentFits: true, headerFits: true, rowFits: true });
    }

    const opener = page.getByRole("button", { name: "Globale Einstellungen öffnen" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Globale Einstellungen" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Speichern" }).scrollIntoViewIfNeeded();
    await expect(dialog.getByRole("button", { name: "Speichern" })).toBeVisible();

    const panelFits = await dialog.evaluate((panel) => {
      const box = panel.getBoundingClientRect();
      return (
        box.left >= 0 &&
        box.top >= 0 &&
        box.right <= window.innerWidth + 0.5 &&
        box.bottom <= window.innerHeight + 0.5 &&
        panel.scrollHeight >= panel.clientHeight
      );
    });
    expect(panelFits).toBe(true);

    const backdrop = page.locator("[data-modal-backdrop]");
    await backdrop.click({ position: { x: 2, y: 2 } });
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });
}
