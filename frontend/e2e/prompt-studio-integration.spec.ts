import { expect, test, type Page } from "@playwright/test";
import { createWorkspaceTransfer } from "../src/prompt-studio/features/settings/workspaceTransferData";
import { createDefaultAppSettings } from "../src/prompt-studio/store/settings/settingsState";
import { createProfileLibraryFixture } from "../src/prompt-studio/test/profileLibraryFixtures";

const exportedAt = "2026-09-06T12:00:00.000Z";

function createLegacyWorkspaceJson(): string {
  const library = createProfileLibraryFixture();
  const settings = {
    ...createDefaultAppSettings(exportedAt),
    theme: "dark" as const,
    activeBaseProfileId: library.baseProfiles[0]?.id ?? null,
  };

  return createWorkspaceTransfer({
    library,
    settings,
    draft: null,
    exportedAt,
    bundleId: "workspace_playwright_acceptance",
  }).contents;
}

async function installTauriHarness(page: Page, mode: "read_only" | "read_write"): Promise<void> {
  await page.addInitScript(
    ({ vaultMode, workspaceJson }) => {
      const calls: Array<{ command: string; args: Record<string, unknown> }> = [];
      const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
      const projectId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const areaId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
      const profileId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
      const timestamp = "2026-09-06T12:00:00.000Z";
      const project = {
        id: projectId,
        revision: 1,
        name: "Handoff Project",
        status: "active",
        labels: [],
        workspace_label_ids: [],
        created_at: timestamp,
        updated_at: timestamp,
      };
      const area = {
        id: areaId,
        revision: 1,
        project_id: projectId,
        name: "Handoff Area",
        object_type: "humanoid",
        profile_ref: { id: profileId, revision: 1 },
        reference_height_px: 80,
        direction_model: "eight_way",
        default_frame_size_px: [128, 128],
        default_ground_origin_px: [64, 108],
        label_ids: [],
        created_at: timestamp,
        updated_at: timestamp,
      };

      Object.assign(globalThis, {
        isTauri: true,
        __P27_TAURI_CALLS__: calls,
        __TAURI_INTERNALS__: {
          invoke: async (command: string, args: Record<string, unknown> = {}) => {
            calls.push({ command, args });
            if (command === "read_prompt_workspace") {
              return { settings: null, profiles: null, draft: null, migrationBackup: null };
            }
            if (
              command === "write_prompt_workspace" ||
              command === "remove_prompt_draft" ||
              command === "save_prompt_output" ||
              command === "heartbeat_vault" ||
              command === "close_vault"
            ) {
              return undefined;
            }
            if (command === "plugin:dialog|open") {
              const options = args.options as { title?: string } | undefined;
              return options?.title?.includes("PixelForge")
                ? "/virtual/pixelforge-workspace-v2.json"
                : "/virtual/handoff-vault";
            }
            if (command === "plugin:dialog|save") return "/virtual/prompt-output.json";
            if (command === "read_prompt_package") return workspaceJson;
            if (command === "recent_vaults") return [];
            if (command === "inspect_vault") {
              return {
                state: "valid",
                path: "/virtual/handoff-vault",
                vault_id: "handoff-vault",
                writer_present: false,
                lock_recovery: null,
              };
            }
            if (command === "open_vault") {
              return {
                session_id: sessionId,
                vault_id: "handoff-vault",
                path: "/virtual/handoff-vault",
                mode: vaultMode,
                indexed_objects: 2,
                notice: null,
                recovery: [],
                recovery_writable: vaultMode === "read_write",
                lock_recovery: null,
              };
            }
            if (command === "list_active_asset_import_jobs") return [];
            if (command === "get_project_dashboard") {
              return {
                projects: [project],
                labels: [],
                writable: vaultMode === "read_write",
                view: {
                  schema_version: 1,
                  kind: "project_view",
                  revision: 1,
                  search: "",
                  label_ids: [],
                  label_match: "any",
                  status: "any",
                  sort: "updated_desc",
                  updated_at: timestamp,
                },
              };
            }
            if (command === "preview_humanoid_profile") {
              return {
                preset_version: 1,
                reference_height_px: 80,
                measured_height_px: 80,
                suggested_frame_size_px: [128, 128],
                suggested_ground_origin_px: [64, 108],
                slots: [],
                views: [],
                mirror_pairs: [],
                direction_previews: [{ direction: "s", slots: [] }],
              };
            }
            if (command === "get_area_dashboard") {
              return {
                project_id: projectId,
                areas: [area],
                labels: [],
                writable: vaultMode === "read_write",
              };
            }
            if (command === "get_motion_dashboard") {
              return {
                area_id: areaId,
                motions: [],
                profiles: [{ id: profileId, revision: 1 }],
                labels: [],
                writable: vaultMode === "read_write",
              };
            }
            if (command === "handoff_prompt_to_area") {
              return {
                relative_path: "projects/handoff/prompt-references/prompt--accepted.json",
              };
            }
            throw new Error(`Unexpected Tauri command in P27 harness: ${command}`);
          },
        },
      });
    },
    { vaultMode: mode, workspaceJson: createLegacyWorkspaceJson() },
  );
}

async function openHandoffArea(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Choose vault/ }).click();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
  await page.locator(".project-card-open").filter({ hasText: "Handoff Project" }).click();
  await expect(page.getByRole("heading", { name: "Areas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Handoff Area" })).toBeVisible();
  await page.getByRole("button", { name: "Open animations" }).click();
  await expect(page.getByRole("heading", { name: "Animations" })).toBeVisible();
}

async function prepareNativePromptOutput(page: Page): Promise<void> {
  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();
  await page.getByRole("button", { name: "V2-JSON über nativen Dialog auswählen" }).click();
  await expect(page.getByText("Importdatei vollständig validiert")).toBeVisible();
  await page.getByRole("button", { name: "Geprüften Workspace importieren" }).click();
  await expect(page.getByText(/11 Profil\(e\) importiert/)).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page
    .getByRole("button", { name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden" })
    .click();

  const expectedSteps = [
    "Bildart",
    "Basisprofil",
    "Figur und Rolle",
    "Richtungen",
    "Bewegung und Animation",
  ] as const;
  for (const [index, step] of expectedSteps.entries()) {
    await expect(page.getByRole("heading", { level: 2, name: step })).toBeVisible();
    await page
      .getByRole("button", {
        name: index === expectedSteps.length - 1 ? /Entwurf sichern|Schritt prüfen/ : /Weiter/,
      })
      .click();
  }
  await expect(page.getByRole("button", { name: "Entwurf gesichert" })).toBeDisabled();
  await page.getByRole("button", { name: "Ausgabe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prompt-Paket", exact: true })).toBeVisible();
}

test("shared header is equal-sized, keyboard-operable, and visually scoped", async ({ page }) => {
  await page.goto("/");

  const outerStylesBefore = await page.locator("body").evaluate((body) => ({
    background: getComputedStyle(body).backgroundColor,
    minWidth: getComputedStyle(body).minWidth,
    overflow: getComputedStyle(body).overflow,
  }));

  const cutout = page.getByRole("button", {
    name: "PixelCutoutSprite Studio öffnen",
  });
  const prompt = page.getByRole("button", {
    name: "PixelPromptStudio Generator öffnen",
  });
  await expect(cutout).toHaveAttribute("aria-pressed", "true");
  await expect(prompt).toHaveAttribute("aria-pressed", "false");

  const cutoutBox = await cutout.boundingBox();
  const promptBox = await prompt.boundingBox();
  expect(cutoutBox).not.toBeNull();
  expect(promptBox).not.toBeNull();
  expect(cutoutBox?.width).toBe(196);
  expect(cutoutBox?.height).toBe(46);
  expect(promptBox?.width).toBe(cutoutBox?.width);
  expect(promptBox?.height).toBe(cutoutBox?.height);

  await prompt.focus();
  await expect(prompt).toBeFocused();
  expect(await prompt.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe(
    "none",
  );
  await page.keyboard.press("Enter");

  await expect(prompt).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "PixelPromptStudio Generator" })).toBeVisible();
  await expect(page.locator("header.app-header")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Studio sections" })).toBeHidden();
  await expect(page.getByText("LOCAL DESKTOP", { exact: true })).toBeVisible();
  expect(await prompt.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(145, 232, 117)",
  );

  const promptWorkspace = page.locator(".prompt-workspace");
  const contentFrame = page.locator(".content-frame");
  const promptWorkspaceBox = await promptWorkspace.boundingBox();
  const contentFrameBox = await contentFrame.boundingBox();
  expect(promptWorkspaceBox?.x).toBe(contentFrameBox?.x);
  expect(promptWorkspaceBox?.width).toBe(contentFrameBox?.width);
  await expect(page.locator(".prompt-generator-scroll")).toHaveCSS("overflow-y", "auto");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  await expect(page.locator("body")).not.toHaveAttribute("data-theme");
  expect(
    await page
      .locator(".prompt-generator-root")
      .evaluate((root) => root.scrollWidth <= root.clientWidth),
  ).toBe(true);

  await cutout.focus();
  await page.keyboard.press("Space");
  await expect(cutout).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("navigation", { name: "Studio sections" })).toBeVisible();
  expect(
    await page.locator("body").evaluate((body) => ({
      background: getComputedStyle(body).backgroundColor,
      minWidth: getComputedStyle(body).minWidth,
      overflow: getComputedStyle(body).overflow,
    })),
  ).toEqual(outerStylesBefore);
});

test("both navigation contexts survive repeated studio switches", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Areas" }).click();
  await expect(page.getByRole("heading", { name: "Areas" })).toBeVisible();

  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Produktionsprofile sicher organisieren." }),
  ).toBeVisible();

  await page.getByRole("button", { name: "PixelCutoutSprite Studio öffnen" }).click();
  await expect(page.getByRole("heading", { name: "Areas" })).toBeVisible();

  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  await expect(
    page.getByRole("heading", { name: "Produktionsprofile sicher organisieren." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ausgabe", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Prompt-Pakete produktionsbereit ausgeben." }),
  ).toBeVisible();
});

test("imports a PixelForge workspace and completes the persisted prompt workflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  await page.getByRole("button", { name: "Einstellungen", exact: true }).click();

  await page.getByLabel("PixelForge-V2-JSON auswählen").setInputFiles({
    name: "pixelforge-workspace-v2.json",
    mimeType: "application/json",
    buffer: Buffer.from(createLegacyWorkspaceJson()),
  });
  await expect(page.getByText("Importdatei vollständig validiert")).toBeVisible();
  await page.getByRole("button", { name: "Geprüften Workspace importieren" }).click();
  await expect(page.getByText(/11 Profil\(e\) importiert/)).toBeVisible();
  await expect(page.getByRole("radio", { name: "Dunkel" })).toBeChecked();
  await expect(page.locator(".prompt-generator-root")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByText("Dorfschmied mit Lederschürze", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Profil „Dorfschmied mit Lederschürze“ duplizieren" })
    .click();
  await expect(
    page.getByText("Dorfschmied mit Lederschürze (Kopie)", { exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden" })
    .click();

  const expectedSteps = [
    "Bildart",
    "Basisprofil",
    "Figur und Rolle",
    "Richtungen",
    "Bewegung und Animation",
  ] as const;
  for (const [index, step] of expectedSteps.entries()) {
    await expect(page.getByRole("heading", { level: 2, name: step })).toBeVisible();
    const submit = page.getByRole("button", {
      name: index === expectedSteps.length - 1 ? /Entwurf sichern|Schritt prüfen/ : /Weiter/,
    });
    await submit.click();
  }
  await expect(page.getByRole("button", { name: "Entwurf gesichert" })).toBeDisabled();

  await page.getByRole("button", { name: "Ausgabe", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Prompt-Paket", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kopieren" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "In PixelCutoutSprite übernehmen" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "In PixelCutoutSprite übernehmen" }),
  ).toHaveAttribute("title", /Area|Vault/);

  const markdownDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "MD exportieren" }).click();
  expect((await markdownDownload).suggestedFilename()).toMatch(/\.md$/);

  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON exportieren" }).click();
  expect((await jsonDownload).suggestedFilename()).toMatch(/\.json$/);

  await page.reload();
  await page.getByRole("button", { name: "PixelPromptStudio Generator öffnen" }).click();
  await expect(page.getByText("Entwurf fortsetzen →", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(
    page.getByText("Dorfschmied mit Lederschürze (Kopie)", { exact: true }),
  ).toBeVisible();
});

test("hands a prompt to a writable Area and returns to the retained Cutout context", async ({
  page,
}) => {
  await installTauriHarness(page, "read_write");
  await page.goto("/");
  await openHandoffArea(page);
  await prepareNativePromptOutput(page);

  const handoff = page.getByRole("button", { name: "In PixelCutoutSprite übernehmen" });
  await expect(handoff).toBeEnabled();
  await handoff.click();

  await expect(page.getByRole("heading", { name: "Animations" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toContainText(
    "Prompt reference saved · projects/handoff/prompt-references/prompt--accepted.json",
  );
  const handoffCalls = await page.evaluate(() => {
    const calls = Reflect.get(globalThis, "__P27_TAURI_CALLS__") as Array<{
      command: string;
      args: Record<string, unknown>;
    }>;
    return calls.filter((call) => call.command === "handoff_prompt_to_area");
  });
  expect(handoffCalls).toHaveLength(1);
  expect(handoffCalls[0]?.args).toMatchObject({
    sessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    areaId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    handoff: {
      schemaVersion: 1,
      category: "character",
    },
  });
});

test("keeps handoff blocked for a read-only Vault without invoking Rust", async ({ page }) => {
  await installTauriHarness(page, "read_only");
  await page.goto("/");
  await openHandoffArea(page);
  await prepareNativePromptOutput(page);

  const handoff = page.getByRole("button", { name: "In PixelCutoutSprite übernehmen" });
  await expect(handoff).toBeDisabled();
  await expect(handoff).toHaveAttribute("title", "Der geöffnete Vault ist schreibgeschützt.");
  const handoffCount = await page.evaluate(() => {
    const calls = Reflect.get(globalThis, "__P27_TAURI_CALLS__") as Array<{ command: string }>;
    return calls.filter((call) => call.command === "handoff_prompt_to_area").length;
  });
  expect(handoffCount).toBe(0);
});
