import { expect, test } from "@playwright/test";
import { createVaultPromptFixture } from "../src/prompt-studio/test/vaultPromptFixtures";
import { DEFAULT_GLOBAL_SETTINGS } from "../src/shared/settings/globalSettingsClient";

// Browser IPC fixture, not a native filesystem or Explorer acceptance test.
test("P35 category popup preserves answers, dismisses correctly and fits small windows", async ({
  page,
}) => {
  const index = createVaultPromptFixture();
  await page.addInitScript(
    ({ index, settings }) => {
      let callbackId = 0;
      Object.assign(window, {
        isTauri: true,
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { windowLabel: "main", label: "main" },
          },
          transformCallback: () => ++callbackId,
          unregisterCallback: () => undefined,
          invoke: async (command: string) => {
            switch (command) {
              case "get_global_settings":
                return settings;
              case "recent_vaults":
                return ["/test/P35"];
              case "inspect_vault":
                return {
                  state: "valid",
                  path: "/test/P35",
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  writer_present: false,
                  lock_recovery: null,
                };
              case "open_vault":
                return {
                  session_id: "11111111-1111-4111-8111-111111111111",
                  session_generation: 1,
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  path: "/test/P35",
                  mode: "read_write",
                  indexed_objects: 0,
                  recovery: [],
                  recovery_writable: false,
                  lock_recovery: null,
                };
              case "scan_prompt_vault":
                return index;
              case "get_project_dashboard":
                return {
                  projects: [],
                  labels: [],
                  writable: true,
                  view: {
                    schema_version: 1,
                    kind: "project_view",
                    revision: 1,
                    updated_at: "2026-09-10T12:00:00.000Z",
                    search: "",
                    label_ids: [],
                    label_match: "any",
                    status: "any",
                    sort: "updated_desc",
                  },
                };
              case "plugin:event|listen":
                return 1;
              case "plugin:event|unlisten":
              case "heartbeat_vault":
                return null;
              default:
                throw new Error("Unexpected browser fixture command: " + command);
            }
          },
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => undefined },
      });
    },
    { index, settings: DEFAULT_GLOBAL_SETTINGS },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "/test/P35", exact: true }).click();
  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  const card = page.getByRole("button", { name: "Charakter / Figur: 1 Profile" });
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Asset-Kategorien" }).getByRole("button"),
  ).toHaveCount(9);
  for (const viewport of [
    { width: 960, height: 540 },
    { width: 480, height: 360 },
  ]) {
    await page.setViewportSize(viewport);
    await card.click();
    const dialog = page.getByRole("dialog", { name: "Charakter / Figur – Profile" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("searchbox").fill("Kleif");
    await expect(dialog.getByRole("button", { name: "Kleif laden" })).toBeVisible();
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
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(card).toBeFocused();
  }
  await card.click();
  await page.getByRole("button", { name: "Dialog schließen" }).click();
  await expect(card).toBeFocused();
  await card.click();
  await page.locator("[data-modal-backdrop]").click({ position: { x: 2, y: 2 } });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card.click();
  await page.getByRole("button", { name: "Kleif laden" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: /Rolle \/ Beruf/ })).toHaveValue(
    "Waldhüter mit unvollständiger Beschreibung",
  );
  await expect(page.getByRole("textbox", { name: /Name des Assets/ })).toHaveValue("Kleif");
});
