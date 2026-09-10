import { expect, test } from "@playwright/test";
import { vaultFixture } from "./fixtures/vault";
import { PARTS, PART_GROUPS } from "../src/shared/image/parts";

test("P40 confirms all required parts, generates explicitly and reopens the canonical cutout", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await vaultFixture(page);
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await page.getByRole("button", { name: "Ausgabe prüfen" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Noch offen" })).toBeVisible();
  const numeric = page.getByRole("group", {
    name: "Rechteck über Quellpixelkoordinaten markieren",
  });
  await numeric.getByRole("spinbutton", { name: "X", exact: true }).fill("2");
  await numeric.getByRole("spinbutton", { name: "Y", exact: true }).fill("3");
  await numeric.getByRole("spinbutton", { name: "Breite" }).fill("5");
  await numeric.getByRole("spinbutton", { name: "Höhe" }).fill("7");
  for (const part of PARTS.filter((part) => part.required)) {
    const group = PART_GROUPS.find((group) => group.id === part.group)!;
    await page.getByRole("button", { name: new RegExp(`^${group.label},`) }).click();
    await page
      .getByRole("dialog", { name: `${group.label}: Teil auswählen` })
      .getByRole("button", { name: new RegExp(part.label) })
      .click();
    await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
    await page.getByRole("button", { name: "Auswahl bestätigen" }).click();
  }
  await page.getByRole("combobox", { name: "Zubehör-Variante" }).selectOption("sword");
  await page.getByRole("button", { name: /^Extras,/ }).click();
  await page
    .getByRole("dialog", { name: "Extras: Teil auswählen" })
    .getByRole("button", { name: /Schwert/ })
    .click();
  await numeric.getByRole("button", { name: "Rechteck markieren" }).click();
  await page.getByRole("button", { name: "Auswahl bestätigen" }).click();
  const output = page.getByRole("region", { name: "PNG-Teile erzeugen" });
  await expect(output).toContainText("15/15 Pflichtteile abgeschlossen");
  await output.getByRole("spinbutton", { name: "Transparentes Padding" }).fill("2");
  await page.getByRole("button", { name: "Ausgabe prüfen" }).click();
  await expect(page.getByRole("group", { name: "Ausgabe bestätigen" })).toContainText(
    "Images/hero",
  );
  const before = await page.evaluate(
    () =>
      (window as unknown as { p37Calls: string[] }).p37Calls.filter(
        (call) => call === "generate_cutout_parts",
      ).length,
  );
  expect(before).toBe(0);
  await page.getByRole("button", { name: "PNG-Teile jetzt erzeugen" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "16 PNG-Teile erfolgreich geprüft" }),
  ).toBeVisible();
  const stored = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("p38-cutout-fixture")!),
  );
  expect(stored.projectPath).toBe("Images/hero/cutout.project.json");
  expect(
    stored.project.parts.find((part: { partId: string }) => part.partId === "sword").status,
  ).toBe("confirmed");
  await page.screenshot({ path: testInfo.outputPath("p40-complete-generation.png") });
  await page.reload();
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
  await page.getByRole("treeitem", { name: /^Images/ }).click();
  await page.getByRole("treeitem", { name: /hero.png/ }).click();
  await expect(page.getByRole("heading", { name: "Schwert-Zubehör · bestätigt" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Zubehör-Variante" })).toHaveValue("sword");
  await page.getByRole("button", { name: "Ausgabe prüfen" }).click();
  await expect(page.getByRole("group", { name: "Ausgabe bestätigen" })).toContainText(
    "Eine vorhandene Szene bleibt erhalten",
  );
  expect(errors).toEqual([]);
});
