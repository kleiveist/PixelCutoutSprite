import { describe, expect, it } from "vitest";

import {
  ASSET_CATEGORY_IDS,
  ASSET_SUBTYPES,
  type AssetCategory,
  type AssetSubtype,
} from "../../domain/assets";
import { WIZARD_FIELD_PAGE_MAP } from "../../domain/catalog/questionnaireInventory";
import { StableIdSchema, VaultBaseProfileSchema } from "../../schemas";
import {
  projectWizardToVault,
  resolveWizardVaultProfile,
  type PromptVaultIndex,
} from "../../services";
import { buildPromptPackages } from "../../domain/prompt-engine";
import { createProfileLibraryFixture } from "../../test/profileLibraryFixtures";
import { createBlankWizardDraft, validateWizardResume } from "./wizardLifecycle";
import {
  applyWizardBaseProfileToFormValues,
  createWizardCoreFormValues,
} from "./wizardCategoryRouting";
import { WizardCoreFormSchema, type WizardCoreFormValues } from "./wizardSteps";
import {
  WIZARD_BASE_CONTEXT_FIELD_PATHS,
  WIZARD_CATALOG_PAGES,
  WIZARD_CATALOG_VERSION,
  WizardCatalogIdentitySchema,
  WizardCatalogReviewSchema,
  catalogPageForStep,
  getWizardCatalogStepIds,
  migrateWizardCatalogStepId,
  schemaForCatalogPage,
  updateWizardDraftFromCatalogForm,
  type WizardCatalogStepId,
} from "./wizardCatalog";

const timestamp = "2026-09-09T12:00:00.000Z";

function libraryWithOneBase() {
  const fixture = createProfileLibraryFixture();
  return {
    baseProfiles: fixture.baseProfiles.slice(0, 1),
    categoryProfiles: [],
    assetProfiles: [],
  };
}

function valuesFor(category: AssetCategory, subtype: AssetSubtype): WizardCoreFormValues {
  const library = libraryWithOneBase();
  const base = library.baseProfiles[0];
  if (!base) throw new Error("Expected a base profile fixture.");
  return applyWizardBaseProfileToFormValues(
    {
      ...createWizardCoreFormValues(
        createBlankWizardDraft({
          draftId: StableIdSchema.parse(`draft_catalog_${category.toLowerCase()}`),
          savedAt: timestamp,
        }),
        category,
        library,
      ),
      projectName: `${category} Katalog`,
      category,
      subtype,
    },
    base,
  );
}

function vaultIndex(): PromptVaultIndex {
  const baseProfile = libraryWithOneBase().baseProfiles[0];
  if (!baseProfile) throw new Error("Expected a base profile fixture.");
  const value = VaultBaseProfileSchema.parse({
    schemaVersion: 3,
    kind: "vaultBaseProfile",
    id: baseProfile.id,
    revision: 1,
    name: baseProfile.name,
    values: baseProfile.values,
    locks: baseProfile.locks,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return {
    baseProfile: {
      relativePath: ".PixelPrompt/basisprofil.json",
      value,
      revision: value.revision,
      sha256: "a".repeat(64),
    },
    profiles: [],
    drafts: [],
    issues: [],
  };
}

describe("P34 wizard catalog", () => {
  it("assigns every P28 form field to exactly one stable identity, context, or catalog page", () => {
    const formFields = Object.keys(WizardCoreFormSchema.shape);
    const assignedFields = [
      "projectName",
      "category",
      "subtype",
      ...WIZARD_BASE_CONTEXT_FIELD_PATHS,
      ...WIZARD_CATALOG_PAGES.flatMap((page) => page.fieldPaths),
    ];

    expect(new Set(assignedFields).size).toBe(assignedFields.length);
    expect([...assignedFields].sort()).toEqual([...formFields].sort());
    expect(Object.keys(WIZARD_FIELD_PAGE_MAP).sort()).toEqual([...formFields].sort());
    expect(WIZARD_CATALOG_VERSION).toBe("v3.0");
  });

  it.each(ASSET_CATEGORY_IDS)("completes the full %s path through output", (category) => {
    const subtype = ASSET_SUBTYPES[category][0] as AssetSubtype;
    const values = valuesFor(category, subtype);
    const library = libraryWithOneBase();
    const stepIds = getWizardCatalogStepIds(values);
    let draft = createBlankWizardDraft({
      draftId: StableIdSchema.parse(`draft_flow_${category.toLowerCase()}`),
      savedAt: timestamp,
    });
    const completed: WizardCatalogStepId[] = [];

    expect(stepIds[0]).toBe("identity");
    expect(stepIds.at(-1)).toBe("review");
    for (const stepId of stepIds) {
      const schema =
        stepId === "identity"
          ? WizardCatalogIdentitySchema
          : stepId === "review"
            ? WizardCatalogReviewSchema
            : schemaForCatalogPage(
                catalogPageForStep(stepId) ??
                  (() => {
                    throw new Error(`Missing page ${stepId}`);
                  })(),
              );
      expect(schema.safeParse(values).success, stepId).toBe(true);
      completed.push(stepId);
      const nextDraft = updateWizardDraftFromCatalogForm({
        draft,
        values,
        stepId,
        completedStepIds: completed,
        savedAt: timestamp,
        context: { library },
      });
      if (!nextDraft) throw new Error(`Could not project ${stepId}.`);
      draft = nextDraft;
    }

    expect(draft).toMatchObject({
      currentStep: "review",
      route: "wizard/review",
      catalogVersion: WIZARD_CATALOG_VERSION,
      completedStepIds: stepIds,
    });

    const index = vaultIndex();
    const projected = projectWizardToVault(draft, values, index, () => timestamp);
    expect(projected.kind).toBe("profile");
    if (projected.kind !== "profile") throw new Error("Expected a ready V3 profile.");
    expect(projected.value.status).toBe("ready");
    const indexWithProfile: PromptVaultIndex = {
      ...index,
      profiles: [
        {
          relativePath: `.PixelPrompt/${category}/profile.json`,
          value: projected.value,
          revision: projected.value.revision,
          sha256: "b".repeat(64),
        },
      ],
    };
    const resolved = resolveWizardVaultProfile(projected.value, indexWithProfile);
    if (!resolved) throw new Error("Expected the projected profile to resolve.");
    const packages = buildPromptPackages(resolved, { languages: ["en", "de"] });
    expect(packages).toHaveLength(4);
    expect(
      packages.every((entry) => entry.main && entry.negative && entry.technical && entry.combined),
    ).toBe(true);
  });

  it("keeps conditional pages deterministic and migrates legacy step IDs", () => {
    const npc = getWizardCatalogStepIds({ category: "character", subtype: "npc" });
    const animal = getWizardCatalogStepIds({ category: "character", subtype: "animal" });

    expect(npc).toContain("catalog/character/wardrobe");
    expect(npc).toContain("catalog/character/npc-context");
    expect(animal).not.toContain("catalog/character/wardrobe");
    expect(animal).not.toContain("catalog/character/npc-context");
    expect(migrateWizardCatalogStepId("characterDetails", valuesFor("character", "npc"))).toBe(
      "catalog/character/identity",
    );
    expect(migrateWizardCatalogStepId("tileability", valuesFor("texture", "wood"))).toBe(
      "catalog/texture/grid",
    );
  });

  it("backs up raw answers before a confirmed category change", () => {
    const library = libraryWithOneBase();
    const characterValues = {
      ...valuesFor("character", "npc"),
      role: "Schmiedin im unfertigen Entwurf",
    };
    const seed = updateWizardDraftFromCatalogForm({
      draft: createBlankWizardDraft({
        draftId: StableIdSchema.parse("draft_selection_backup"),
        savedAt: timestamp,
      }),
      values: characterValues,
      stepId: "catalog/character/identity",
      completedStepIds: ["identity"],
      savedAt: timestamp,
      context: { library },
    });
    if (!seed) throw new Error("Expected selected seed draft.");
    const movingValues = valuesFor("movingObject", "cart");
    const changed = updateWizardDraftFromCatalogForm({
      draft: seed,
      values: movingValues,
      stepId: "identity",
      completedStepIds: [],
      selectionSnapshot: characterValues,
      savedAt: timestamp,
      context: { library },
    });

    expect(changed?.selectionHistory).toHaveLength(1);
    expect(changed?.selectionHistory?.[0]).toMatchObject({
      category: "character",
      subtype: "npc",
      rawValues: { role: "Schmiedin im unfertigen Entwurf" },
    });
    expect(changed).toMatchObject({ category: "movingObject", subtype: "cart" });
  });

  it("retains the exact symbolic page when the wizard module is reopened", () => {
    const library = libraryWithOneBase();
    const values = valuesFor("character", "npc");
    const draft = updateWizardDraftFromCatalogForm({
      draft: createBlankWizardDraft({
        draftId: StableIdSchema.parse("draft_module_roundtrip"),
        savedAt: timestamp,
      }),
      values,
      stepId: "catalog/character/body",
      completedStepIds: ["identity", "catalog/character/identity"],
      savedAt: timestamp,
      context: { library },
    });
    if (!draft) throw new Error("Expected a catalog draft.");

    const resumed = validateWizardResume({
      requestedDraftId: draft.draftId,
      draft,
      profileLibrary: library,
    });

    expect(resumed.status).toBe("ready");
    if (resumed.status !== "ready") throw new Error("Expected a resumable catalog draft.");
    expect(resumed.draft.currentStep).toBe("catalog/character/body");
    expect(resumed.draft.completedStepIds).toEqual(["identity", "catalog/character/identity"]);
  });
});
