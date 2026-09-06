import type {
  ProfileResolutionConflict,
  ProfileResolutionNotice,
  ProfileValueKey,
  ResolvedProfile,
} from "../../domain/profiles";
import { saveAssetProfile, type AssetProfileSaveDefinition } from "../../domain/profiles";
import {
  buildPromptPackages,
  type PromptLanguage,
  type PromptPackage,
} from "../../domain/prompt-engine";
import {
  StableIdSchema,
  type ProfileLibrary,
  type StableId,
  type WizardDraft,
} from "../../schemas";
import {
  createProfileExportBundle,
  serializeExportBundle,
  type OutputTextFile,
} from "../../services";
import { formatSubtypeLabel, getDashboardCategory } from "../dashboard/dashboardCatalog";
import { resolveWizardDraftSnapshot } from "../wizard";

export const REVIEW_OUTPUT_IDS = Object.freeze([
  "main",
  "negative",
  "technical",
  "combined",
] as const);

export type ReviewOutputId = (typeof REVIEW_OUTPUT_IDS)[number];

export const REVIEW_OUTPUT_LABELS = Object.freeze({
  main: "Hauptprompt",
  negative: "Negativprompt",
  technical: "Technische Spezifikation",
  combined: "Kombinierte Ausgabe",
} as const satisfies Record<ReviewOutputId, string>);

export interface ReviewSummaryRow {
  readonly label: string;
  readonly value: string;
  readonly meta?: string;
}

export interface ReviewSummary {
  readonly rows: readonly ReviewSummaryRow[];
  readonly capabilities: readonly string[];
}

export type ReviewOutputPreparation =
  | Readonly<{ status: "missingDraft" }>
  | Readonly<{
      status: "incompleteDraft";
      draft: WizardDraft;
      reasons: readonly string[];
    }>
  | Readonly<{
      status: "conflict";
      draft: WizardDraft;
      conflicts: readonly ProfileResolutionConflict[];
      notices: readonly ProfileResolutionNotice[];
      partialProfile?: ResolvedProfile;
    }>
  | Readonly<{
      status: "ready";
      draft: WizardDraft;
      profile: ResolvedProfile;
      definition: AssetProfileSaveDefinition;
      packages: readonly PromptPackage[];
      summary: ReviewSummary;
      notices: readonly ProfileResolutionNotice[];
    }>;

const pixelDensityLabels = {
  classicHd: "Classic-HD Pixelart",
  modernHd: "Modern-HD Pixelart",
  ultraHd: "Ultra-HD Pixelart",
} as const;

const styleProfileLabels = {
  classic: "Klassische geerdete Fantasy",
  dark: "Düstere geerdete Fantasy",
  both: "Klassische und düstere Variante",
} as const;

const perspectiveLabels = {
  topdown: "Top-down",
  threeQuarter: "Frontale schräge 3/4-RPG-Draufsicht",
  isometric: "Isometrisch",
  side: "Seitenansicht",
} as const;

const projectionLabels = {
  orthographic: "Orthografisch",
  mildPerspective: "Leichte Perspektive",
} as const;

const backgroundLabels = {
  transparent: "Transparent",
  scene: "Szene",
} as const;

const artworkBackgroundLabels = {
  transparent: "Transparent",
  simple: "Einfacher Hintergrund",
  complete: "Vollständiger Hintergrund",
} as const;

const capabilityLabels = {
  movable: "beweglich",
  directional: "Richtungsset",
  animated: "animiert",
  tileable: "kachelbar",
  gridBound: "Rasterbindung",
  transparent: "Transparenz",
  scaledCharacter: "Figurenmaßstab",
  footprint: "Standfläche",
  wearable: "tragbar",
  modular: "modular",
  freeComposition: "freie Komposition",
} as const;

const profileValueLabels = {
  pixelDensity: "Pixeldichte",
  styleProfile: "Stilprofil",
  tileSize: "Tilegröße",
  characterHeight: "Figurenhöhe",
  perspectiveType: "Perspektive",
  cameraAngle: "Kamerawinkel",
  cameraDirection: "Kamerarichtung",
  projectionType: "Projektion",
  outlineStyle: "Outline",
  paletteMode: "Farbprofil",
  backgroundMode: "Hintergrund",
  alphaPadding: "Alpha-Abstand",
  nearestNeighbor: "Nearest Neighbor",
  lightingDefaults: "Lichtgrundregeln",
} as const;

function createReviewSummary(profile: ResolvedProfile, library: ProfileLibrary): ReviewSummary {
  const baseProfile = library.baseProfiles.find(
    (candidate) => candidate.id === profile.baseProfileId,
  );
  const categoryProfile = profile.categoryProfileId
    ? library.categoryProfiles.find((candidate) => candidate.id === profile.categoryProfileId)
    : undefined;
  const sourceMeta = (...keys: readonly ProfileValueKey[]): string => {
    const sources = [
      ...new Set(
        keys.map((key) => {
          const source = profile.valueSources[key] ?? "base";
          return source === "asset"
            ? "Assetwert"
            : source === "category"
              ? "Kategorieprofil"
              : "Basisprofil";
        }),
      ),
    ];
    const locked = keys.some((key) => baseProfile?.locks[key] === true);
    return `${sources.join(" / ")}${locked ? " · im Basisprofil gesperrt" : ""}`;
  };
  const rows: ReviewSummaryRow[] = [
    { label: "Projekt", value: profile.name },
    {
      label: "Asset",
      value: `${getDashboardCategory(profile.categoryData.category).label} · ${formatSubtypeLabel(profile.categoryData.subtype)}`,
    },
    {
      label: "Basisprofil",
      value: baseProfile?.name ?? profile.baseProfileId,
    },
    {
      label: "Kategorieprofil",
      value: categoryProfile?.name ?? "Keine zusätzliche Kategorievorlage",
    },
    {
      label: "Pixelstil",
      value: pixelDensityLabels[profile.values.pixelDensity],
      meta: sourceMeta("pixelDensity"),
    },
    {
      label: "Stilvarianten",
      value: styleProfileLabels[profile.values.styleProfile],
      meta: sourceMeta("styleProfile"),
    },
  ];

  if (!profile.capabilities.freeComposition) {
    rows.push(
      {
        label: "Tile-Raster",
        value: `${profile.values.tileSize} × ${profile.values.tileSize} px`,
        meta: sourceMeta("tileSize"),
      },
      {
        label: "Kamera",
        value: `${perspectiveLabels[profile.values.perspectiveType]}, ${profile.values.cameraAngle}°, ${projectionLabels[profile.values.projectionType]}`,
        meta: sourceMeta("perspectiveType", "cameraAngle", "projectionType"),
      },
    );
  }
  if (profile.capabilities.scaledCharacter && profile.values.characterHeight !== undefined) {
    rows.push({
      label: "Figurenhöhe",
      value: `${profile.values.characterHeight} px`,
      meta: sourceMeta("characterHeight"),
    });
  }
  if (!profile.capabilities.freeComposition) {
    rows.push({
      label: "Hintergrund",
      value: backgroundLabels[profile.values.backgroundMode],
      meta: sourceMeta("backgroundMode"),
    });
  } else if (
    profile.categoryData.category === "artwork" &&
    profile.categoryData.answers.background !== undefined
  ) {
    rows.push({
      label: "Artwork-Hintergrund",
      value: artworkBackgroundLabels[profile.categoryData.answers.background],
    });
  }
  const capabilities = Object.entries(profile.capabilities).flatMap(([capability, enabled]) =>
    enabled ? [capabilityLabels[capability as keyof typeof capabilityLabels]] : [],
  );

  return Object.freeze({
    rows: Object.freeze(rows.map((row) => Object.freeze(row))),
    capabilities: Object.freeze(capabilities),
  });
}

function createSaveDefinition(
  draft: Extract<WizardDraft, { category: unknown }>,
  profile: ResolvedProfile,
): AssetProfileSaveDefinition {
  const common = {
    name: draft.projectName,
    baseProfileId: profile.baseProfileId,
    ...(profile.categoryProfileId === undefined
      ? {}
      : { categoryProfileId: profile.categoryProfileId }),
    ...(draft.sourceAssetProfileId === undefined
      ? {}
      : { sourceAssetProfileId: draft.sourceAssetProfileId }),
    compatibilityKey: profile.compatibilityKey,
    capabilities: profile.capabilities,
    overrides: profile.normalizedOverrides.asset,
  } as const;

  switch (draft.category) {
    case "character":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "movingObject":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "staticObject":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "texture":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "nature":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "building":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "tileset":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "item":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
    case "artwork":
      return Object.freeze({
        ...common,
        category: draft.category,
        subtype: draft.subtype,
        answers: draft.answers,
      });
  }
}

function visibleNotices(
  notices: readonly ProfileResolutionNotice[],
): readonly ProfileResolutionNotice[] {
  return Object.freeze(
    notices.filter(
      (notice) =>
        notice.code !== "staleCompatibilityKey" || notice.storedKey !== "wizard-draft-snapshot",
    ),
  );
}

export function prepareReviewOutput(
  draft: WizardDraft | null,
  library: ProfileLibrary,
  languages: readonly PromptLanguage[] = ["de", "en"],
): ReviewOutputPreparation {
  if (draft === null) return Object.freeze({ status: "missingDraft" });

  const reasons: string[] = [];
  if (!("category" in draft)) {
    reasons.push("Kategorie und Untertyp sind noch nicht vollständig gewählt.");
  }
  if ("category" in draft && draft.baseProfileId === undefined) {
    reasons.push("Ein Basisprofil muss vor der Ausgabe gewählt werden.");
  }
  reasons.push(...draft.validation.errors);
  if (reasons.length > 0) {
    return Object.freeze({
      status: "incompleteDraft",
      draft,
      reasons: Object.freeze(reasons),
    });
  }

  const resolution = resolveWizardDraftSnapshot(draft, library);
  if (resolution === null || !("category" in draft)) {
    return Object.freeze({
      status: "incompleteDraft",
      draft,
      reasons: Object.freeze(["Der Entwurf ist noch nicht ausgabebereit."]),
    });
  }
  const notices = visibleNotices(resolution.notices);
  if (resolution.status === "conflict") {
    return Object.freeze({
      status: "conflict",
      draft,
      conflicts: resolution.conflicts,
      notices,
      ...(resolution.partialProfile === undefined
        ? {}
        : { partialProfile: resolution.partialProfile }),
    });
  }

  return Object.freeze({
    status: "ready",
    draft,
    profile: resolution.profile,
    definition: createSaveDefinition(draft, resolution.profile),
    packages: buildPromptPackages(resolution.profile, { languages }),
    summary: createReviewSummary(resolution.profile, library),
    notices,
  });
}

function displayValue(value: unknown): string {
  if (typeof value === "object" && value !== null) {
    if ("policy" in value && "notes" in value) {
      return `${String(value.policy)}${String(value.notes) ? ` · ${String(value.notes)}` : ""}`;
    }
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatResolutionConflict(conflict: ProfileResolutionConflict): string {
  switch (conflict.code) {
    case "referenceIdMismatch":
      return `Die Referenz ${conflict.reference} von „${conflict.profileId}“ erwartet „${conflict.expectedId}“, gefunden wurde „${conflict.actualId}“.`;
    case "missingReference":
      return `Die benötigte Referenz ${conflict.reference} „${conflict.requestedId}“ fehlt.`;
    case "unexpectedCategoryReference":
      return `Das Asset enthält die unerwartete Kategorieprofil-Referenz „${conflict.providedCategoryProfileId}“.`;
    case "classificationMismatch":
      return `Das Kategorieprofil widerspricht bei ${conflict.field}: erwartet „${conflict.expectedValue}“, gefunden „${conflict.actualValue}“.`;
    case "lockedOverride":
      return `${profileValueLabels[conflict.field]} ist im Basisprofil gesperrt (${displayValue(conflict.inheritedValue)} statt ${displayValue(conflict.attemptedValue)}).`;
    case "missingRequiredValue":
      return `Für dieses Asset fehlt die erforderliche Figurenhöhe im Basisprofil „${conflict.profileId}“.`;
  }
}

export function formatResolutionNotice(notice: ProfileResolutionNotice): string {
  switch (notice.code) {
    case "redundantOverride":
      return `${profileValueLabels[notice.field]} wiederholt auf ${notice.source}-Ebene nur den geerbten Wert.`;
    case "irrelevantOverride":
      return `Die Figurenhöhe ${notice.attemptedValue} px ist für ${notice.category}/${notice.subtype} nicht relevant und wird ignoriert.`;
    case "staleCompatibilityKey":
      return "Der gespeicherte Compatibility Key wird beim Speichern auf den geprüften Wert aktualisiert.";
  }
}

export function promptPackageText(promptPackage: PromptPackage, outputId: ReviewOutputId): string {
  return promptPackage[outputId];
}

function filenameSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("de-DE")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || "pixelforge-prompt";
}

export function createPromptMarkdownFile(
  profileName: string,
  promptPackage: PromptPackage,
  outputId: ReviewOutputId,
): OutputTextFile {
  const prompt = promptPackageText(promptPackage, outputId);
  const longestBacktickRun = Math.max(0, ...(prompt.match(/`+/g) ?? []).map((run) => run.length));
  const codeFence = "`".repeat(Math.max(3, longestBacktickRun + 1));

  return Object.freeze({
    filename: `${filenameSlug(profileName)}-${promptPackage.styleProfile}-${promptPackage.language}-${outputId}.md`,
    contents: [
      `# ${REVIEW_OUTPUT_LABELS[outputId]}`,
      "",
      `**Sprache:** ${promptPackage.languageLabel}  `,
      `**Stilvariante:** ${promptPackage.styleProfileLabel}`,
      "",
      `${codeFence}text`,
      prompt,
      codeFence,
      "",
    ].join("\n"),
    mimeType: "text/markdown;charset=utf-8",
  });
}

function availableExportProfileId(draftId: StableId, library: ProfileLibrary): StableId {
  const occupied = new Set(library.assetProfiles.map((profile) => profile.id));
  const base = `asset_export_${draftId}`.slice(0, 118).replace(/[-_]$/g, "");
  for (let suffix = 0; suffix <= library.assetProfiles.length; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`.slice(0, 128);
    const parsed = StableIdSchema.safeParse(candidate);
    if (parsed.success && !occupied.has(parsed.data)) return parsed.data;
  }
  throw new RangeError("No available transient Asset-profile ID.");
}

export function createReviewBundleId(draftId: StableId, exportedAt: string): StableId {
  const timestamp = exportedAt.replace(/\D/g, "");
  return StableIdSchema.parse(`bundle_${timestamp}_${draftId}`.slice(0, 128).replace(/[-_]$/g, ""));
}

export function createProfileJsonFile(
  input: Readonly<{
    draft: WizardDraft;
    definition: AssetProfileSaveDefinition;
    library: ProfileLibrary;
    exportedAt: string;
    bundleId: StableId;
  }>,
): OutputTextFile {
  const sourceExists =
    input.definition.sourceAssetProfileId !== undefined &&
    input.library.assetProfiles.some(
      (profile) => profile.id === input.definition.sourceAssetProfileId,
    );
  const { sourceAssetProfileId: ignoredSourceId, ...definitionWithoutSource } = input.definition;
  void ignoredSourceId;
  const definition: AssetProfileSaveDefinition = sourceExists
    ? input.definition
    : definitionWithoutSource;
  const profileId = availableExportProfileId(input.draft.draftId, input.library);
  const change = saveAssetProfile(input.library, profileId, input.exportedAt, definition);
  if (change.status !== "changed") {
    throw new Error("The reviewed profile could not be prepared for export.");
  }

  const bundle = createProfileExportBundle({
    library: change.library,
    bundleId: input.bundleId,
    exportedAt: input.exportedAt,
    selection: { assetProfileIds: [change.profile.id] },
    wizardDrafts: [input.draft],
  });

  return Object.freeze({
    filename: `${filenameSlug(input.draft.projectName)}-profile.json`,
    contents: serializeExportBundle(bundle),
    mimeType: "application/json;charset=utf-8",
  });
}
