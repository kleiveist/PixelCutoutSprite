import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_GLOBAL_SETTINGS } from "../src/shared/settings/globalSettingsClient";

/** Real browser/production router with explicit IPC fixtures, not a native filesystem gate. */
async function vaultFixture(page: Page) {
  await page.addInitScript(
    ({ settings }) => {
      type Item = {
        name: string;
        relativePath: string;
        kind: "directory" | "image" | "unsupported";
        technical: boolean;
        setCandidate: boolean;
        fingerprint: string;
      };
      const item = (path: string, kind: Item["kind"] = "image", setCandidate = false): Item => ({
        name: path.split("/").at(-1)!,
        relativePath: path,
        kind,
        technical: false,
        setCandidate,
        fingerprint: "a".repeat(64),
      });
      const folders: Record<string, Item[]> = {
        "": [
          item("Images", "directory"),
          item("Parts", "directory", true),
          item("unknown.exe", "unsupported"),
        ],
        Images: [item("Images/hero.png")],
        Parts: [],
      };
      let callback = 0;
      Object.assign(window, {
        isTauri: true,
        p36Folders: folders,
        __TAURI_INTERNALS__: {
          metadata: {
            currentWindow: { label: "main" },
            currentWebview: { windowLabel: "main", label: "main" },
          },
          transformCallback: () => ++callback,
          unregisterCallback: () => undefined,
          invoke: async (
            command: string,
            args: {
              query?: {
                relativePath: string;
                search: string;
                filter: string;
                cursor: string | null;
                limit: number;
              };
              relativePath?: string;
            },
          ) => {
            switch (command) {
              case "get_global_settings":
                return settings;
              case "recent_vaults":
                return ["/test/P36"];
              case "inspect_vault":
                return {
                  state: "valid",
                  path: "/test/P36",
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  writer_present: false,
                  lock_recovery: null,
                };
              case "open_vault":
                return {
                  session_id: "11111111-1111-4111-8111-111111111111",
                  session_generation: 1,
                  vault_id: "22222222-2222-4222-8222-222222222222",
                  path: "/test/P36",
                  mode: "read_write",
                  indexed_objects: 0,
                  recovery: [],
                  recovery_writable: false,
                  lock_recovery: null,
                };
              case "scan_prompt_vault":
                return { baseProfile: null, profiles: [], drafts: [], issues: [] };
              case "get_project_dashboard":
                return {
                  projects: [],
                  labels: [],
                  writable: true,
                  view: {
                    schema_version: 1,
                    kind: "project_view",
                    revision: 1,
                    updated_at: "2026-09-10T12:00:00Z",
                    search: "",
                    label_ids: [],
                    label_match: "any",
                    status: "any",
                    sort: "updated_desc",
                  },
                };
              case "list_workspace_entries": {
                const query = args.query!;
                const entries = (folders[query.relativePath] ?? []).filter(
                  (entry) =>
                    entry.name.toLowerCase().includes(query.search.toLowerCase()) &&
                    (query.filter !== "folders" || entry.kind === "directory") &&
                    (query.filter !== "images" || entry.kind !== "unsupported"),
                );
                const offset = Number(query.cursor ?? 0);
                return {
                  relativePath: query.relativePath,
                  entries: entries.slice(offset, offset + query.limit),
                  nextCursor:
                    offset + query.limit < entries.length ? String(offset + query.limit) : null,
                  totalMatches: entries.length,
                  skippedEntries: 0,
                };
              }
              case "inspect_workspace_entry":
                if (args.relativePath === "Parts")
                  return {
                    kind: "sprite_set",
                    relativePath: "Parts",
                    manifestPath: "Parts/sprite.parts.json",
                    manifestSha256: "b".repeat(64),
                    setId: "set_example",
                    generationId: "generation_example",
                    complete: true,
                    partCount: 15,
                  };
                if (args.relativePath === "Images")
                  return {
                    kind: "directory",
                    relativePath: "Images",
                    status: "ordinary",
                    message: null,
                  };
                return {
                  kind: "image",
                  relativePath: args.relativePath,
                  sha256: "b".repeat(64),
                  width: 16,
                  height: 24,
                };
              case "read_workspace_thumbnail":
                return {
                  dataUrl:
                    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
                  sha256: "b".repeat(64),
                };
              case "plugin:event|listen":
                return 1;
              case "plugin:event|unlisten":
              case "heartbeat_vault":
              case "close_vault":
                return null;
              default:
                throw new Error("Unexpected P36 browser fixture command: " + command);
            }
          },
        },
        __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => undefined },
      });
    },
    { settings: DEFAULT_GLOBAL_SETTINGS },
  );
  await page.goto("/");
  await page.getByRole("button", { name: "/test/P36", exact: true }).click();
}

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
  await expect(page.getByRole("region", { name: "Geprüfte Dateiauswahl" })).toContainText(
    "Images/hero.png",
  );
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
  await expect(page.getByRole("region", { name: "Geprüfte Dateiauswahl" })).toContainText(
    "Images/hero.png",
  );
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
