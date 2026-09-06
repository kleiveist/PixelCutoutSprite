import { describe, expect, it } from "vitest";
import {
  ProfileLibrarySchema,
  parseWizardDraft,
  type ProfileLibrary,
  type WizardDraft,
} from "../../schemas";
import { parseExportBundleJson } from "../../services";
import {
  PROFILE_FIXTURE_TIMESTAMP,
  createProfileLibraryFixture,
} from "../../test/profileLibraryFixtures";
import { createWizardDraftFromAssetProfile } from "../wizard";
import {
  REVIEW_OUTPUT_IDS,
  createProfileJsonFile,
  createPromptMarkdownFile,
  createReviewBundleId,
  prepareReviewOutput,
} from "./reviewOutputData";

type SelectedWizardDraft = Extract<WizardDraft, { category: unknown }>;

function profileDraft(
  assetProfileId = "asset_smith_80",
  draftId = "draft_review_fixture",
): Readonly<{
  library: ProfileLibrary;
  draft: SelectedWizardDraft;
}> {
  const library = createProfileLibraryFixture();
  const assetProfile = library.assetProfiles.find((profile) => profile.id === assetProfileId);
  if (!assetProfile) throw new Error("Expected the requested Asset fixture.");
  const baseProfile = library.baseProfiles.find(
    (profile) => profile.id === assetProfile.baseProfileId,
  );
  const categoryProfile = library.categoryProfiles.find(
    (profile) => profile.id === assetProfile.categoryProfileId,
  );
  const result = createWizardDraftFromAssetProfile({
    draftId: parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId,
      projectName: "",
      route: "wizard/project",
      currentStep: "project",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    }).draftId,
    savedAt: PROFILE_FIXTURE_TIMESTAMP,
    assetProfile,
    ...(baseProfile ? { baseProfile } : {}),
    ...(categoryProfile ? { categoryProfile } : {}),
  });
  if (result.status !== "created") {
    throw new Error("Expected a resolvable profile draft.");
  }
  if (!("category" in result.draft)) {
    throw new Error("Expected a selected Wizard draft.");
  }
  return { library, draft: result.draft };
}

describe("review/output preparation", () => {
  it("builds a deterministic review summary and all four outputs per package", () => {
    const { library, draft } = profileDraft();

    const result = prepareReviewOutput(draft, library, ["de", "en"]);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready output.");
    expect(result.packages).toHaveLength(4);
    expect(result.packages.map((promptPackage) => promptPackage.id)).toEqual([
      `${draft.draftId}:classic:en`,
      `${draft.draftId}:classic:de`,
      `${draft.draftId}:dark:en`,
      `${draft.draftId}:dark:de`,
    ]);
    for (const promptPackage of result.packages) {
      for (const outputId of REVIEW_OUTPUT_IDS) {
        expect(promptPackage[outputId].trim().length).toBeGreaterThan(20);
      }
    }
    expect(result.summary.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Projekt",
          value: "Dorfschmied mit Lederschürze",
        }),
        expect.objectContaining({
          label: "Asset",
          value: "Charakter / Figur · NPC",
        }),
        expect.objectContaining({
          label: "Figurenhöhe",
          value: "80 px",
          meta: "Basisprofil",
        }),
      ]),
    );
    expect(result.summary.capabilities).toEqual(
      expect.arrayContaining(["beweglich", "Richtungsset", "animiert"]),
    );
    expect(result.definition).toMatchObject({
      sourceAssetProfileId: "asset_smith_80",
      category: "character",
      subtype: "npc",
      compatibilityKey: result.profile.compatibilityKey,
    });
  });

  it("stops incomplete and conflicted drafts before prompt generation", () => {
    const { library, draft } = profileDraft();
    const earlyDraft = parseWizardDraft({
      schemaVersion: 2,
      kind: "wizardDraft",
      draftId: "draft_early_review",
      projectName: "Noch offen",
      route: "wizard/category",
      currentStep: "category",
      validation: { errors: [], warnings: [] },
      savedAt: PROFILE_FIXTURE_TIMESTAMP,
    });
    expect(prepareReviewOutput(earlyDraft, library)).toMatchObject({
      status: "incompleteDraft",
      reasons: expect.arrayContaining([expect.stringContaining("Kategorie und Untertyp")]),
    });

    const lockedLibrary = ProfileLibrarySchema.parse({
      ...library,
      baseProfiles: library.baseProfiles.map((profile) =>
        profile.id === draft.baseProfileId
          ? { ...profile, locks: { ...profile.locks, tileSize: true } }
          : profile,
      ),
    });
    const conflictedDraft = parseWizardDraft({
      ...draft,
      overrides: { ...draft.overrides, tileSize: 48 },
    });
    const conflict = prepareReviewOutput(conflictedDraft, lockedLibrary);

    expect(conflict.status).toBe("conflict");
    if (conflict.status !== "conflict") {
      throw new Error("Expected a locked-value conflict.");
    }
    expect(conflict.conflicts).toContainEqual(
      expect.objectContaining({ code: "lockedOverride", field: "tileSize" }),
    );
    expect(conflict).not.toHaveProperty("packages");
  });

  it("creates portable Markdown and validated dependency-complete JSON files", () => {
    const { library, draft } = profileDraft();
    const { sourceAssetProfileId: ignoredSource, ...portableDraftInput } = draft;
    void ignoredSource;
    const portableDraft = parseWizardDraft(portableDraftInput);
    const result = prepareReviewOutput(portableDraft, library, ["de"]);
    if (result.status !== "ready") throw new Error("Expected ready output.");
    const promptPackage = result.packages[0];
    if (!promptPackage) throw new Error("Expected one prompt package.");

    const markdownFile = createPromptMarkdownFile(result.profile.name, promptPackage, "technical");
    expect(markdownFile).toMatchObject({
      filename: "dorfschmied-mit-lederschurze-classic-de-technical.md",
      mimeType: "text/markdown;charset=utf-8",
    });
    expect(markdownFile.contents).toContain("# Technische Spezifikation");
    expect(markdownFile.contents).toContain("**Sprache:** Deutsch");
    expect(markdownFile.contents).toContain("```text");
    expect(markdownFile.contents).toContain("32 × 32");

    const fencedMarkdownFile = createPromptMarkdownFile(
      result.profile.name,
      { ...promptPackage, technical: "Technik mit ``` im Inhalt" },
      "technical",
    );
    expect(fencedMarkdownFile.contents).toContain("````text\nTechnik mit ``` im Inhalt\n````");

    const exportedAt = "2026-09-03T23:00:00.000Z";
    const jsonFile = createProfileJsonFile({
      draft: portableDraft,
      definition: result.definition,
      library,
      exportedAt,
      bundleId: createReviewBundleId(portableDraft.draftId, exportedAt),
    });
    const parsed = parseExportBundleJson(jsonFile.contents);

    expect(jsonFile.filename).toBe("dorfschmied-mit-lederschurze-profile.json");
    expect(parsed.status).toBe("valid");
    if (parsed.status !== "valid") throw new Error("Expected valid JSON export.");
    expect(parsed.bundle.baseProfiles).toHaveLength(1);
    expect(parsed.bundle.categoryProfiles).toHaveLength(1);
    expect(parsed.bundle.assetProfiles).toHaveLength(1);
    expect(parsed.bundle.assetProfiles[0]?.id).toMatch(/^asset_export_/);
    expect(parsed.bundle.wizardDrafts).toEqual([portableDraft]);
    expect(library).toEqual(createProfileLibraryFixture());
  });

  it("summarizes free artwork composition without inherited world geometry", () => {
    const { library, draft } = profileDraft("asset_forest_promo", "draft_artwork_review");

    const result = prepareReviewOutput(draft, library, ["de"]);

    expect(result.status).toBe("ready");
    if (result.status !== "ready") throw new Error("Expected ready output.");
    expect(result.summary.rows).toContainEqual({
      label: "Artwork-Hintergrund",
      value: "Vollständiger Hintergrund",
    });
    expect(result.summary.rows).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Tile-Raster" }),
        expect.objectContaining({ label: "Kamera" }),
        expect.objectContaining({ label: "Hintergrund" }),
      ]),
    );
  });
});
