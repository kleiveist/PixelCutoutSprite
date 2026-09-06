import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../test/PromptTestApp";
import { ASSET_CATEGORY_IDS } from "../../domain/assets";
import type { ProfileLibrary } from "../../schemas";
import { V2_STORAGE_KEYS, createV2StorageAdapter } from "../../services";
import { MemoryNavigation } from "../../test/memoryNavigation";
import { MemoryStorage } from "../../test/memoryStorage";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";

vi.mock("../wizard", async () => {
  const { useWizardSession } = await import("../../store/wizard");

  return {
    WizardView() {
      const { startIntent } = useWizardSession();

      return (
        <section>
          <h1 id="wizard-view-title">Neue Assets geführt aufsetzen.</h1>
          <output data-testid="wizard-start-intent">{JSON.stringify(startIntent)}</output>
        </section>
      );
    },
  };
});

const duplicateTimestamp = "2026-09-03T10:00:00.000Z";
const duplicateProfileId = "asset_smith_copy";

interface RenderStudioOptions {
  readonly storage?: MemoryStorage;
  readonly navigation?: MemoryNavigation;
  readonly now?: () => string;
  readonly createProfileId?: () => string;
}

function renderStudio(options: RenderStudioOptions = {}) {
  const storage = options.storage ?? new MemoryStorage();
  const navigation =
    options.navigation ?? new MemoryNavigation({ status: "valid", view: "profiles" });
  const adapter = createV2StorageAdapter(storage);
  const rendered = render(
    <App
      navigationAdapter={navigation}
      storageAdapter={adapter}
      {...(options.now ? { now: options.now } : {})}
      {...(options.createProfileId ? { createProfileId: options.createProfileId } : {})}
    />,
  );

  return { ...rendered, adapter, navigation, storage };
}

function populatedStorage(library: ProfileLibrary = createProfileLibraryFixture()): MemoryStorage {
  const storage = new MemoryStorage();
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  storage.mutations.splice(0);
  return storage;
}

function renderPopulated(options: Omit<RenderStudioOptions, "storage"> = {}) {
  return renderStudio({ ...options, storage: populatedStorage() });
}

function primaryNavigation(): HTMLElement {
  return screen.getByRole("navigation", { name: "Hauptnavigation" });
}

function profileArticle(name: string): HTMLElement {
  return screen.getByRole("article", { name });
}

function expectedProfileWrites() {
  return [
    { operation: "set", key: V2_STORAGE_KEYS.baseProfiles },
    { operation: "set", key: V2_STORAGE_KEYS.categoryProfiles },
    { operation: "set", key: V2_STORAGE_KEYS.assetProfiles },
  ] as const;
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("profile library user flows", () => {
  it("renders the real profiles view and all nine category filter options", () => {
    renderPopulated();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Produktionsprofile sicher organisieren.",
      }),
    ).toHaveAttribute("id", "profiles-view-title");
    expect(screen.getByRole("main")).toHaveAttribute("aria-labelledby", "profiles-view-title");
    expect(screen.getByRole("search")).toBeVisible();

    const categorySelect = screen.getByRole("combobox", { name: "Kategorie" });
    const options = within(categorySelect).getAllByRole("option");
    expect(options).toHaveLength(ASSET_CATEGORY_IDS.length + 1);
    expect(options[0]).toHaveTextContent("Alle Kategorien");
    expect(options.slice(1).map((option) => option.getAttribute("value"))).toEqual(
      ASSET_CATEGORY_IDS,
    );
    expect(
      within(screen.getByRole("combobox", { name: "Basisprofil" })).getByRole("option", {
        name: "Alle Basisprofile",
      }),
    ).toHaveValue("");
    const profileSelect = screen.getByRole("combobox", {
      name: "Profile durchsuchen",
    });
    expect(within(profileSelect).getAllByRole("option")).toHaveLength(7);
    expect(within(profileSelect).getByRole("option", { name: "Alle Profile" })).toHaveValue("");
    expect(
      within(profileSelect).getByRole("option", {
        name: "Nasser grauer Stein · Textur / Material / Stein",
      }),
    ).toHaveValue("asset_wet_stone");
    expect(
      screen.queryByRole("searchbox", { name: "Profile durchsuchen" }),
    ).not.toBeInTheDocument();
  });

  it("combines selected profile, category, base-profile, and favorite filters", async () => {
    const user = userEvent.setup();
    renderPopulated();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Profile durchsuchen" }),
      "asset_wet_stone",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Kategorie" }), "texture");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Basisprofil" }),
      "base_world_96",
    );
    await user.click(screen.getByRole("checkbox", { name: "Nur Favoriten" }));

    expect(profileArticle("Nasser grauer Stein")).toBeVisible();
    expect(
      screen.queryByRole("article", { name: "Nahtlose Eichenplanken" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Hofmagier 96 px" })).not.toBeInTheDocument();
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent("1 von 6 Profilen");
  });

  it("groups by resolved technical compatibility without displaying the key", async () => {
    const user = userEvent.setup();
    renderPopulated();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Gruppierung" }),
      "compatibility",
    );

    const groupHeadings = screen.getAllByRole("heading", {
      level: 3,
      name: /^Kompatibilitätsgruppe \d+$/,
    });
    expect(groupHeadings).toHaveLength(4);

    const firstGroup = groupHeadings[0]?.closest("section");
    if (!firstGroup) throw new Error("Expected the first compatibility group.");
    expect(
      within(firstGroup).getByRole("article", {
        name: "Dorfschmied mit Lederschürze",
      }),
    ).toBeVisible();
    expect(within(firstGroup).getByRole("article", { name: "Wache am Nordtor" })).toBeVisible();
    expect(
      within(firstGroup).queryByRole("article", { name: "Hofmagier 96 px" }),
    ).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("pf2-compat-v1__");
  });

  it("loads a profile by keyboard with the exact intent, one push, and no write", async () => {
    const user = userEvent.setup();
    const { navigation, storage } = renderPopulated();
    const loadButton = screen.getByRole("button", {
      name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
    });

    loadButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      JSON.stringify({
        kind: "profile",
        assetProfileId: "asset_smith_80",
      }),
    );
    expect(navigation.pushedViews).toEqual(["wizard"]);
    expect(navigation.replacedViews).toEqual([]);
    expect(storage.mutations).toEqual([]);
  });

  it("preserves filters while navigating away and returning through host state", async () => {
    const user = userEvent.setup();
    const navigation = new MemoryNavigation({ status: "valid", view: "profiles" });
    const { storage } = renderStudio({
      navigation,
      storage: populatedStorage(),
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Profile durchsuchen" }),
      "asset_wet_stone",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Kategorie" }), "texture");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Gruppierung" }),
      "compatibility",
    );

    await user.click(within(primaryNavigation()).getByRole("button", { name: "Dashboard" }));
    expect(navigation.pushedViews).toEqual(["dashboard"]);

    act(() => {
      navigation.emitRoute({ status: "valid", view: "profiles" });
    });

    expect(screen.getByRole("combobox", { name: "Profile durchsuchen" })).toHaveValue(
      "asset_wet_stone",
    );
    expect(screen.getByRole("combobox", { name: "Kategorie" })).toHaveValue("texture");
    expect(screen.getByRole("combobox", { name: "Gruppierung" })).toHaveValue("compatibility");
    expect(profileArticle("Nasser grauer Stein")).toBeVisible();
    expect(storage.mutations).toEqual([]);
    expect(navigation.pushedViews).toEqual(["dashboard"]);
  });

  it("toggles a favorite without navigating and persists the complete library", async () => {
    const user = userEvent.setup();
    const { adapter, navigation, storage } = renderPopulated();
    const favoriteButton = screen.getByRole("button", {
      name: "Profil „Wache am Nordtor“ als Favorit markieren",
    });
    expect(favoriteButton).toHaveAttribute("aria-pressed", "false");

    await user.click(favoriteButton);

    expect(
      screen.getByRole("button", {
        name: "Profil „Wache am Nordtor“ aus Favoriten entfernen",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Favoritenstatus für „Wache am Nordtor“ gespeichert.")).toBeVisible();
    expect(navigation.pushedViews).toEqual([]);
    expect(storage.mutations).toEqual(expectedProfileWrites());
    expect(adapter.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: {
        assetProfiles: expect.arrayContaining([
          expect.objectContaining({ id: "asset_guard_80", favorite: true }),
        ]),
      },
    });
  });

  it("moves focus to the results heading when an active favorite filter removes a card", async () => {
    const user = userEvent.setup();
    renderPopulated();

    await user.click(screen.getByRole("checkbox", { name: "Nur Favoriten" }));
    const removeFavoriteButton = screen.getByRole("button", {
      name: "Profil „Dorfschmied mit Lederschürze“ aus Favoriten entfernen",
    });
    removeFavoriteButton.focus();
    await user.keyboard("{Enter}");

    expect(
      screen.queryByRole("article", { name: "Dorfschmied mit Lederschürze" }),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: "Gespeicherte Assetprofile",
        }),
      ).toHaveFocus(),
    );
  });

  it("duplicates an asset profile in place with a fresh identity", async () => {
    const user = userEvent.setup();
    const { adapter, navigation, storage } = renderPopulated({
      now: () => duplicateTimestamp,
      createProfileId: () => duplicateProfileId,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ duplizieren",
      }),
    );

    expect(profileArticle("Dorfschmied mit Lederschürze (Kopie)")).toBeVisible();
    expect(screen.getByText("7 von 7 Profilen")).toBeVisible();
    expect(navigation.pushedViews).toEqual([]);
    expect(storage.mutations).toEqual(expectedProfileWrites());

    const result = adapter.readProfileLibrary();
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected persisted profiles.");
    expect(
      result.value.assetProfiles.find((profile) => profile.id === duplicateProfileId),
    ).toMatchObject({
      id: duplicateProfileId,
      name: "Dorfschmied mit Lederschürze (Kopie)",
      favorite: false,
      createdAt: duplicateTimestamp,
      updatedAt: duplicateTimestamp,
    });
  });

  it("cancels deletion by button or Escape and restores focus to the trigger", async () => {
    const user = userEvent.setup();
    const { storage } = renderPopulated();
    const deleteButton = screen.getByRole("button", {
      name: "Profil „Wache am Nordtor“ löschen",
    });

    await user.click(deleteButton);
    const dialogName = "„Wache am Nordtor“ endgültig löschen?";
    let dialog = screen.getByRole("alertdialog", { name: dialogName });
    const cancelButton = within(dialog).getByRole("button", {
      name: "Abbrechen",
    });
    const confirmButton = within(dialog).getByRole("button", {
      name: "Profil endgültig löschen",
    });
    expect(cancelButton).toHaveFocus();
    await user.tab({ shift: true });
    expect(confirmButton).toHaveFocus();
    await user.tab();
    expect(cancelButton).toHaveFocus();

    await user.click(cancelButton);
    expect(screen.queryByRole("alertdialog", { name: dialogName })).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();

    await user.click(deleteButton);
    dialog = screen.getByRole("alertdialog", { name: dialogName });
    expect(within(dialog).getByRole("button", { name: "Abbrechen" })).toHaveFocus();
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("alertdialog", { name: dialogName })).not.toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
    expect(profileArticle("Wache am Nordtor")).toBeVisible();
    expect(storage.mutations).toEqual([]);
  });

  it("deletes only after confirmation and moves focus to the results heading", async () => {
    const user = userEvent.setup();
    const { adapter, navigation, storage } = renderPopulated();

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Wache am Nordtor“ löschen",
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "„Wache am Nordtor“ endgültig löschen?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Profil endgültig löschen" }));

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Wache am Nordtor" })).not.toBeInTheDocument();
    const resultsHeading = screen.getByRole("heading", {
      level: 2,
      name: "Gespeicherte Assetprofile",
    });
    await waitFor(() => expect(resultsHeading).toHaveFocus());
    expect(screen.getByText("„Wache am Nordtor“ wurde gelöscht.")).toBeVisible();
    expect(navigation.pushedViews).toEqual([]);
    expect(storage.mutations).toEqual(expectedProfileWrites());

    const result = adapter.readProfileLibrary();
    expect(result.status).toBe("valid");
    if (result.status !== "valid") throw new Error("Expected persisted profiles.");
    expect(result.value.assetProfiles.some((profile) => profile.id === "asset_guard_80")).toBe(
      false,
    );
    expect(result.value.baseProfiles).toHaveLength(4);
    expect(result.value.categoryProfiles).toHaveLength(1);
  });

  it("clears a matching loaded-profile intent after confirmed deletion", async () => {
    const user = userEvent.setup();
    const navigation = new MemoryNavigation({ status: "valid", view: "profiles" });
    renderStudio({ navigation, storage: populatedStorage() });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      '"assetProfileId":"asset_smith_80"',
    );

    act(() => {
      navigation.emitRoute({ status: "valid", view: "profiles" });
    });
    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ löschen",
      }),
    );
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Profil endgültig löschen",
      }),
    );
    await user.click(within(primaryNavigation()).getByRole("button", { name: "Wizard" }));

    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent("null");
  });

  it("fails closed when confirmed deletion cannot be written", async () => {
    const user = userEvent.setup();
    const storage = populatedStorage();
    storage.failSetFor = V2_STORAGE_KEYS.baseProfiles;
    const { adapter, navigation } = renderStudio({ storage });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Wache am Nordtor“ löschen",
      }),
    );
    const dialog = screen.getByRole("alertdialog", {
      name: "„Wache am Nordtor“ endgültig löschen?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Profil endgültig löschen" }));

    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Löschung wurde nicht gespeichert. Der lokale Speicher ist nicht verfügbar.",
    );
    expect(profileArticle("Wache am Nordtor")).toBeVisible();
    expect(navigation.pushedViews).toEqual([]);
    expect(storage.mutations).toEqual([]);

    storage.failSetFor = null;
    expect(adapter.readProfileLibrary()).toMatchObject({
      status: "valid",
      value: {
        assetProfiles: expect.arrayContaining([expect.objectContaining({ id: "asset_guard_80" })]),
      },
    });
  });

  it("shows a truthful empty library without manufacturing profile cards", () => {
    const { storage } = renderStudio();

    expect(screen.getByText("Noch keine Assetprofile gespeichert")).toBeVisible();
    expect(screen.getByRole("button", { name: "Erstes Asset erstellen" })).toBeVisible();
    expect(screen.getByText("0 von 0 Profilen")).toBeVisible();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(storage.mutations).toEqual([]);
  });

  it("keeps invalid profile storage untouched and disables profile actions", () => {
    const corruptValue = "{broken-profile-json";
    const storage = new MemoryStorage({
      [V2_STORAGE_KEYS.baseProfiles]: corruptValue,
    });
    renderStudio({ storage });

    expect(screen.getByRole("alert")).toHaveTextContent("Profilbibliothek ist beschädigt");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Die gespeicherten Daten bleiben unangetastet",
    );
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(storage.getItem(V2_STORAGE_KEYS.baseProfiles)).toBe(corruptValue);
    expect(storage.mutations).toEqual([]);
  });

  it("distinguishes unavailable profile storage from an empty library", () => {
    const storage = new MemoryStorage();
    storage.failGetFor = V2_STORAGE_KEYS.baseProfiles;
    renderStudio({ storage });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Lokaler Profilspeicher ist nicht verfügbar",
    );
    expect(screen.queryByText("Noch keine Assetprofile gespeichert")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("article")).toHaveLength(0);
    expect(storage.mutations).toEqual([]);
  });
});
