import { expect, test } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";

test("P39 local assistance stays responsive, preserves protected corrections and autosaves across restart", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await vaultFixture(page);
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  const numeric = page.getByRole("group", {
    name: "Rechteck über Quellpixelkoordinaten markieren",
  });
  await numeric.getByRole("spinbutton", { name: "Breite" }).fill("16");
  await numeric.getByRole("spinbutton", { name: "Höhe" }).fill("24");
  await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
  await page.getByRole("spinbutton", { name: "Farbtoleranz" }).fill("70");
  await page.getByRole("button", { name: "Auswahl verfeinern" }).click();
  await expect(
    page.getByRole("progressbar", { name: "Fortschritt der lokalen Auswahlhilfe" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Vergrößern", exact: true }).click();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "383 markierte Quellpixel",
  );
  await expect(page.getByRole("region", { name: "Lokale Auswahlhilfe" })).toContainText(
    "Transparente Außenkontur entfernt",
  );
  await page.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(page.getByRole("region", { name: "Aktiver Körperteil" })).toContainText(
    "384 markierte Quellpixel",
  );
  await page.getByRole("button", { name: "Wiederholen", exact: true }).click();
  await page.getByRole("button", { name: "Einpassen", exact: true }).click();
  await page.getByRole("button", { name: "Überlappung schützen", exact: true }).click();
  const canvas = page.getByRole("img", { name: "Maskeneditor im Quellpixelraum" });
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Auswahl bestätigen" }).click();
  await page.getByRole("button", { name: "PixelSpriteStudio öffnen" }).click();
  await page.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Kopf · bestätigt" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Farbtoleranz" })).toHaveValue("70");
  const saved = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("p38-cutout-fixture")!),
  );
  expect(saved.masks.head.protected.length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Auswahl verfeinern" }).click();
  await page.getByRole("button", { name: "Auswahlhilfe abbrechen" }).click();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Kopf · bestätigt" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("p39-cancel-protected-overlap.png") });
  await page.reload();
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await expect(page.getByRole("heading", { name: "Kopf · bestätigt" })).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "Farbtoleranz" })).toHaveValue("70");
  expect(errors).toEqual([]);
});
