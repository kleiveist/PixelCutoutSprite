import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../test/PromptTestApp";
import { ASSET_CATEGORY_IDS, resolveCapabilities, type AssetCategory } from "../../domain/assets";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseBaseProfile,
  parseWizardDraft,
  type ProfileLibrary,
} from "../../schemas";
import { V2_STORAGE_KEYS, createV2StorageAdapter } from "../../services";
import { MemoryNavigation } from "../../test/memoryNavigation";
import { MemoryStorage } from "../../test/memoryStorage";
import { MATERIAL_BADGE_IDS, MATERIAL_BADGE_LABELS } from "./dashboardCatalog";

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

const timestamp = "2026-09-02T12:00:00.000Z";

const expectedCategories = [
  ["character", "Charakter / Figur"],
  ["movingObject", "Bewegliches Objekt"],
  ["staticObject", "Statisches Objekt"],
  ["texture", "Textur / Material"],
  ["nature", "Natur / Pflanze"],
  ["building", "Gebäude / Architektur"],
  ["tileset", "Tileset / Mapping"],
  ["item", "Item / Ausrüstung"],
  ["artwork", "Artwork / Konzeptbild"],
] as const satisfies readonly (readonly [AssetCategory, string])[];

const baseValues = {
  pixelDensity: "modernHd",
  styleProfile: "both",
  tileSize: 32,
  characterHeight: 80,
  perspectiveType: "threeQuarter",
  cameraAngle: 60,
  cameraDirection: "southToNorth",
  projectionType: "orthographic",
  outlineStyle: "softSelective",
  paletteMode: "byProfile",
  backgroundMode: "transparent",
  alphaPadding: 8,
  nearestNeighbor: true,
  lightingDefaults: {
    policy: "adaptive",
    notes: "Keep world light stable.",
  },
} as const;

function profileLibraryFixture(): ProfileLibrary {
  const baseProfile = parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_world_32_80",
    name: "Weltassets 32 px / Figuren 80 px",
    iconId: "world-grid",
    values: baseValues,
    locks: {},
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const selection = { category: "character", subtype: "npc" } as const;
  const assetProfile = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_blacksmith",
    name: "Dorfschmied mit Lederschürze",
    baseProfileId: baseProfile.id,
    compatibilityKey: createCompatibilityKey(baseProfile.values, selection),
    category: selection.category,
    subtype: selection.subtype,
    iconId: "character-npc",
    badgeIconIds: ["material-leather"],
    capabilities: resolveCapabilities(selection.category, selection.subtype),
    overrides: {},
    answers: {
      role: "blacksmith",
      directionCount: 8,
      animationAction: "walk",
      framesPerDirection: 5,
    },
    tags: ["Dorf", "Handwerk", "Leder"],
    favorite: true,
    createdAt: timestamp,
    updatedAt: "2026-09-02T14:00:00.000Z",
  });

  return ProfileLibrarySchema.parse({
    baseProfiles: [baseProfile],
    categoryProfiles: [],
    assetProfiles: [assetProfile],
  });
}

function populatedStorage(): Readonly<{
  adapter: ReturnType<typeof createV2StorageAdapter>;
  storage: MemoryStorage;
}> {
  const storage = new MemoryStorage();
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeProfileLibrary(profileLibraryFixture())).toEqual({
    status: "ok",
  });
  storage.mutations.splice(0);
  return { adapter, storage };
}

function renderStudio(
  storage = new MemoryStorage(),
  navigation = new MemoryNavigation({ status: "valid", view: "dashboard" }),
) {
  const adapter = createV2StorageAdapter(storage);
  const rendered = render(<App navigationAdapter={navigation} storageAdapter={adapter} />);
  return { ...rendered, adapter, navigation, storage };
}

function categorySection(): HTMLElement {
  const heading = screen.getByRole("heading", {
    level: 2,
    name: "Was möchtest du erschaffen?",
  });
  const section = heading.closest("section");
  if (!section) throw new Error("Expected the category heading inside a section.");
  return section;
}

function sectionForHeading(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 2, name });
  const section = heading.closest("section");
  if (!section) throw new Error(`Expected "${name}" inside a section.`);
  return section;
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("V2 dashboard interactions", () => {
  it("renders every required category exactly once with a decorative local icon", () => {
    renderStudio();

    expect(expectedCategories.map(([category]) => category)).toEqual(ASSET_CATEGORY_IDS);
    const cards = within(categorySection()).getAllByRole("button");
    expect(cards).toHaveLength(9);

    for (const [category, label] of expectedCategories) {
      const card = within(categorySection()).getByRole("button", {
        name: `${label} als neues Asset erstellen`,
      });
      const icon = card.querySelector(`svg[data-category-icon="${category}"]`);
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
    }

    expect(within(categorySection()).queryAllByRole("img")).toHaveLength(0);

    const materialGroup = screen.getByRole("group", {
      name: "Unterstützte Materialien",
    });
    for (const material of MATERIAL_BADGE_IDS) {
      expect(within(materialGroup).getByText(MATERIAL_BADGE_LABELS[material])).toBeVisible();
      const icon = materialGroup.querySelector(`svg[data-material-icon="${material}"]`);
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).toHaveAttribute("focusable", "false");
    }
  });

  it.each(expectedCategories)(
    "starts the Wizard with the exact %s intent by keyboard",
    async (category, label) => {
      const user = userEvent.setup();
      const { navigation, storage } = renderStudio();
      const card = within(categorySection()).getByRole("button", {
        name: `${label} als neues Asset erstellen`,
      });

      card.focus();
      await user.keyboard("{Enter}");

      expect(navigation.pushedViews).toEqual(["wizard"]);
      expect(navigation.replacedViews).toEqual([]);
      expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
        JSON.stringify({ kind: "newAsset", category }),
      );
      expect(screen.getByRole("main")).toHaveFocus();
      expect(storage.mutations).toEqual([]);
    },
  );

  it("clears a stale category when the generic new-asset action is used", async () => {
    const user = userEvent.setup();
    const { navigation } = renderStudio();

    await user.click(
      within(categorySection()).getByRole("button", {
        name: "Textur / Material als neues Asset erstellen",
      }),
    );
    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      JSON.stringify({ kind: "newAsset", category: "texture" }),
    );

    act(() => {
      navigation.emitRoute({ status: "valid", view: "dashboard" });
    });
    await waitFor(() => expect(categorySection()).toBeVisible());

    const heroHeading = screen.getByRole("heading", {
      level: 1,
      name: "Pixelart-Produktion beginnt mit der richtigen Asset-Art.",
    });
    const hero = heroHeading.closest("section");
    if (!hero) throw new Error("Expected the dashboard title inside the hero.");
    await user.click(within(hero).getByRole("button", { name: "Neues Asset" }));

    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      JSON.stringify({ kind: "newAsset", category: null }),
    );
    expect(navigation.pushedViews).toEqual(["wizard", "wizard"]);
  });

  it("opens a stored profile with native keyboard interaction", async () => {
    const user = userEvent.setup();
    const { adapter, storage } = populatedStorage();
    const navigation = new MemoryNavigation({
      status: "valid",
      view: "dashboard",
    });
    render(<App navigationAdapter={navigation} storageAdapter={adapter} />);
    const recentProfiles = sectionForHeading("Letzte Profile");
    const profileButton = within(recentProfiles).getByRole("button", {
      name: "Profil Dorfschmied mit Lederschürze im Wizard öffnen",
    });

    expect(profileButton.tagName).toBe("BUTTON");
    expect(within(profileButton).getByText("Leder")).toBeVisible();
    const materialIcon = profileButton.querySelector('svg[data-material-icon="leather"]');
    expect(materialIcon).toHaveAttribute("aria-hidden", "true");
    expect(materialIcon).toHaveAttribute("focusable", "false");

    profileButton.focus();
    await user.keyboard("{Enter}");

    expect(navigation.pushedViews).toEqual(["wizard"]);
    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      JSON.stringify({
        kind: "profile",
        assetProfileId: "asset_blacksmith",
      }),
    );
    expect(screen.getByRole("main")).toHaveFocus();
    expect(storage.mutations).toEqual([]);
  });

  it("resumes a validated local draft without rewriting it", async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    const adapter = createV2StorageAdapter(storage);
    expect(
      adapter.writeDraft(
        parseWizardDraft({
          schemaVersion: 2,
          kind: "wizardDraft",
          draftId: "draft_winter_tree",
          projectName: "Winterwald",
          route: "wizard/category",
          currentStep: "category",
          validation: { errors: [], warnings: [] },
          savedAt: timestamp,
        }),
      ),
    ).toEqual({ status: "ok" });
    storage.mutations.splice(0);
    const navigation = new MemoryNavigation({
      status: "valid",
      view: "dashboard",
    });

    render(<App navigationAdapter={navigation} storageAdapter={adapter} />);
    await user.click(screen.getByRole("button", { name: /entwurf fortsetzen/i }));

    expect(screen.getByTestId("wizard-start-intent")).toHaveTextContent(
      JSON.stringify({ kind: "resume", draftId: "draft_winter_tree" }),
    );
    expect(navigation.pushedViews).toEqual(["wizard"]);
    expect(storage.mutations).toEqual([]);
  });

  it("selects and persists an existing base profile from the dashboard", async () => {
    const user = userEvent.setup();
    const { adapter, storage } = populatedStorage();
    const navigation = new MemoryNavigation({
      status: "valid",
      view: "dashboard",
    });
    render(
      <App
        navigationAdapter={navigation}
        storageAdapter={adapter}
        now={() => "2026-09-02T15:00:00.000Z"}
      />,
    );
    const baseProfiles = sectionForHeading("Basisprofile im Überblick");
    const selectButton = within(baseProfiles).getByRole("button", {
      name: "Weltassets 32 px / Figuren 80 px als Basisprofil verwenden",
    });

    await user.click(selectButton);

    expect(adapter.readSettings()).toMatchObject({
      status: "valid",
      value: {
        activeBaseProfileId: "base_world_32_80",
        updatedAt: "2026-09-02T15:00:00.000Z",
      },
    });
    expect(storage.mutations).toEqual([{ operation: "set", key: V2_STORAGE_KEYS.settings }]);
    expect(
      within(baseProfiles).getByRole("button", {
        name: "Weltassets 32 px / Figuren 80 px, aktives Basisprofil",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Basisprofil aktiviert und lokal gespeichert.",
    );
  });

  it("keeps a base profile selection in the session when settings storage fails", async () => {
    const user = userEvent.setup();
    const { adapter, storage } = populatedStorage();
    storage.failSetFor = V2_STORAGE_KEYS.settings;
    const navigation = new MemoryNavigation({
      status: "valid",
      view: "dashboard",
    });
    render(
      <App
        navigationAdapter={navigation}
        storageAdapter={adapter}
        now={() => "2026-09-02T15:00:00.000Z"}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Weltassets 32 px / Figuren 80 px als Basisprofil verwenden",
      }),
    );

    expect(
      screen.getByRole("button", {
        name: "Weltassets 32 px / Figuren 80 px, aktives Basisprofil",
      }),
    ).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Basisprofil ist für diese Sitzung aktiv");
    expect(adapter.readSettings()).toEqual({ status: "empty" });
    expect(storage.mutations).toEqual([]);
  });

  it("shows truthful empty states without manufacturing profile cards", () => {
    renderStudio();

    expect(
      within(sectionForHeading("Letzte Profile")).getByText("Noch keine Profile gespeichert"),
    ).toBeVisible();
    expect(within(sectionForHeading("Favoriten")).getByText("Noch keine Favoriten")).toBeVisible();
    expect(
      within(sectionForHeading("Basisprofile im Überblick")).getByText(
        "Kein Basisprofil verfügbar",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^Profil .+ im Wizard öffnen$/ }),
    ).not.toBeInTheDocument();
  });

  it("keeps corrupt profile storage untouched and exposes the invalid state", () => {
    const corruptValue = "{broken-profile-json";
    const storage = new MemoryStorage({
      [V2_STORAGE_KEYS.baseProfiles]: corruptValue,
    });
    renderStudio(storage);

    expect(
      within(sectionForHeading("Letzte Profile")).getByText(
        "Gespeicherte Profile konnten nicht gelesen werden",
      ),
    ).toBeVisible();
    expect(
      within(sectionForHeading("Favoriten")).queryByText("Noch keine Favoriten"),
    ).not.toBeInTheDocument();
    expect(
      within(sectionForHeading("Basisprofile im Überblick")).queryByText(
        "Kein Basisprofil verfügbar",
      ),
    ).not.toBeInTheDocument();
    expect(storage.getItem(V2_STORAGE_KEYS.baseProfiles)).toBe(corruptValue);
    expect(storage.mutations).toEqual([]);
  });

  it("distinguishes unavailable storage from an empty profile library", () => {
    const storage = new MemoryStorage();
    storage.failGetFor = V2_STORAGE_KEYS.baseProfiles;
    renderStudio(storage);

    expect(
      within(sectionForHeading("Letzte Profile")).getByText("Lokaler Speicher ist nicht verfügbar"),
    ).toBeVisible();
    expect(screen.queryByText("Noch keine Profile gespeichert")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });
});
