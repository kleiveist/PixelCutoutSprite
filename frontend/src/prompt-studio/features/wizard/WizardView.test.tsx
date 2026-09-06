import { StrictMode } from "react";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../test/PromptTestApp";
import { createCompatibilityKey } from "../../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  parseWizardDraft,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import { V2_STORAGE_KEYS, createV2StorageAdapter } from "../../services";
import { MemoryNavigation } from "../../test/memoryNavigation";
import { MemoryStorage } from "../../test/memoryStorage";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";

const INITIAL_TIMESTAMP = "2026-09-04T10:00:00.000Z";
const SAVED_TIMESTAMP = "2026-09-04T10:05:00.000Z";
const DEFAULT_DRAFT_ID = "draft_wizard_view_001";
type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

interface RenderStudioOptions {
  readonly createBaseProfileId?: () => string;
  readonly createDraftId?: () => string;
  readonly navigation?: MemoryNavigation;
  readonly now?: () => string;
  readonly storage?: MemoryStorage;
  readonly strict?: boolean;
}

function renderStudio(options: RenderStudioOptions = {}) {
  const storage = options.storage ?? populatedStorage();
  const navigation =
    options.navigation ?? new MemoryNavigation({ status: "valid", view: "wizard" });
  const adapter = createV2StorageAdapter(storage);
  const app = (
    <App
      navigationAdapter={navigation}
      storageAdapter={adapter}
      createBaseProfileId={options.createBaseProfileId ?? (() => "base_wizard_view_001")}
      createDraftId={options.createDraftId ?? (() => DEFAULT_DRAFT_ID)}
      now={options.now ?? (() => SAVED_TIMESTAMP)}
    />
  );
  const rendered = render(options.strict ? <StrictMode>{app}</StrictMode> : app);

  return { ...rendered, adapter, navigation, storage };
}

function projectNameInput(): HTMLInputElement {
  return screen.getByRole("textbox", { name: /Projektname/i });
}

function primaryNavigation(): HTMLElement {
  return screen.getByRole("navigation", { name: "Hauptnavigation" });
}

async function chooseCustomText(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
): Promise<HTMLElement> {
  const presetSelect = screen.getByRole("combobox", { name: label });
  await user.selectOptions(
    presetSelect,
    within(presetSelect).getByRole("option", { name: "Eigene Eingabe" }),
  );
  return screen.getByRole("textbox", {
    name: `Eigene Eingabe für ${label}`,
  });
}

async function selectAssetClassification(
  user: ReturnType<typeof userEvent.setup>,
  categoryName: RegExp,
  subtype: string,
): Promise<void> {
  await user.click(screen.getByRole("radio", { name: categoryName }));
  await user.selectOptions(screen.getByRole("combobox", { name: /Untertyp/ }), subtype);
}

function baseProfileChoice(name: RegExp): HTMLInputElement {
  return within(screen.getByRole("group", { name: "Produktionsfamilie auswählen" })).getByRole(
    "radio",
    { name },
  );
}

async function selectBaseProfile(
  user: ReturnType<typeof userEvent.setup>,
  name: RegExp = /^Weltfamilie 32 px \/ Figuren 80 px/,
): Promise<HTMLInputElement> {
  const choice = baseProfileChoice(name);
  await user.click(choice);
  expect(choice).toBeChecked();
  return choice;
}

async function enterBaseProfileStep(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: /Weiter/ }));
  expect(screen.getByRole("heading", { level: 2, name: "Basisprofil" })).toBeVisible();
}

function draftWrites(storage: MemoryStorage) {
  return storage.mutations.filter((mutation) => mutation.key === V2_STORAGE_KEYS.draft);
}

function readValidDraft(adapter: ReturnType<typeof createV2StorageAdapter>): WizardDraft {
  const result = adapter.readDraft();
  expect(result.status).toBe("valid");
  if (result.status !== "valid") {
    throw new Error("Expected a valid persisted Wizard draft.");
  }
  return result.value;
}

function readValidProfileLibrary(
  adapter: ReturnType<typeof createV2StorageAdapter>,
): ProfileLibrary {
  const result = adapter.readProfileLibrary();
  expect(result.status).toBe("valid");
  if (result.status !== "valid") {
    throw new Error("Expected a valid persisted profile library.");
  }
  return result.value;
}

function storeDraft(storage: MemoryStorage, draft: WizardDraft): void {
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeDraft(draft)).toEqual({ status: "ok" });
  storage.mutations.splice(0);
}

function categoryDraft(overrides: Readonly<{ draftId?: string }> = {}): WizardDraft {
  return parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_resume_exact",
    projectName: "Winterwald",
    route: "wizard/category",
    currentStep: "category",
    validation: { errors: [], warnings: [] },
    savedAt: INITIAL_TIMESTAMP,
    ...overrides,
  });
}

function populatedStorage(library: ProfileLibrary = createProfileLibraryFixture()): MemoryStorage {
  const storage = new MemoryStorage();
  const adapter = createV2StorageAdapter(storage);
  expect(adapter.writeProfileLibrary(library)).toEqual({ status: "ok" });
  storage.mutations.splice(0);
  return storage;
}

function profileLibraryWithTechnicalOverrides(): ProfileLibrary {
  const library = createProfileLibraryFixture();
  const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  const base = library.baseProfiles.find((profile) => profile.id === source?.baseProfileId);
  if (!source || !base) {
    throw new Error("Expected a complete smith profile fixture.");
  }
  if (source.category !== "character") {
    throw new Error("Expected the smith fixture to be a character profile.");
  }

  const overrides = {
    tileSize: 48,
    lightingDefaults: {
      policy: "warmInterior" as const,
      notes: "Warm forge light.",
    },
  };
  const profile = parseAssetProfile({
    ...source,
    overrides,
    compatibilityKey: createCompatibilityKey(
      { ...base.values, ...overrides },
      { category: "character", subtype: source.subtype },
    ),
  });

  return ProfileLibrarySchema.parse({
    ...library,
    assetProfiles: library.assetProfiles.map((candidate) =>
      candidate.id === profile.id ? profile : candidate,
    ),
  });
}

function profileLibraryWithLockedTileSize(): ProfileLibrary {
  const library = createProfileLibraryFixture();
  const source = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!source) throw new Error("Expected the 80 px Base profile fixture.");

  const lockedBase = parseBaseProfile({
    ...source,
    locks: { ...source.locks, tileSize: true },
    updatedAt: SAVED_TIMESTAMP,
  });

  return ProfileLibrarySchema.parse({
    ...library,
    baseProfiles: library.baseProfiles.map((profile) =>
      profile.id === lockedBase.id ? lockedBase : profile,
    ),
  });
}

function profileLibraryWithLockedCharacterHeight(): ProfileLibrary {
  const library = createProfileLibraryFixture();
  const source = library.baseProfiles.find((profile) => profile.id === "base_world_80");
  if (!source) throw new Error("Expected the 80 px Base profile fixture.");

  const lockedBase = parseBaseProfile({
    ...source,
    locks: { ...source.locks, characterHeight: true },
    updatedAt: SAVED_TIMESTAMP,
  });

  return ProfileLibrarySchema.parse({
    ...library,
    baseProfiles: library.baseProfiles.map((profile) =>
      profile.id === lockedBase.id ? lockedBase : profile,
    ),
  });
}

function profileLibraryWithHeightlessBase(lockCharacterHeight = false): ProfileLibrary {
  const library = createProfileLibraryFixture();
  const source = library.baseProfiles.find((profile) => profile.id === "base_unused");
  if (!source) throw new Error("Expected the unused Base profile fixture.");
  const { characterHeight: omittedCharacterHeight, ...values } = source.values;
  void omittedCharacterHeight;
  const heightlessBase = parseBaseProfile({
    ...source,
    values,
    locks: {
      ...source.locks,
      ...(lockCharacterHeight ? { characterHeight: true } : {}),
    },
  });

  return ProfileLibrarySchema.parse({
    ...library,
    baseProfiles: library.baseProfiles.map((profile) =>
      profile.id === heightlessBase.id ? heightlessBase : profile,
    ),
  });
}

function profileLibraryWithCategoryTileOverride(): ProfileLibrary {
  const library = createProfileLibraryFixture();
  const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  const base = library.baseProfiles.find((profile) => profile.id === source?.baseProfileId);
  const category = library.categoryProfiles.find(
    (profile) => profile.id === source?.categoryProfileId,
  );
  if (!source || !base || !category || source.category !== "character") {
    throw new Error("Expected a complete character profile fixture.");
  }

  const inheritedCategory = parseCategoryProfile({
    ...category,
    overrides: { ...category.overrides, tileSize: 48 },
  });
  const compatibleSource = parseAssetProfile({
    ...source,
    compatibilityKey: createCompatibilityKey(
      { ...base.values, tileSize: 48 },
      { category: "character", subtype: source.subtype },
    ),
  });

  return ProfileLibrarySchema.parse({
    ...library,
    categoryProfiles: library.categoryProfiles.map((profile) =>
      profile.id === inheritedCategory.id ? inheritedCategory : profile,
    ),
    assetProfiles: library.assetProfiles.map((profile) =>
      profile.id === compatibleSource.id ? compatibleSource : profile,
    ),
  });
}

function portableProfileDraftFixture(): Readonly<{
  draft: SelectedWizardDraft;
  library: ProfileLibrary;
}> {
  const sourceLibrary = profileLibraryWithTechnicalOverrides();
  const source = sourceLibrary.assetProfiles.find((profile) => profile.id === "asset_smith_80");
  if (!source) throw new Error("Expected the portable smith source profile.");

  const draft = parseWizardDraft({
    schemaVersion: 2,
    kind: "wizardDraft",
    draftId: "draft_portable_smith",
    projectName: source.name,
    route: "wizard/profile",
    currentStep: "category",
    baseProfileId: source.baseProfileId,
    ...(source.categoryProfileId === undefined
      ? {}
      : { categoryProfileId: source.categoryProfileId }),
    sourceAssetProfileId: source.id,
    overrides: source.overrides,
    category: source.category,
    subtype: source.subtype,
    answers: source.answers,
    validation: { errors: [], warnings: [] },
    savedAt: INITIAL_TIMESTAMP,
  });
  if (!("category" in draft)) {
    throw new Error("Expected a selected portable Wizard Draft.");
  }

  return {
    draft,
    library: ProfileLibrarySchema.parse({
      ...sourceLibrary,
      assetProfiles: sourceLibrary.assetProfiles.filter((profile) => profile.id !== source.id),
    }),
  };
}

async function beginVisibleDashboardDraft(storage: MemoryStorage): Promise<
  Readonly<{
    user: ReturnType<typeof userEvent.setup>;
    rendered: ReturnType<typeof renderStudio>;
  }>
> {
  const user = userEvent.setup();
  const rendered = renderStudio({
    navigation: new MemoryNavigation({ status: "valid", view: "dashboard" }),
    storage,
  });
  expect(screen.getByRole("button", { name: /Entwurf fortsetzen/i })).toBeVisible();
  return { user, rendered };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("guided Wizard integration", () => {
  it("keeps an empty start transient and does not write on mount", () => {
    vi.useFakeTimers();
    const { storage } = renderStudio();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Neue Assets geführt aufsetzen.",
      }),
    ).toHaveAttribute("id", "wizard-view-title");
    expect(screen.getByRole("heading", { level: 2, name: "Projekt" })).toBeVisible();
    expect(projectNameInput()).toHaveValue("");
    expect(screen.getByText("Dieser Start wurde noch nicht lokal gesichert.")).toBeVisible();

    act(() => vi.advanceTimersByTime(1_000));

    expect(storage.mutations).toEqual([]);
  });

  it("blocks an empty required project, exposes the error, and focuses the field", async () => {
    const user = userEvent.setup();
    const { storage } = renderStudio();
    const input = projectNameInput();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    expect(screen.getByRole("heading", { level: 2, name: "Projekt" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bitte korrigiere das markierte Pflichtfeld.",
    );
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute(
      "aria-describedby",
      "wizard-project-name-help wizard-project-name-error",
    );
    expect(screen.getByText("Bitte gib einen Projektnamen ein.")).toBeVisible();
    expect(input).toHaveFocus();
    expect(storage.mutations).toEqual([]);
  });

  it("advances with a valid value, persists the category step, and focuses its heading", async () => {
    const user = userEvent.setup();
    const { adapter, storage } = renderStudio();

    await user.type(projectNameInput(), "  Winterhafen  ");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Bildart",
    });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(
      within(screen.getByRole("navigation", { name: "Wizard-Fortschritt" }))
        .getByText("Bildart")
        .closest("li"),
    ).toHaveAttribute("aria-current", "step");
    expect(draftWrites(storage).length).toBeGreaterThanOrEqual(1);
    expect(draftWrites(storage).every((mutation) => mutation.key === V2_STORAGE_KEYS.draft)).toBe(
      true,
    );
    expect(readValidDraft(adapter)).toMatchObject({
      draftId: DEFAULT_DRAFT_ID,
      projectName: "Winterhafen",
      route: "wizard/category",
      currentStep: "category",
      savedAt: SAVED_TIMESTAMP,
    });
  });

  it("routes an NPC through its editor, eight directions, and per-action frames", async () => {
    const user = userEvent.setup();
    const { adapter } = renderStudio();

    await user.type(projectNameInput(), "Hafenwache");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.queryByRole("combobox", { name: /Untertyp/ })).not.toBeInTheDocument();

    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Basisprofil")).toBeVisible();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Bewegung und Animation")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Kachelbarkeit")).not.toBeInTheDocument();

    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    expect(within(progress).getByText("Figur und Rolle")).toBeVisible();
    expect(within(progress).getByText("Richtungen")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Figur und Rolle" })).toHaveFocus();
    expect(screen.getByRole("status", { name: "Figurenhöhe" })).toHaveTextContent("80 px");

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Richtungen" })).toHaveFocus();
    await user.click(screen.getByRole("radio", { name: /8 Richtungen/ }));
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "character",
        subtype: "npc",
        answers: { directionCount: 8 },
      }),
    );
    await user.click(screen.getByRole("radio", { name: "Keine Richtungen" }));
    await waitFor(() =>
      expect(readValidDraft(adapter)).not.toHaveProperty("answers.directionCount"),
    );
    await user.click(screen.getByRole("radio", { name: /8 Richtungen/ }));
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    expect(screen.getByRole("heading", { level: 2, name: "Bewegung und Animation" })).toBeVisible();
    expect(screen.getByText("Dieses Asset kann sich bewegen.")).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Walk aktivieren" }));
    expect(screen.getByRole("spinbutton", { name: "Frames für Walk" })).toHaveValue(5);
    await user.click(screen.getByRole("checkbox", { name: "Idle aktivieren" }));
    const idleFrames = screen.getByRole("spinbutton", {
      name: "Frames für Idle",
    });
    await user.clear(idleFrames);
    await user.type(idleFrames, "2");

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "character",
        subtype: "npc",
        answers: {
          directionCount: 8,
          animationActions: [
            { action: "idle", frames: 2 },
            { action: "walk", frames: 5 },
          ],
        },
      }),
    );
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("8 Richtungen")).toBeVisible();
    expect(within(summary).getByText("Idle · 2 Frames; Walk · 5 Frames")).toBeVisible();
  });

  it("routes a cart through object details, directions, and canonical animation sequences", async () => {
    const user = userEvent.setup();
    const { adapter } = renderStudio();

    await user.type(projectNameInput(), "Versorgungswagen");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Bewegliches Objekt/, "cart");

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).queryByText("Objekt und Bewegung")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    expect(within(progress).getByText("Objekt und Bewegung")).toBeVisible();
    expect(within(progress).getByText("Richtungen")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();
    expect(within(progress).queryByText("Figur und Rolle")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Objekt und Bewegung" })).toHaveFocus();
    expect(screen.getByText("Karren / Wagen", { selector: "output" })).toBeVisible();

    await user.type(
      await chooseCustomText(user, "Zweck / Funktion"),
      "Versorgung zwischen Dorf und Mine",
    );
    await user.type(
      await chooseCustomText(user, "Grundform"),
      "breiter Holzkasten mit zwei großen Rädern",
    );
    await user.type(
      screen.getByRole("spinbutton", {
        name: "Standfläche · Breite in Tiles",
      }),
      "2",
    );
    await user.type(
      screen.getByRole("spinbutton", {
        name: "Standfläche · Tiefe in Tiles",
      }),
      "1",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Ausrichtungsanker" }),
      "footprintCenter",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Bewegungsart" }), "roll");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Mechanik / Antrieb" }),
      "wheels",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Hauptmaterial" }), "wood");
    await user.selectOptions(screen.getByRole("combobox", { name: "Zustand" }), "used");

    const detailSummary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(detailSummary).getByText("Objektklasse").nextElementSibling).toHaveTextContent(
      "Karren / Wagen",
    );
    expect(within(detailSummary).getByText("Standfläche").nextElementSibling).toHaveTextContent(
      "2 × 1 Tiles",
    );
    expect(within(detailSummary).getByText("Bewegungsart").nextElementSibling).toHaveTextContent(
      "Rollen",
    );

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(await screen.findByRole("heading", { level: 2, name: "Richtungen" })).toHaveFocus();
    expect(readValidDraft(adapter)).toMatchObject({
      currentStep: "directions",
      category: "movingObject",
      subtype: "cart",
      answers: {
        objectClass: "cart",
        purpose: "Versorgung zwischen Dorf und Mine",
        basicShape: "breiter Holzkasten mit zwei großen Rädern",
        footprint: { widthTiles: 2, depthTiles: 1 },
        anchorMode: "footprintCenter",
        movementType: "roll",
        mechanism: "wheels",
        material: "wood",
        condition: "used",
      },
    });
    await user.click(screen.getByRole("radio", { name: /8 Richtungen/ }));
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    expect(
      await screen.findByRole(
        "heading",
        {
          level: 2,
          name: "Bewegung und Animation",
        },
        { timeout: 5_000 },
      ),
    ).toHaveFocus();
    await user.click(screen.getByRole("checkbox", { name: "Idle-Loop aktivieren" }));
    const idleFrames = screen.getByRole("spinbutton", {
      name: "Frames für Idle-Loop",
    });
    await user.clear(idleFrames);
    await user.type(idleFrames, "3");
    await user.click(screen.getByRole("checkbox", { name: "Bewegung aktivieren" }));
    const moveFrames = screen.getByRole("spinbutton", {
      name: "Frames für Bewegung",
    });
    await user.clear(moveFrames);
    await user.type(moveFrames, "6");

    await waitFor(() => {
      const saved = readValidDraft(adapter);
      expect(saved).toMatchObject({
        currentStep: "animation",
        category: "movingObject",
        subtype: "cart",
        answers: {
          directionCount: 8,
          animationSequences: [
            { type: "idle", frames: 3 },
            { type: "move", frames: 6 },
          ],
        },
      });
      expect(saved).not.toHaveProperty("answers.animationType");
      expect(saved).not.toHaveProperty("answers.framesPerDirection");
    });
    const animationSummary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(animationSummary).getByText("Richtungsset").nextElementSibling).toHaveTextContent(
      "8 Richtungen",
    );
    expect(within(animationSummary).getByText("Animationen").nextElementSibling).toHaveTextContent(
      "Idle · 3 Frames; Bewegung · 6 Frames",
    );
  });

  it("animates and resumes a floating crystal without creating directions", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const rendered = renderStudio({ storage });

    await user.type(projectNameInput(), "Schwebender Resonanzkristall");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Bewegliches Objekt/, "floatingCrystal");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Objekt und Bewegung")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByText("Schwebendes Objekt", { selector: "output" })).toBeVisible();
    expect(screen.getByText("Keine Richtungsansichten")).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Bewegungsart" }), "hover");
    await user.selectOptions(screen.getByRole("combobox", { name: "Hauptmaterial" }), "magic");
    await user.selectOptions(screen.getByRole("combobox", { name: "Lichtverhalten" }), "emissive");

    await waitFor(
      () =>
        expect(readValidDraft(createV2StorageAdapter(storage))).toMatchObject({
          currentStep: "movingObjectDetails",
          answers: {
            objectClass: "floatingObject",
            movementType: "hover",
            material: "magic",
            lightingBehavior: "emissive",
          },
        }),
      { timeout: 6_000 },
    );

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      await screen.findByRole(
        "heading",
        {
          level: 2,
          name: "Bewegung und Animation",
        },
        { timeout: 5_000 },
      ),
    ).toHaveFocus();
    expect(screen.queryByRole("radio", { name: /Richtungen/ })).not.toBeInTheDocument();
    expect(
      screen.getByText("Sequenzen erhalten eigene Frames, ohne Richtungsansichten zu erzeugen."),
    ).toBeVisible();
    await user.click(screen.getByRole("checkbox", { name: "Pulsieren aktivieren" }));
    const pulseFrames = screen.getByRole("spinbutton", {
      name: "Frames für Pulsieren",
    });
    await user.clear(pulseFrames);
    await user.type(pulseFrames, "7");

    await waitFor(() => {
      const saved = readValidDraft(createV2StorageAdapter(storage));
      expect(saved).toMatchObject({
        currentStep: "animation",
        category: "movingObject",
        subtype: "floatingCrystal",
        answers: {
          objectClass: "floatingObject",
          movementType: "hover",
          material: "magic",
          lightingBehavior: "emissive",
          animationSequences: [{ type: "pulse", frames: 7 }],
        },
      });
      expect(saved).not.toHaveProperty("answers.directionCount");
    });
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).getByText("Animationen").nextElementSibling).toHaveTextContent(
      "Pulsieren · 7 Frames",
    );

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Bewegung und Animation",
      }),
    ).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Pulsieren aktivieren" })).toBeChecked();
    expect(screen.getByRole("spinbutton", { name: "Frames für Pulsieren" })).toHaveValue(7);
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("validates category before subtype and focuses the missing classification field", async () => {
    const user = userEvent.setup();
    const { storage } = renderStudio();

    await user.type(projectNameInput(), "Klassifikation");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await user.click(screen.getByRole("button", { name: /Entwurf sichern|Schritt prüfen/ }));

    const firstCategory = screen.getByRole("radio", {
      name: /Charakter \/ Figur/,
    });
    expect(screen.getByText("Bitte wähle zuerst eine Asset-Kategorie.")).toBeVisible();
    expect(firstCategory).toHaveFocus();

    await user.click(firstCategory);
    await user.click(screen.getByRole("button", { name: /Entwurf sichern/ }));
    expect(screen.getByText("Bitte wähle einen Untertyp.")).toBeVisible();
    expect(screen.getByRole("combobox", { name: /Untertyp/ })).toHaveFocus();
    expect(draftWrites(storage)).toHaveLength(1);
  });

  it("selects an existing production family and exposes its inherited values before capability steps", async () => {
    const user = userEvent.setup();
    const { adapter } = renderStudio();

    await user.type(projectNameInput(), "Geerbte Hafenwache");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);

    const choice = await selectBaseProfile(user);
    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 80 px",
    });
    expect(choice).toBeChecked();
    expect(within(effectiveValues).getByRole("combobox", { name: "Pixelstil" })).toHaveValue(
      "modernHd",
    );
    expect(within(effectiveValues).getByRole("spinbutton", { name: "Tilegröße" })).toHaveValue(32);
    expect(
      within(effectiveValues).getByRole("spinbutton", {
        name: "Figurenhöhe",
      }),
    ).toHaveValue(80);
    expect(
      within(effectiveValues).getAllByText(
        "Quelle: Basisprofil „Weltfamilie 32 px / Figuren 80 px“",
      )[0],
    ).toBeVisible();
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        route: "wizard/profile",
        currentStep: "baseProfile",
        baseProfileId: "base_world_80",
      }),
    );

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Richtungen")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(readValidDraft(adapter)).toMatchObject({
      route: "wizard/editor",
      currentStep: "characterDetails",
      baseProfileId: "base_world_80",
      category: "character",
      subtype: "npc",
    });
    expect(readValidDraft(adapter)).not.toHaveProperty("overrides");
  });

  it("keeps the locked 80 px scale read-only and autosaves detailed character answers", async () => {
    const storage = populatedStorage(profileLibraryWithLockedCharacterHeight());
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });

    await user.type(projectNameInput(), "Kräuterhändlerin");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    const height = screen.getByRole("region", { name: "Figurenhöhe" });
    expect(within(height).getByRole("status", { name: "Figurenhöhe" })).toHaveTextContent("80 px");
    expect(within(height).getByText("Gesperrt")).toBeVisible();
    expect(
      within(height).getByText("Quelle: Basisprofil · Weltfamilie 32 px / Figuren 80 px"),
    ).toBeVisible();
    expect(screen.queryByRole("spinbutton", { name: "Figurenhöhe" })).not.toBeInTheDocument();

    await user.type(await chooseCustomText(user, "Rolle / Beruf"), "Kräuterhändlerin");
    await user.selectOptions(screen.getByRole("combobox", { name: "Alterswirkung" }), "older");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Haare" }),
      "Langes silbergraues Haar",
    );
    await user.type(await chooseCustomText(user, "Ausrüstung / Werkzeug"), "Kräuterkorb");

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        currentStep: "characterDetails",
        answers: {
          role: "Kräuterhändlerin",
          age: "older",
          hair: "Langes silbergraues Haar",
          equipment: "Kräuterkorb",
        },
      }),
    );
    const saved = readValidDraft(adapter);
    expect(saved).not.toHaveProperty("answers.characterHeight");
    expect(saved).not.toHaveProperty("overrides.characterHeight");
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Rolle / Beruf").nextElementSibling).toHaveTextContent(
      "Kräuterhändlerin",
    );
  });

  it("requires and stores an unlocked character height when the selected Base does not define one", async () => {
    const storage = populatedStorage(profileLibraryWithHeightlessBase());
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });

    await user.type(projectNameInput(), "Flexible Figurenfamilie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user, /^Unbenutztes Basisprofil/);

    const characterHeight = screen.getByRole("spinbutton", {
      name: "Figurenhöhe",
    });
    expect(characterHeight).toHaveValue(null);
    expect(
      within(screen.getByRole("navigation", { name: "Wizard-Fortschritt" })).queryByText(
        "Richtungen",
      ),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter|Entwurf sichern/ }));
    expect(
      screen.getByText("Für Figuren und figurähnliche Assets ist eine Figurenhöhe erforderlich."),
    ).toBeVisible();

    await user.type(characterHeight, "80");
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        baseProfileId: "base_unused",
        overrides: { characterHeight: 80 },
      }),
    );
    expect(
      within(screen.getByRole("navigation", { name: "Wizard-Fortschritt" })).getByText(
        "Richtungen",
      ),
    ).toBeVisible();
  });

  it("disables a character Base whose missing height is itself locked", async () => {
    const storage = populatedStorage(profileLibraryWithHeightlessBase(true));
    const user = userEvent.setup();
    renderStudio({ storage });

    await user.type(projectNameInput(), "Ungeeignete Figurenfamilie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);

    expect(baseProfileChoice(/^Unbenutztes Basisprofil/)).toBeDisabled();
    expect(screen.getByText(/Nicht kompatibel: gesperrte Figurenhöhe fehlt/)).toBeVisible();
  });

  it("normalizes an unlocked local override back to inheritance", async () => {
    const user = userEvent.setup();
    const { adapter } = renderStudio();

    await user.type(projectNameInput(), "Variable Tilefamilie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    const tileSize = screen.getByRole("spinbutton", { name: "Tilegröße" });
    await user.clear(tileSize);
    await user.type(tileSize, "48");
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        baseProfileId: "base_world_80",
        overrides: { tileSize: 48 },
      }),
    );
    expect(screen.getByText("Quelle: Lokaler Entwurf")).toBeVisible();

    await user.clear(tileSize);
    await user.type(tileSize, "32");
    await waitFor(() => expect(readValidDraft(adapter)).not.toHaveProperty("overrides.tileSize"));
    expect(
      screen.getAllByText("Quelle: Basisprofil „Weltfamilie 32 px / Figuren 80 px“")[0],
    ).toBeVisible();
  });

  it("labels an Asset override as local when it returns below a Category override to the Base value", async () => {
    const library = profileLibraryWithCategoryTileOverride();
    const storage = populatedStorage(library);
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    await enterBaseProfileStep(user);

    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 80 px",
    });
    const tileSize = within(effectiveValues).getByRole("spinbutton", {
      name: "Tilegröße",
    });
    expect(tileSize).toHaveValue(48);
    expect(within(effectiveValues).getByText("Quelle: Kategorieprofil „NPCs 80 px“")).toBeVisible();

    await user.clear(tileSize);
    await user.type(tileSize, "32");
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        overrides: { tileSize: 32 },
      }),
    );
    expect(within(effectiveValues).getByText("Quelle: Lokaler Entwurf")).toBeVisible();
  });

  it("keeps a locked inherited value unchanged when its conflict workflow is cancelled", async () => {
    const storage = populatedStorage(profileLibraryWithLockedTileSize());
    const originalBaseProfiles = storage.getItem(V2_STORAGE_KEYS.baseProfiles);
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });

    await user.type(projectNameInput(), "Gesperrte Tilefamilie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        baseProfileId: "base_world_80",
      }),
    );
    const draftBeforeConflict = storage.getItem(V2_STORAGE_KEYS.draft);

    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 80 px",
    });
    const conflictTrigger = within(effectiveValues).getByRole("button", {
      name: /Anderen Wert verwenden/,
    });
    await user.click(conflictTrigger);

    const conflict = screen.getByRole("alert", {
      name: "Tilegröße ist gesperrt",
    });
    expect(within(conflict).getByText(/vererbt diesen Wert verbindlich/)).toBeVisible();
    await user.click(within(conflict).getByRole("button", { name: "Abbrechen" }));

    await waitFor(() => expect(conflictTrigger).toHaveFocus());
    expect(screen.queryByRole("alert", { name: "Tilegröße ist gesperrt" })).not.toBeInTheDocument();
    expect(within(effectiveValues).getByText("32 × 32 px")).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.baseProfiles)).toBe(originalBaseProfiles);
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(draftBeforeConflict);
  });

  it("routes a wood texture to its focused material editor without duplicate capability steps", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const rendered = renderStudio({ storage });
    const { adapter } = rendered;

    await user.type(projectNameInput(), "Eichenplanken");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Textur \/ Material/, "wood");

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Basisprofil")).toBeVisible();
    expect(within(progress).queryByText("Textur und Material")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Kachelbarkeit")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Bewegung und Animation")).not.toBeInTheDocument();

    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    expect(within(progress).getByText("Textur und Material")).toBeVisible();
    expect(within(progress).queryByText("Kachelbarkeit")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Figur und Rolle")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Objekt und Bewegung")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Textur und Material" })).toBeVisible();
    expect(screen.queryByRole("radio", { name: /8 Richtungen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Animationsart" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Rolle oder Beruf/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Bewegungsart/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox", { name: "Einsatzbereich" }), "floor");
    await user.selectOptions(screen.getByRole("combobox", { name: "Nahtlos kachelbar?" }), "true");
    await user.selectOptions(screen.getByRole("combobox", { name: "Strukturgrad" }), "medium");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Oberflächenaufbau" }),
      "planked",
    );
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "texture",
        subtype: "wood",
        answers: {
          materialType: "wood",
          usage: "floor",
          seamless: true,
          structure: "medium",
          surface: "planked",
        },
      }),
    );
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Material").nextElementSibling).toHaveTextContent("Holz");
    expect(within(summary).getByText("Kachelbarkeit").nextElementSibling).toHaveTextContent(
      "Nahtlos",
    );
    expect(within(summary).getByText("Strukturgrad").nextElementSibling).toHaveTextContent(
      "Mittel",
    );
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Animationen")).not.toBeInTheDocument();

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Textur und Material" })).toBeVisible();
    expect(screen.getByText("Holz", { selector: "output" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Einsatzbereich" })).toHaveValue("floor");
    expect(screen.getByRole("combobox", { name: "Nahtlos kachelbar?" })).toHaveValue("true");
    expect(screen.getByRole("combobox", { name: "Strukturgrad" })).toHaveValue("medium");
    expect(screen.getByRole("combobox", { name: "Oberflächenaufbau" })).toHaveValue("planked");
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
    expect(screen.queryByText("Bewegung und Animation")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("autosaves and resumes a detailed wind tree without ever exposing directions", async () => {
    const user = userEvent.setup();
    const rendered = renderStudio();
    const { adapter, storage } = rendered;

    await user.type(projectNameInput(), "Windbaum");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Natur \/ Pflanze/, "tree");

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Basisprofil")).toBeVisible();
    expect(within(progress).queryByText("Bewegung und Animation")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    expect(within(progress).getByText("Pflanze und Natur")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Pflanze und Natur" })).toBeVisible();
    expect(screen.getByText("Baum", { selector: "output" })).toBeVisible();
    await user.type(await chooseCustomText(user, "Art / Spezies"), "Hüteeiche");
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Rinde, Verzweigung und Hohlräume",
      }),
      "Tiefe Rindenfurchen, niedrige Astansätze und ein kleiner Hohlraum",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Klimazone" }), "temperate");
    await user.selectOptions(screen.getByRole("combobox", { name: "Jahreszeit" }), "autumn");
    await user.selectOptions(screen.getByRole("combobox", { name: "Gesamtsilhouette" }), "broad");
    await user.selectOptions(screen.getByRole("combobox", { name: "Stammdicke" }), "massive");
    await user.selectOptions(screen.getByRole("combobox", { name: "Kronenform" }), "spreading");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Wurzelsichtbarkeit" }),
      "visible",
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Standfläche · Breite in Tiles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Standfläche · Breite in Tiles" }), "3");
    await user.clear(screen.getByRole("spinbutton", { name: "Standfläche · Tiefe in Tiles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Standfläche · Tiefe in Tiles" }), "2");

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "nature",
        subtype: "tree",
        currentStep: "natureDetails",
        answers: {
          plantType: "tree",
          species: "Hüteeiche",
          trunkDetails: "Tiefe Rindenfurchen, niedrige Astansätze und ein kleiner Hohlraum",
          climate: "temperate",
          season: "autumn",
          silhouette: "broad",
          trunkThickness: "massive",
          crownShape: "spreading",
          rootVisibility: "visible",
          footprint: { widthTiles: 3, depthTiles: 2 },
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      screen.getByText("Dieses Asset bleibt am Ort und kann trotzdem animiert sein."),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: /8 Richtungen/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Animationsart" }), "wind");

    await waitFor(() => {
      const draft = readValidDraft(adapter);
      expect(draft).toMatchObject({
        category: "nature",
        subtype: "tree",
        answers: { animationType: "wind" },
      });
      expect(draft).not.toHaveProperty("answers.directionCount");
    });

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Art").nextElementSibling).toHaveTextContent("Hüteeiche");
    expect(within(summary).getByText("Standfläche").nextElementSibling).toHaveTextContent(
      "3 × 2 Tiles",
    );
    expect(within(summary).getByText("Stammstärke").nextElementSibling).toHaveTextContent("Massiv");
    expect(within(summary).getByText("Kronenform").nextElementSibling).toHaveTextContent(
      "Ausladend",
    );
    expect(within(summary).getByText("Wurzeln").nextElementSibling).toHaveTextContent("Sichtbar");
    expect(
      within(summary).getByText("Animation", { selector: "dt" }).nextElementSibling,
    ).toHaveTextContent("Windbewegung");
    expect(within(summary).queryByText("Richtungsset")).not.toBeInTheDocument();

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Bewegung und Animation" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Animationsart" })).toHaveValue("wind");
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Pflanze und Natur" })).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Eigene Eingabe für Art / Spezies",
      }),
    ).toHaveValue("Hüteeiche");
    expect(
      screen.getByRole("combobox", {
        name: "Rinde, Verzweigung und Hohlräume",
      }),
    ).toHaveValue("Tiefe Rindenfurchen, niedrige Astansätze und ein kleiner Hohlraum");
    expect(
      screen.queryByRole("textbox", {
        name: "Eigene Eingabe für Rinde, Verzweigung und Hohlräume",
      }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Klimazone" })).toHaveValue("temperate");
    expect(screen.getByRole("spinbutton", { name: "Standfläche · Breite in Tiles" })).toHaveValue(
      3,
    );
  });

  it("keeps a mushroom in Nature details without animation or directions", async () => {
    const user = userEvent.setup();
    renderStudio();

    await user.type(projectNameInput(), "Waldpilz");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Natur \/ Pflanze/, "mushroom");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Pflanze und Natur")).toBeVisible();
    expect(within(progress).queryByText("Bewegung und Animation")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByText("Pilz", { selector: "output" })).toBeVisible();
    expect(screen.queryByText("Stamm und Rinde")).not.toBeInTheDocument();
    expect(screen.queryByText("Krone und Blattmasse")).not.toBeInTheDocument();
    expect(screen.queryByText("Wurzeln und Fußpunkt")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Animationsart" })).not.toBeInTheDocument();
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
  });

  it("autosaves and resumes a modular animated gate without directions or character scale", async () => {
    const user = userEvent.setup();
    const rendered = renderStudio();
    const { adapter, storage } = rendered;

    await user.type(projectNameInput(), "Nordtor");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Gebäude \/ Architektur/, "gate");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Gebäude und Architektur")).toBeVisible();
    expect(within(progress).getByText("Bewegung und Animation")).toBeVisible();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Gebäude und Architektur" }),
    ).toBeVisible();
    expect(screen.getByText("Torbau", { selector: "output" })).toBeVisible();
    expect(screen.getByText("32 × 32 px", { selector: "output" })).toBeVisible();
    expect(screen.queryByLabelText(/Figurenhöhe/i)).not.toBeInTheDocument();

    await user.type(
      await chooseCustomText(user, "Nutzung und Bewohnerrolle"),
      "Bewachter Stadteingang",
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Größenklasse" }), "large");
    await user.clear(screen.getByRole("spinbutton", { name: "Footprint · Breite in Tiles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Footprint · Breite in Tiles" }), "4");
    await user.clear(screen.getByRole("spinbutton", { name: "Footprint · Tiefe in Tiles" }));
    await user.type(screen.getByRole("spinbutton", { name: "Footprint · Tiefe in Tiles" }), "2");
    await user.selectOptions(screen.getByRole("combobox", { name: "Hauptmaterial" }), "stone");
    await user.selectOptions(screen.getByRole("combobox", { name: "Dachform" }), "gable");
    await user.selectOptions(screen.getByRole("combobox", { name: "Fassadenaufbau" }), "fortified");
    await user.type(screen.getByRole("spinbutton", { name: "Anzahl Türen / Tore" }), "1");
    await user.type(screen.getByRole("spinbutton", { name: "Anzahl Fenster" }), "4");
    await user.selectOptions(screen.getByRole("combobox", { name: "Mapping-Modus" }), "modularSet");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Modularer Ausgabesatz" }),
      "true",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Lokale Gebäudebeleuchtung" }),
      "visibleSources",
    );

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "building",
        subtype: "gate",
        currentStep: "buildingDetails",
        answers: {
          buildingType: "gate",
          purpose: "Bewachter Stadteingang",
          size: "large",
          footprint: { widthTiles: 4, depthTiles: 2 },
          primaryMaterial: "stone",
          roofShape: "gable",
          facadeStyle: "fortified",
          doorCount: 1,
          windowCount: 4,
          mappingMode: "modularSet",
          modular: true,
          lighting: "visibleSources",
        },
      }),
    );
    expect(readValidDraft(adapter)).not.toHaveProperty("answers.directionCount");
    expect(readValidDraft(adapter)).not.toHaveProperty("answers.characterHeight");

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      screen.getByText("Dieses Asset bleibt am Ort und kann trotzdem animiert sein."),
    ).toBeVisible();
    expect(screen.queryByRole("radio", { name: /8 Richtungen/ })).not.toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Animationsart" }), "openClose");

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "building",
        subtype: "gate",
        currentStep: "animation",
        answers: { animationType: "openClose" },
      }),
    );

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Bewegung und Animation" })).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Animationsart" })).toHaveValue("openClose");
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Gebäude und Architektur" }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Eigene Eingabe für Nutzung und Bewohnerrolle",
      }),
    ).toHaveValue("Bewachter Stadteingang");
    expect(screen.getByRole("spinbutton", { name: "Footprint · Breite in Tiles" })).toHaveValue(4);
  });

  it("autosaves and resumes a structured autotile with calculated atlas metrics", async () => {
    const user = userEvent.setup();
    const rendered = renderStudio();
    const { adapter, storage } = rendered;

    await user.type(projectNameInput(), "Waldweg-Autotile");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Tileset \/ Mapping/, "autotile");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    const progress = screen.getByRole("navigation", {
      name: "Wizard-Fortschritt",
    });
    expect(within(progress).getByText("Tileset und Kartenelement")).toBeVisible();
    expect(within(progress).queryByText("Kachelbarkeit")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Richtungen")).not.toBeInTheDocument();
    expect(within(progress).queryByText("Bewegung und Animation")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(
      screen.getByRole("heading", { level: 2, name: "Tileset und Kartenelement" }),
    ).toBeVisible();
    expect(screen.getByText("Regelbasiertes Autotile", { selector: "output" })).toBeVisible();
    expect(screen.getByText("32 × 32 px", { selector: "output" })).toBeVisible();
    expect(screen.queryByLabelText(/Figurenhöhe/i)).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Einsatz im Mapping" }),
      "transition",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Kantenset" }),
      "cardinalAndDiagonal",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Innen-/Außenecken" }),
      "innerAndOuter",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Übergangslogik" }),
      "bidirectional",
    );
    await user.type(await chooseCustomText(user, "Ausgangsmaterial"), "Waldgras");
    await user.type(await chooseCustomText(user, "Nachbarmaterial"), "Steinweg");
    await user.selectOptions(screen.getByRole("combobox", { name: "Kachelbare Achsen" }), "both");
    await user.selectOptions(screen.getByRole("combobox", { name: "Seam-Regel" }), "matchedEdges");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Wiederholungsmuster" }),
      "randomized",
    );
    await user.type(screen.getByRole("spinbutton", { name: "Varianten pro Zustand" }), "3");
    await user.click(screen.getByRole("checkbox", { name: "Saubere Basisvariante" }));
    await user.click(screen.getByRole("checkbox", { name: "Beschädigte Variante" }));
    await user.click(screen.getByRole("checkbox", { name: "Dekorierte Variante" }));
    await user.type(screen.getByRole("spinbutton", { name: "Atlas-Tiles insgesamt" }), "47");
    await user.selectOptions(screen.getByRole("combobox", { name: "Atlaslayout" }), "fixedColumns");
    await user.type(screen.getByRole("spinbutton", { name: "Feste Spaltenzahl" }), "8");
    await user.type(screen.getByRole("spinbutton", { name: "Zwischenraum in Pixeln" }), "1");
    await user.type(screen.getByRole("spinbutton", { name: "Außenrand in Pixeln" }), "2");

    expect(screen.getByText("8 × 6 Zellen")).toBeVisible();
    expect(screen.getByText("267 × 201 px")).toBeVisible();
    expect(screen.getByText("47 von 48 Slots")).toBeVisible();

    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        category: "tileset",
        subtype: "autotile",
        currentStep: "tilesetDetails",
        answers: {
          tilesetType: "autotile",
          tileUsage: "transition",
          edgeSet: "cardinalAndDiagonal",
          cornerSet: "innerAndOuter",
          transitionMode: "bidirectional",
          sourceMaterial: "Waldgras",
          targetMaterial: "Steinweg",
          seamMode: "matchedEdges",
          tileableAxes: "both",
          repeatMode: "randomized",
          variantCount: 3,
          variantKinds: ["clean", "damaged", "decorated"],
          atlasLayout: "fixedColumns",
          atlasTileCount: 47,
          atlasColumns: 8,
          atlasGutterPixels: 1,
          atlasMarginPixels: 2,
        },
      }),
    );
    expect(readValidDraft(adapter)).not.toHaveProperty("answers.directionCount");
    expect(readValidDraft(adapter)).not.toHaveProperty("answers.characterHeight");

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(
      screen.getByRole("heading", { level: 2, name: "Tileset und Kartenelement" }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: "Einsatz im Mapping" })).toHaveValue("transition");
    expect(screen.getByRole("combobox", { name: "Kantenset" })).toHaveValue("cardinalAndDiagonal");
    expect(screen.getByRole("combobox", { name: "Innen-/Außenecken" })).toHaveValue(
      "innerAndOuter",
    );
    expect(
      screen.getByRole("textbox", {
        name: "Eigene Eingabe für Ausgangsmaterial",
      }),
    ).toHaveValue("Waldgras");
    expect(screen.getByRole("spinbutton", { name: "Atlas-Tiles insgesamt" })).toHaveValue(47);
    expect(screen.getByRole("combobox", { name: "Atlaslayout" })).toHaveValue("fixedColumns");
    expect(screen.getByRole("spinbutton", { name: "Feste Spaltenzahl" })).toHaveValue(8);
    expect(screen.getByText("267 × 201 px")).toBeVisible();
    expect(screen.queryByText("Richtungen")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("goes back without a validation barrier and restores resumed form values", async () => {
    const draft = categoryDraft();
    const storage = new MemoryStorage();
    storeDraft(storage, draft);
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Bildart" })).toBeVisible();
    expect(storage.mutations).toEqual([]);
    await user.click(screen.getByRole("button", { name: /Zurück/ }));

    const heading = screen.getByRole("heading", { level: 2, name: "Projekt" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(projectNameInput()).toHaveValue("Winterwald");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(readValidDraft(adapter)).toMatchObject({
      draftId: draft.draftId,
      projectName: "Winterwald",
      route: "wizard/project",
      currentStep: "project",
    });
  });

  it("debounces rapid valid edits into exactly one autosave", async () => {
    const user = userEvent.setup();
    const { adapter, storage } = renderStudio();

    await user.type(projectNameInput(), "Nebelwald");
    expect(screen.getByText("Ungesicherte Änderungen.")).toBeVisible();
    expect(draftWrites(storage)).toEqual([]);

    await waitFor(() =>
      expect(draftWrites(storage)).toEqual([{ operation: "set", key: V2_STORAGE_KEYS.draft }]),
    );
    expect(readValidDraft(adapter)).toMatchObject({
      projectName: "Nebelwald",
      currentStep: "project",
      savedAt: SAVED_TIMESTAMP,
    });
    expect(screen.getByText("Entwurf wurde lokal gesichert.")).toBeVisible();

    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));
    expect(draftWrites(storage)).toHaveLength(1);
  });

  it("keeps a failed autosave visible, dirty, and available after a view remount", async () => {
    const user = userEvent.setup();
    const storage = new MemoryStorage();
    storage.failSetFor = V2_STORAGE_KEYS.draft;
    const { navigation } = renderStudio({ storage });

    await user.type(projectNameInput(), "Flüchtige Schmiede");

    const failure = await screen.findByRole("alert");
    expect(failure).toHaveAttribute("data-status", "failed");
    expect(failure).toHaveTextContent("Der lokale Speicher ist nicht verfügbar");
    expect(projectNameInput()).toHaveValue("Flüchtige Schmiede");
    expect(draftWrites(storage)).toEqual([]);

    await user.click(within(primaryNavigation()).getByRole("button", { name: "Dashboard" }));
    await user.click(within(primaryNavigation()).getByRole("button", { name: "Wizard" }));

    expect(projectNameInput()).toHaveValue("Flüchtige Schmiede");
    expect(screen.getByText("Ungesicherte Änderungen.")).toBeVisible();
    expect(navigation.pushedViews).toEqual(["dashboard", "wizard"]);
    expect(draftWrites(storage)).toEqual([]);
  });

  it("keeps an invalid raw profile project name dirty across view remounts without persisting it", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    await user.click(screen.getByRole("button", { name: /Zurück/ }));

    expect(projectNameInput()).toHaveValue("Dorfschmied mit Lederschürze");
    expect(draftWrites(storage)).toHaveLength(1);
    expect(readValidDraft(adapter)).toMatchObject({
      projectName: "Dorfschmied mit Lederschürze",
      currentStep: "project",
    });
    const validStoredDraft = storage.getItem(V2_STORAGE_KEYS.draft);

    await user.clear(projectNameInput());

    expect(projectNameInput()).toHaveValue("");
    expect(screen.getByText("Ungesicherte Änderungen.")).toBeVisible();
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(validStoredDraft);
    expect(draftWrites(storage)).toHaveLength(1);

    await user.click(within(primaryNavigation()).getByRole("button", { name: "Dashboard" }));
    await user.click(within(primaryNavigation()).getByRole("button", { name: "Wizard" }));

    expect(projectNameInput()).toHaveValue("");
    expect(screen.getByText("Ungesicherte Änderungen.")).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(validStoredDraft);
    expect(readValidDraft(adapter)).toMatchObject({
      projectName: "Dorfschmied mit Lederschürze",
      currentStep: "project",
    });
    expect(draftWrites(storage)).toHaveLength(1);
  });

  it("resumes the exact requested draft without a mount write and keeps its value", async () => {
    const draft = categoryDraft();
    const storage = new MemoryStorage();
    storeDraft(storage, draft);
    const { user, rendered } = await beginVisibleDashboardDraft(storage);

    await user.click(screen.getByRole("button", { name: /Entwurf fortsetzen/i }));

    expect(screen.getByText("Fortgesetzter Entwurf")).toBeVisible();
    expect(screen.getByText("Lokal gespeichert")).toBeVisible();
    expect(screen.getByRole("heading", { level: 2, name: "Bildart" })).toBeVisible();
    expect(rendered.navigation.pushedViews).toEqual(["wizard"]);
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(projectNameInput()).toHaveValue("Winterwald");
  });

  it("resumes canonical character data on its editor step without a mount write", () => {
    vi.useFakeTimers();
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_character_resume",
      projectName: "Nordtorwache",
      route: "wizard/editor",
      currentStep: "characterDetails",
      baseProfileId: "base_world_80",
      category: "character",
      subtype: "npc",
      answers: {
        role: "Torwache",
        hair: "kurzer dunkler Zopf",
        silhouette: "breiter Schild und hoher Helm",
        directionCount: 8,
        animationActions: [
          { action: "idle", frames: 2 },
          { action: "walk", frames: 5 },
        ],
      },
      validation: { errors: [], warnings: [] },
      savedAt: INITIAL_TIMESTAMP,
    });
    const storage = populatedStorage();
    storeDraft(storage, draft);

    renderStudio({ storage });
    act(() => vi.advanceTimersByTime(1_000));

    expect(screen.getByRole("heading", { level: 2, name: "Figur und Rolle" })).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Eigene Eingabe für Rolle / Beruf",
      }),
    ).toHaveValue("Torwache");
    expect(screen.getByRole("textbox", { name: "Eigene Eingabe für Haare" })).toHaveValue(
      "kurzer dunkler Zopf",
    );
    expect(screen.getByRole("status", { name: "Figurenhöhe" })).toHaveTextContent("80 px");
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Torwache")).toBeVisible();
    expect(within(summary).getByText("8 Richtungen")).toBeVisible();
    expect(within(summary).getByText("Idle · 2 Frames; Walk · 5 Frames")).toBeVisible();
    expect(storage.mutations).toEqual([]);
  });

  it("derives the Character height source from normalized profile resolution", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_character_redundant_height",
      projectName: "Redundante Figurenhöhe",
      route: "wizard/editor",
      currentStep: "characterDetails",
      baseProfileId: "base_world_80",
      category: "character",
      subtype: "npc",
      overrides: { characterHeight: 80 },
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: INITIAL_TIMESTAMP,
    });
    const storage = populatedStorage();
    storeDraft(storage, draft);

    renderStudio({ storage });

    expect(
      screen.getByText("Quelle: Basisprofil · Weltfamilie 32 px / Figuren 80 px"),
    ).toBeVisible();
    expect(screen.queryByText(/Quelle: Lokaler Entwurf ·/)).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("resumes a selected pre-base Draft on the required Base-profile step without writing", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_pre_base_tree",
      projectName: "Windbaum",
      route: "wizard/profile",
      currentStep: "animation",
      category: "nature",
      subtype: "tree",
      answers: { animationType: "wind" },
      validation: { errors: [], warnings: [] },
      savedAt: INITIAL_TIMESTAMP,
    });
    const storage = populatedStorage();
    storeDraft(storage, draft);

    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Basisprofil" })).toBeVisible();
    expect(
      within(screen.getByRole("group", { name: "Produktionsfamilie auswählen" })).queryByRole(
        "radio",
        { checked: true },
      ),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Animationsart" })).not.toBeInTheDocument();
    expect(
      within(
        screen.getByRole("complementary", {
          name: "Technische Zusammenfassung",
        }),
      ).getByText("Natur / Pflanze"),
    ).toBeVisible();
    expect(
      within(screen.getByRole("navigation", { name: "Wizard-Fortschritt" })).queryByText(
        "Bewegung und Animation",
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entwurf sichern|Schritt prüfen/ })).toBeVisible();
    expect(screen.queryByText(/sicher fortgesetzt/)).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("blocks Base-profile selection when the stored library is corrupt and leaves it untouched", () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_pre_base_corrupt_library",
      projectName: "Sicherer Vorstufenentwurf",
      route: "wizard/profile",
      currentStep: "baseProfile",
      category: "texture",
      subtype: "wood",
      answers: {},
      validation: { errors: [], warnings: [] },
      savedAt: INITIAL_TIMESTAMP,
    });
    const storage = populatedStorage();
    storeDraft(storage, draft);
    const corruptProfiles = "{broken-base-profile-library";
    storage.values.set(V2_STORAGE_KEYS.baseProfiles, corruptProfiles);

    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Basisprofil" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Basisprofile konnten nicht sicher gelesen werden",
    );
    expect(
      screen.queryByRole("group", { name: "Produktionsfamilie auswählen" }),
    ).not.toBeInTheDocument();
    expect(storage.getItem(V2_STORAGE_KEYS.baseProfiles)).toBe(corruptProfiles);
    expect(storage.mutations).toEqual([]);
  });

  it("rejects a different stored draft than the exact resume request without mutating it", async () => {
    const requested = categoryDraft();
    const storage = new MemoryStorage();
    storeDraft(storage, requested);
    const { user } = await beginVisibleDashboardDraft(storage);
    const actual = categoryDraft({ draftId: "draft_resume_other" });
    storage.values.set(V2_STORAGE_KEYS.draft, JSON.stringify(actual));

    await user.click(screen.getByRole("button", { name: /Entwurf fortsetzen/i }));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Entwurf kann nicht sicher fortgesetzt werden",
      }),
    ).toBeVisible();
    expect(screen.getByText(/gehört nicht zur angeforderten Draft-ID/)).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(JSON.stringify(actual));
    expect(storage.mutations).toEqual([]);
  });

  it("leaves an invalid requested draft untouched in recovery", async () => {
    const storage = new MemoryStorage();
    storeDraft(storage, categoryDraft());
    const { user } = await beginVisibleDashboardDraft(storage);
    const corruptDraft = "{broken-wizard-draft";
    storage.values.set(V2_STORAGE_KEYS.draft, corruptDraft);

    await user.click(screen.getByRole("button", { name: /Entwurf fortsetzen/i }));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Gespeicherter Entwurf ist beschädigt",
      }),
    ).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(corruptDraft);
    expect(storage.mutations).toEqual([]);
  });

  it("starts a new transient draft from recovery and returns focus to the AppShell main", async () => {
    const storage = new MemoryStorage();
    const corruptDraft = "{broken-wizard-draft";
    storage.values.set(V2_STORAGE_KEYS.draft, corruptDraft);
    const user = userEvent.setup();
    renderStudio({ storage });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Gespeicherter Entwurf ist beschädigt",
      }),
    ).toBeVisible();
    const main = screen.getByRole("main");

    await user.click(
      screen.getByRole("button", {
        name: "Neuen flüchtigen Entwurf beginnen",
      }),
    );

    await waitFor(() => expect(main).toHaveFocus());
    expect(screen.getByRole("heading", { level: 2, name: "Projekt" })).toBeVisible();
    expect(projectNameInput()).toHaveValue("");
    expect(screen.getByText("Dieser Start wurde noch nicht lokal gesichert.")).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        level: 2,
        name: "Gespeicherter Entwurf ist beschädigt",
      }),
    ).not.toBeInTheDocument();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(corruptDraft);
    expect(storage.mutations).toEqual([]);
  });

  it("reports a requested draft that disappeared before resume without writing or removing", async () => {
    const storage = new MemoryStorage();
    storeDraft(storage, categoryDraft());
    const { user } = await beginVisibleDashboardDraft(storage);
    storage.values.delete(V2_STORAGE_KEYS.draft);

    await user.click(screen.getByRole("button", { name: /Entwurf fortsetzen/i }));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Entwurf wurde nicht gefunden",
      }),
    ).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBeNull();
    expect(storage.mutations).toEqual([]);
  });

  it("recovers from a missing selected-profile reference without replacing the draft", async () => {
    const draft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_missing_base",
      projectName: "Verwaiste Wache",
      route: "wizard/profile",
      currentStep: "category",
      baseProfileId: "base_missing",
      category: "character",
      subtype: "npc",
      answers: { role: "guard" },
      validation: { errors: [], warnings: [] },
      savedAt: INITIAL_TIMESTAMP,
    });
    const storage = new MemoryStorage();
    storeDraft(storage, draft);
    const { user } = await beginVisibleDashboardDraft(storage);

    await user.click(screen.getByRole("button", { name: /Entwurf fortsetzen/i }));

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Entwurf kann nicht sicher fortgesetzt werden",
      }),
    ).toBeVisible();
    expect(screen.getByText("Das referenzierte Basisprofil fehlt.")).toBeVisible();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(JSON.stringify(draft));
    expect(storage.mutations).toEqual([]);
  });

  it("resets a dirty session when Neues Asset is used in the active Wizard view", async () => {
    const user = userEvent.setup();
    const createDraftId = vi
      .fn<() => string>()
      .mockReturnValueOnce("draft_same_view_first")
      .mockReturnValueOnce("draft_same_view_second");
    const { adapter, navigation, storage } = renderStudio({ createDraftId });

    await user.type(projectNameInput(), "Alter Entwurf");
    expect(screen.getByText("Ungesicherte Änderungen.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Neues Asset" }));

    expect(projectNameInput()).toHaveValue("");
    expect(screen.getByText("Dieser Start wurde noch nicht lokal gesichert.")).toBeVisible();
    expect(storage.mutations).toEqual([]);
    expect(navigation.pushedViews).toEqual([]);
    expect(createDraftId).toHaveBeenCalledTimes(2);

    await user.type(projectNameInput(), "Neuer Entwurf");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 350)));
    expect(draftWrites(storage)).toHaveLength(1);
    expect(readValidDraft(adapter)).toMatchObject({
      draftId: "draft_same_view_second",
      projectName: "Neuer Entwurf",
    });
  });

  it("starts from an exact profile through its selected Base profile without dropping portable data", async () => {
    const library = profileLibraryWithTechnicalOverrides();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
    if (!source) throw new Error("Expected the overridden smith profile.");
    const storage = populatedStorage(library);
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );

    expect(screen.getByText("Profil · Dorfschmied mit Lederschürze")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Charakter \/ Figur/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Untertyp/ })).toHaveValue("npc");
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Charakter / Figur")).toBeVisible();
    expect(within(summary).getByText("48 × 48 px")).toBeVisible();
    expect(within(summary).getByText("80 px")).toBeVisible();
    expect(within(summary).getByText("Warmes Innenlicht")).toBeVisible();
    expect(within(summary).getByText("blacksmith")).toBeVisible();
    expect(document.body.innerHTML).not.toContain(source.compatibilityKey);
    expect(storage.mutations).toEqual([]);

    await enterBaseProfileStep(user);
    expect(baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 80 px/)).toBeChecked();
    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 80 px",
    });
    expect(within(effectiveValues).getByRole("spinbutton", { name: "Tilegröße" })).toHaveValue(48);
    expect(
      within(effectiveValues).getByRole("spinbutton", {
        name: "Figurenhöhe",
      }),
    ).toHaveValue(80);

    expect(draftWrites(storage)).toEqual([{ operation: "set", key: V2_STORAGE_KEYS.draft }]);
    expect(readValidDraft(adapter)).toMatchObject({
      sourceAssetProfileId: source.id,
      baseProfileId: source.baseProfileId,
      categoryProfileId: source.categoryProfileId,
      category: source.category,
      subtype: source.subtype,
      answers: {
        role: "blacksmith",
        animationActions: [{ action: "walk", frames: 5 }],
      },
      overrides: source.overrides,
    });

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Figur und Rolle" })).toBeVisible();
    expect(
      screen.getByRole("textbox", {
        name: "Eigene Eingabe für Rolle / Beruf",
      }),
    ).toHaveValue("blacksmith");
  });

  it("persists clearing inherited Character animations without restoring them on resume", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const rendered = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    await enterBaseProfileStep(user);
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await user.click(screen.getByRole("button", { name: /Weiter/ }));

    const walk = screen.getByRole("checkbox", { name: "Walk aktivieren" });
    expect(walk).toBeChecked();
    await user.click(walk);

    await waitFor(() => {
      const saved = createV2StorageAdapter(storage).readDraft();
      expect(saved.status).toBe("valid");
      if (saved.status !== "valid") return;
      expect(saved.value).toMatchObject({
        currentStep: "animation",
        answers: { role: "blacksmith", directionCount: 8 },
      });
      expect(saved.value).not.toHaveProperty("categoryProfileId");
      expect(saved.value).not.toHaveProperty("sourceAssetProfileId");
      expect(saved.value).not.toHaveProperty("answers.animationActions");
    });
    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Animationen").nextElementSibling).toHaveTextContent(
      "Noch nicht ausgewählt",
    );

    rendered.unmount();
    storage.mutations.splice(0);
    renderStudio({ storage });

    expect(screen.getByRole("heading", { level: 2, name: "Bewegung und Animation" })).toBeVisible();
    expect(screen.getByRole("checkbox", { name: "Walk aktivieren" })).not.toBeChecked();
    expect(storage.mutations).toEqual([]);
  });

  it("requires confirmation before moving a profile start to another production family", async () => {
    const library = profileLibraryWithTechnicalOverrides();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
    if (!source) throw new Error("Expected the overridden smith profile.");
    const storage = populatedStorage(library);
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    await enterBaseProfileStep(user);

    const currentChoice = baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 80 px/);
    const nextChoice = baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 96 px/);
    expect(currentChoice).toBeChecked();
    const storedBeforeRequest = storage.getItem(V2_STORAGE_KEYS.draft);
    const writesBeforeRequest = draftWrites(storage).length;

    await user.click(nextChoice);

    const confirmation = screen.getByRole("alert", {
      name: "Produktionsfamilie wechseln?",
    });
    expect(currentChoice).toBeChecked();
    expect(nextChoice).not.toBeChecked();
    expect(storage.getItem(V2_STORAGE_KEYS.draft)).toBe(storedBeforeRequest);
    expect(draftWrites(storage)).toHaveLength(writesBeforeRequest);

    await user.click(
      within(confirmation).getByRole("button", {
        name: "Zu „Weltfamilie 32 px / Figuren 96 px“ wechseln",
      }),
    );

    expect(nextChoice).toBeChecked();
    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 96 px",
    });
    expect(within(effectiveValues).getByRole("spinbutton", { name: "Tilegröße" })).toHaveValue(32);
    expect(
      within(effectiveValues).getByRole("spinbutton", {
        name: "Figurenhöhe",
      }),
    ).toHaveValue(96);

    await waitFor(() => {
      const switched = readValidDraft(adapter);
      expect(switched).toMatchObject({
        baseProfileId: "base_world_96",
        category: source.category,
        subtype: source.subtype,
        answers: {
          role: "blacksmith",
          directionCount: 8,
          animationActions: [{ action: "walk", frames: 5 }],
        },
      });
      expect(switched).not.toHaveProperty("categoryProfileId");
      expect(switched).not.toHaveProperty("sourceAssetProfileId");
      expect(switched).not.toHaveProperty("overrides");
    });

    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    const switched = readValidDraft(adapter);
    expect(switched).toMatchObject({
      baseProfileId: "base_world_96",
      category: source.category,
      subtype: source.subtype,
      answers: {
        role: "blacksmith",
        directionCount: 8,
        animationActions: [{ action: "walk", frames: 5 }],
      },
    });
    expect(switched).not.toHaveProperty("categoryProfileId");
    expect(switched).not.toHaveProperty("sourceAssetProfileId");
    expect(switched).not.toHaveProperty("overrides");
  });

  it("creates selectable standalone families through duplicate and new workflows", async () => {
    const createBaseProfileId = vi
      .fn<() => string>()
      .mockReturnValueOnce("base_wizard_copy_001")
      .mockReturnValueOnce("base_wizard_new_001");
    const user = userEvent.setup();
    const { adapter } = renderStudio({ createBaseProfileId });

    await user.type(projectNameInput(), "Neue Produktionslinien");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);

    await user.click(
      screen.getByRole("button", {
        name: "Ausgewähltes Basisprofil duplizieren",
      }),
    );
    const duplicateEditor = screen.getByRole("region", {
      name: "„Weltfamilie 32 px / Figuren 80 px“ duplizieren",
    });
    const duplicateName = within(duplicateEditor).getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    expect(duplicateName).toHaveValue("Weltfamilie 32 px / Figuren 80 px (Kopie)");
    await user.clear(duplicateName);
    await user.type(duplicateName, "Eigenständige 48-px-Familie");
    const duplicateTileSize = within(duplicateEditor).getByRole("spinbutton", {
      name: "Tilegröße in Pixeln",
    });
    await user.clear(duplicateTileSize);
    await user.type(duplicateTileSize, "48");
    await user.click(
      within(duplicateEditor).getByRole("button", {
        name: "Basisprofil anlegen",
      }),
    );

    expect(
      await screen.findByText(
        "Basisprofil „Eigenständige 48-px-Familie“ wurde angelegt und ausgewählt.",
      ),
    ).toBeVisible();
    expect(baseProfileChoice(/^Eigenständige 48-px-Familie/)).toBeChecked();
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        baseProfileId: "base_wizard_copy_001",
      }),
    );
    let library = readValidProfileLibrary(adapter);
    expect(
      library.baseProfiles.find((profile) => profile.id === "base_wizard_copy_001"),
    ).toMatchObject({
      name: "Eigenständige 48-px-Familie",
      values: { tileSize: 48 },
    });
    expect(library.baseProfiles.find((profile) => profile.id === "base_world_80")).toMatchObject({
      values: { tileSize: 32 },
    });

    await user.click(screen.getByRole("button", { name: "Neue kanonische Familie" }));
    const newEditor = screen.getByRole("region", {
      name: "Kanonisches Basisprofil anlegen",
    });
    const newName = within(newEditor).getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    await user.clear(newName);
    await user.type(newName, "Neue kanonische Waldwelt");
    await user.click(within(newEditor).getByRole("button", { name: "Basisprofil anlegen" }));

    expect(
      await screen.findByText(
        "Basisprofil „Neue kanonische Waldwelt“ wurde angelegt und ausgewählt.",
      ),
    ).toBeVisible();
    expect(baseProfileChoice(/^Neue kanonische Waldwelt/)).toBeChecked();
    await waitFor(() =>
      expect(readValidDraft(adapter)).toMatchObject({
        baseProfileId: "base_wizard_new_001",
      }),
    );
    library = readValidProfileLibrary(adapter);
    expect(
      library.baseProfiles.find((profile) => profile.id === "base_wizard_new_001"),
    ).toMatchObject({
      name: "Neue kanonische Waldwelt",
      values: { tileSize: 32, characterHeight: 80 },
    });
    expect(createBaseProfileId).toHaveBeenCalledTimes(2);
  });

  it("confirms production-family deletion from its button or the Delete key", async () => {
    const library = createProfileLibraryFixture();
    const source = library.baseProfiles[0];
    if (!source) throw new Error("Expected a Base profile fixture.");
    const removable = parseBaseProfile({
      ...source,
      id: "base_removable_wizard_family",
      name: "Entfernbare Wizard-Familie",
      createdAt: SAVED_TIMESTAMP,
      updatedAt: SAVED_TIMESTAMP,
    });
    const storage = populatedStorage(
      ProfileLibrarySchema.parse({
        ...library,
        baseProfiles: [...library.baseProfiles, removable],
      }),
    );
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });

    await user.type(projectNameInput(), "Familie aufräumen");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);

    const choice = baseProfileChoice(/^Entfernbare Wizard-Familie/);
    const deleteButton = screen.getByRole("button", {
      name: "Produktionsfamilie „Entfernbare Wizard-Familie“ löschen",
    });
    await user.click(choice);
    expect(choice).toBeChecked();
    await user.click(deleteButton);
    let confirmation = screen.getByRole("alertdialog", {
      name: "Produktionsfamilie löschen?",
    });
    expect(confirmation).toHaveTextContent(
      "Abhängige Profile werden nie automatisch mitgelöscht oder umgehängt.",
    );
    await user.click(within(confirmation).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(deleteButton).toHaveFocus());

    choice.focus();
    await user.keyboard("{Delete}");
    confirmation = screen.getByRole("alertdialog", {
      name: "Produktionsfamilie löschen?",
    });
    await user.click(
      within(confirmation).getByRole("button", {
        name: "Produktionsfamilie endgültig löschen",
      }),
    );

    expect(
      screen.getByText("Produktionsfamilie „Entfernbare Wizard-Familie“ wurde gelöscht."),
    ).toBeVisible();
    expect(
      screen.queryByRole("radio", { name: /^Entfernbare Wizard-Familie/ }),
    ).not.toBeInTheDocument();
    expect(
      readValidProfileLibrary(adapter).baseProfiles.some((profile) => profile.id === removable.id),
    ).toBe(false);
    await waitFor(() => expect(readValidDraft(adapter)).not.toHaveProperty("baseProfileId"));
  });

  it("keeps referenced production families when deletion is confirmed", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const { adapter } = renderStudio({ storage });
    const before = readValidProfileLibrary(adapter);

    await user.type(projectNameInput(), "Geschützte Familie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await user.click(
      screen.getByRole("button", {
        name: "Produktionsfamilie „Weltfamilie 32 px / Figuren 80 px“ löschen",
      }),
    );
    const confirmation = screen.getByRole("alertdialog", {
      name: "Produktionsfamilie löschen?",
    });
    await user.click(
      within(confirmation).getByRole("button", {
        name: "Produktionsfamilie endgültig löschen",
      }),
    );

    expect(within(confirmation).getByRole("alert")).toHaveTextContent(
      /wird noch von \d+ Profilen verwendet und wurde nicht gelöscht/,
    );
    expect(readValidProfileLibrary(adapter)).toEqual(before);
  });

  it("rejects a newly locked character family with no character height before storage", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      createBaseProfileId: () => "base_invalid_locked_height",
      storage,
    });

    await user.type(projectNameInput(), "Validierte Figurenfamilie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    const before = readValidProfileLibrary(adapter);

    await user.click(screen.getByRole("button", { name: "Neue kanonische Familie" }));
    const editor = screen.getByRole("region", {
      name: "Kanonisches Basisprofil anlegen",
    });
    const name = within(editor).getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    await user.clear(name);
    await user.type(name, "Unvollständige Figurenfamilie");
    await user.clear(
      within(editor).getByRole("spinbutton", {
        name: "Figurenhöhe in Pixeln",
      }),
    );
    await user.click(
      within(editor).getByRole("checkbox", {
        name: "Figurenhöhe für Kindprofile sperren",
      }),
    );
    await user.click(within(editor).getByRole("button", { name: "Basisprofil anlegen" }));

    expect(
      within(editor).getByText(
        "Eine fehlende Figurenhöhe darf für diese Figurenfamilie nicht gesperrt werden.",
      ),
    ).toBeVisible();
    expect(readValidProfileLibrary(adapter)).toEqual(before);
    expect(
      within(screen.getByRole("group", { name: "Produktionsfamilie auswählen" })).queryByRole(
        "radio",
        { name: /Unvollständige Figurenfamilie/ },
      ),
    ).not.toBeInTheDocument();
  });

  it("keeps the library and Draft selection fail-closed when creating a family cannot be stored", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      createBaseProfileId: () => "base_write_failure_001",
      storage,
    });

    await user.type(projectNameInput(), "Fehlertolerante Familie");
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await selectAssetClassification(user, /Charakter \/ Figur/, "npc");
    await enterBaseProfileStep(user);
    await selectBaseProfile(user);
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Basisprofil" })).toBeVisible();
    expect(readValidDraft(adapter)).toMatchObject({
      baseProfileId: "base_world_80",
      currentStep: "baseProfile",
    });

    const originalLibrary = readValidProfileLibrary(adapter);
    const originalBaseNamespace = storage.getItem(V2_STORAGE_KEYS.baseProfiles);
    storage.failSetFor = V2_STORAGE_KEYS.baseProfiles;
    await user.click(screen.getByRole("button", { name: "Neue kanonische Familie" }));
    const editor = screen.getByRole("region", {
      name: "Kanonisches Basisprofil anlegen",
    });
    const name = within(editor).getByRole("textbox", {
      name: "Name der Produktionsfamilie",
    });
    await user.clear(name);
    await user.type(name, "Darf nicht erscheinen");
    await user.click(within(editor).getByRole("button", { name: "Basisprofil anlegen" }));

    expect(within(editor).getByRole("alert")).toHaveTextContent(
      "Basisprofil wurde nicht gespeichert. Der lokale Speicher ist nicht verfügbar.",
    );
    expect(
      within(screen.getByRole("group", { name: "Produktionsfamilie auswählen" })).queryByRole(
        "radio",
        { name: /Darf nicht erscheinen/ },
      ),
    ).not.toBeInTheDocument();
    expect(baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 80 px/)).toBeChecked();
    expect(storage.getItem(V2_STORAGE_KEYS.baseProfiles)).toBe(originalBaseNamespace);
    expect(readValidProfileLibrary(adapter)).toEqual(originalLibrary);
    expect(readValidDraft(adapter)).toMatchObject({
      baseProfileId: "base_world_80",
    });
  });

  it("confirms a main-category change and purges incompatible profile data", async () => {
    const library = profileLibraryWithTechnicalOverrides();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
    if (!source) throw new Error("Expected the overridden smith profile.");
    const storage = populatedStorage(library);
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    await user.click(screen.getByRole("radio", { name: /Textur \/ Material/ }));

    expect(screen.getByRole("alert")).toHaveTextContent("Kategorie wirklich wechseln?");
    expect(screen.getByRole("radio", { name: /Charakter \/ Figur/ })).toBeChecked();
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Zu Textur \/ Material wechseln/ }));
    expect(screen.getByRole("radio", { name: /Textur \/ Material/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Untertyp/ })).toHaveValue("");
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: /Zurück/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Projekt" })).toBeVisible();
    expect(storage.mutations).toEqual([]);
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Bildart" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Textur \/ Material/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Untertyp/ })).toHaveValue("");
    expect(storage.mutations).toEqual([]);

    await user.click(within(primaryNavigation()).getByRole("button", { name: "Dashboard" }));
    await user.click(within(primaryNavigation()).getByRole("button", { name: "Wizard" }));
    expect(screen.getByRole("radio", { name: /Textur \/ Material/ })).toBeChecked();
    expect(screen.getByRole("combobox", { name: /Untertyp/ })).toHaveValue("");
    expect(storage.mutations).toEqual([]);

    await user.selectOptions(screen.getByRole("combobox", { name: /Untertyp/ }), "wood");
    await enterBaseProfileStep(user);

    const changed = readValidDraft(adapter);
    expect(changed).toMatchObject({
      category: "texture",
      subtype: "wood",
      baseProfileId: source.baseProfileId,
      overrides: source.overrides,
      answers: {},
    });
    expect(changed).not.toHaveProperty("sourceAssetProfileId");
    expect(changed).not.toHaveProperty("categoryProfileId");
    expect(changed).not.toHaveProperty("answers.directionCount");
    expect(changed).not.toHaveProperty("answers.animationAction");
    expect(changed).not.toHaveProperty("answers.framesPerDirection");
    expect(baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 80 px/)).toBeChecked();
    expect(screen.queryByRole("heading", { level: 2, name: "Richtungen" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Weiter/ }));
    expect(screen.getByRole("heading", { level: 2, name: "Textur und Material" })).toBeVisible();
  });

  it("confirms a lossy subtype change before purging profile details", async () => {
    const library = profileLibraryWithTechnicalOverrides();
    const source = library.assetProfiles.find((profile) => profile.id === "asset_smith_80");
    if (!source) throw new Error("Expected the overridden smith profile.");
    const storage = populatedStorage(library);
    const user = userEvent.setup();
    const { adapter } = renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Dorfschmied mit Lederschürze“ im Wizard laden",
      }),
    );
    const subtypeSelect = screen.getByRole("combobox", { name: /Untertyp/ });
    await user.selectOptions(subtypeSelect, "hero");

    expect(screen.getByRole("alert")).toHaveTextContent("Untertyp wirklich wechseln?");
    expect(subtypeSelect).toHaveValue("npc");
    expect(storage.mutations).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(subtypeSelect).toHaveValue("npc");
    await user.selectOptions(subtypeSelect, "hero");
    await user.click(screen.getByRole("button", { name: "Zu Held wechseln" }));

    await waitFor(() => {
      const changed = readValidDraft(adapter);
      expect(changed).toMatchObject({
        category: "character",
        subtype: "hero",
        baseProfileId: source.baseProfileId,
        overrides: source.overrides,
        answers: {},
      });
      expect(changed).not.toHaveProperty("sourceAssetProfileId");
      expect(changed).not.toHaveProperty("categoryProfileId");
    });
  });

  it("renders technical values from a resumed portable Draft after its source Asset was deleted", () => {
    const fixture = portableProfileDraftFixture();
    const storage = populatedStorage(fixture.library);
    storeDraft(storage, fixture.draft);

    renderStudio({ storage });

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Dorfschmied mit Lederschürze")).toBeVisible();
    expect(within(summary).getByText("48 × 48 px")).toBeVisible();
    expect(within(summary).getByText("80 px")).toBeVisible();
    expect(within(summary).getByText("Warmes Innenlicht")).toBeVisible();
    expect(within(summary).queryByText("Assetprofil")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("shows recovery instead of applying a portable override rejected by a current Base lock", () => {
    const fixture = portableProfileDraftFixture();
    const base = fixture.library.baseProfiles.find(
      (profile) => profile.id === fixture.draft.baseProfileId,
    );
    if (!base) throw new Error("Expected the portable Draft Base profile.");
    const lockedBase = parseBaseProfile({
      ...base,
      locks: { ...base.locks, tileSize: true },
      updatedAt: SAVED_TIMESTAMP,
    });
    const currentLibrary = ProfileLibrarySchema.parse({
      ...fixture.library,
      baseProfiles: fixture.library.baseProfiles.map((profile) =>
        profile.id === lockedBase.id ? lockedBase : profile,
      ),
    });
    const storage = populatedStorage(currentLibrary);
    storeDraft(storage, fixture.draft);

    renderStudio({ storage });

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Entwurf kann nicht sicher fortgesetzt werden",
      }),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Ein gespeicherter Override widerspricht einer aktuell gesperrten Basisprofil-Regel.",
      ),
    ).toBeVisible();
    expect(
      screen.queryByRole("complementary", {
        name: "Technische Zusammenfassung",
      }),
    ).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);
  });

  it("omits grid, camera, and character dimensions for a free-composition Artwork profile", async () => {
    const storage = populatedStorage();
    const user = userEvent.setup();
    renderStudio({
      navigation: new MemoryNavigation({ status: "valid", view: "profiles" }),
      storage,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Profil „Nachtwald Key Art“ im Wizard laden",
      }),
    );

    const summary = screen.getByRole("complementary", {
      name: "Technische Zusammenfassung",
    });
    expect(within(summary).getByText("Artwork / Konzeptbild")).toBeVisible();
    expect(within(summary).getByText("Modern-HD")).toBeVisible();
    expect(within(summary).getByText("Kontextabhängig")).toBeVisible();
    expect(within(summary).queryByText("Tile-Raster")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Perspektive")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Projektion")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Kameraneigung")).not.toBeInTheDocument();
    expect(within(summary).queryByText("Figurenhöhe")).not.toBeInTheDocument();
    expect(storage.mutations).toEqual([]);

    await enterBaseProfileStep(user);
    expect(baseProfileChoice(/^Weltfamilie 32 px \/ Figuren 80 px/)).toBeChecked();
    const effectiveValues = screen.getByRole("region", {
      name: "Weltfamilie 32 px / Figuren 80 px",
    });
    expect(within(effectiveValues).getByRole("combobox", { name: "Pixelstil" })).toHaveValue(
      "modernHd",
    );
    expect(
      within(effectiveValues).queryByRole("spinbutton", { name: "Tilegröße" }),
    ).not.toBeInTheDocument();
    expect(
      within(effectiveValues).queryByRole("combobox", { name: "Perspektive" }),
    ).not.toBeInTheDocument();
    expect(
      within(effectiveValues).queryByRole("combobox", { name: "Projektion" }),
    ).not.toBeInTheDocument();
    expect(
      within(effectiveValues).queryByRole("spinbutton", {
        name: "Figurenhöhe",
      }),
    ).not.toBeInTheDocument();
  });

  it("does not create start or resume writes under StrictMode", () => {
    vi.useFakeTimers();
    const transientStorage = new MemoryStorage();
    const transient = renderStudio({ storage: transientStorage, strict: true });
    act(() => vi.advanceTimersByTime(1_000));
    expect(transientStorage.mutations).toEqual([]);
    transient.unmount();

    const resumedStorage = new MemoryStorage();
    storeDraft(resumedStorage, categoryDraft());
    const resumed = renderStudio({ storage: resumedStorage, strict: true });
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Fortgesetzter Entwurf")).toBeVisible();
    expect(resumedStorage.mutations).toEqual([]);
    resumed.unmount();
  });
});
