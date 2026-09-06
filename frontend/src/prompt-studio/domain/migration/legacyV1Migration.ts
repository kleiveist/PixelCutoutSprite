import {
  resolveCapabilities,
  type AssetCapabilities,
  type AssetCategory,
  type AssetSelection,
} from "../assets";
import { createCompatibilityKey } from "../profiles";
import { canonicalizeJson } from "../json";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type BaseProfileValues,
  type ProfileLibrary,
  type ValidatedLegacyV1State,
} from "../../schemas";

export const LEGACY_V1_ASSET_SELECTIONS = Object.freeze({
  hero: { category: "character", subtype: "hero" },
  npc: { category: "character", subtype: "npc" },
  enemy: { category: "character", subtype: "enemy" },
  boss: { category: "character", subtype: "boss" },
  creature: { category: "character", subtype: "creature" },
  building: { category: "building", subtype: "house" },
  interiorObject: { category: "staticObject", subtype: "furniture" },
  outdoorObject: { category: "staticObject", subtype: "decoration" },
  plant: { category: "nature", subtype: "bush" },
  tree: { category: "nature", subtype: "tree" },
  rock: { category: "staticObject", subtype: "decoration" },
  ruin: { category: "building", subtype: "ruin" },
  weapon: { category: "item", subtype: "weapon" },
  armor: { category: "item", subtype: "armorPiece" },
  consumable: { category: "item", subtype: "consumable" },
  questItem: { category: "item", subtype: "questItem" },
  groundTile: { category: "tileset", subtype: "groundTile" },
  wallElement: { category: "tileset", subtype: "wallTile" },
} satisfies Readonly<Record<ValidatedLegacyV1State["assetType"], AssetSelection>>);

const CATEGORY_ICON_IDS = Object.freeze({
  character: "category-character",
  movingObject: "category-moving-object",
  staticObject: "category-static-object",
  texture: "category-texture",
  nature: "category-nature",
  building: "category-building",
  tileset: "category-tileset",
  item: "category-item",
  artwork: "category-artwork",
} satisfies Record<AssetCategory, string>);

const FALLBACK_SELECTIONS = new Set<ValidatedLegacyV1State["assetType"]>([
  "building",
  "interiorObject",
  "outdoorObject",
  "plant",
  "rock",
]);

export interface LegacyV1MigrationSource {
  readonly sourceKind: "autosave" | "preset" | "jsonImport";
  readonly sourceStorageKey: string;
  readonly sourceIndex: number;
  readonly sourceTimestamp?: string;
  readonly displayName?: string;
  readonly state: ValidatedLegacyV1State;
}

export interface LegacyV1MigrationWarning {
  readonly sourceStorageKey: string;
  readonly sourceIndex: number;
  readonly code: "fallbackSubtype" | "discardedDirections";
  readonly message: string;
}

export interface LegacyV1TransformationResult {
  readonly library: ProfileLibrary;
  readonly warnings: readonly LegacyV1MigrationWarning[];
}

export function fingerprintLegacyText(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

function fingerprintValue(value: unknown): string {
  return fingerprintLegacyText(canonicalizeJson(value));
}

function capabilitiesForSelection(selection: AssetSelection): AssetCapabilities {
  switch (selection.category) {
    case "character":
      return resolveCapabilities("character", selection.subtype);
    case "movingObject":
      return resolveCapabilities("movingObject", selection.subtype);
    case "staticObject":
      return resolveCapabilities("staticObject", selection.subtype);
    case "texture":
      return resolveCapabilities("texture", selection.subtype);
    case "nature":
      return resolveCapabilities("nature", selection.subtype);
    case "building":
      return resolveCapabilities("building", selection.subtype);
    case "tileset":
      return resolveCapabilities("tileset", selection.subtype);
    case "item":
      return resolveCapabilities("item", selection.subtype);
    case "artwork":
      return resolveCapabilities("artwork", selection.subtype);
  }
}

function buildBaseValues(
  state: ValidatedLegacyV1State,
  capabilities: AssetCapabilities,
): BaseProfileValues {
  return {
    pixelDensity: state.pixelDensity,
    styleProfile: state.profileOutputMode === "both" ? "both" : state.selectedProfile,
    tileSize: state.tileSize,
    ...(capabilities.scaledCharacter ? { characterHeight: state.characterHeight } : {}),
    perspectiveType: state.perspectiveType,
    cameraAngle: Number(state.cameraAngle) as 30 | 45 | 60,
    cameraDirection: state.cameraDirection,
    projectionType: state.projectionType,
    outlineStyle: state.outlineStyle,
    paletteMode: state.paletteMode,
    backgroundMode: state.backgroundMode,
    alphaPadding: state.alphaPadding,
    nearestNeighbor: state.nearestNeighbor,
    lightingDefaults: {
      policy: state.lightingPolicy,
      notes: state.lightingNotes.trim().slice(0, 2000),
    },
  };
}

function footprint(state: ValidatedLegacyV1State): Readonly<{
  widthTiles: number;
  depthTiles: number;
}> {
  return {
    widthTiles: state.footprintWidthTiles,
    depthTiles: state.footprintDepthTiles,
  };
}

function natureClimate(
  environment: ValidatedLegacyV1State["environment"],
): "mountain" | "snow" | "swamp" | "dry" | "magical" | undefined {
  switch (environment) {
    case "mountain":
      return "mountain";
    case "snow":
      return "snow";
    case "swamp":
      return "swamp";
    case "desert":
      return "dry";
    case "magicArea":
      return "magical";
    default:
      return undefined;
  }
}

function buildingCondition(
  condition: ValidatedLegacyV1State["condition"],
): "maintained" | "used" | "weathered" | "damaged" | "abandoned" | "overgrown" | undefined {
  switch (condition) {
    case "used":
    case "weathered":
    case "damaged":
    case "abandoned":
    case "overgrown":
    case "maintained":
      return condition;
    default:
      return undefined;
  }
}

function buildAnswers(
  state: ValidatedLegacyV1State,
  selection: AssetSelection,
  capabilities: AssetCapabilities,
): Readonly<Record<string, unknown>> {
  const shared = {
    ...(state.subjectDescription.trim()
      ? { subjectDescription: state.subjectDescription.trim().slice(0, 4000) }
      : {}),
    ...(state.extraDetails.trim()
      ? { extraDetails: state.extraDetails.trim().slice(0, 4000) }
      : {}),
  };
  const directionCount =
    state.outputMode === "directional4" ? 4 : state.outputMode === "directional8" ? 8 : undefined;

  switch (selection.category) {
    case "character":
      return {
        ...shared,
        role: state.assetType,
        ...(directionCount && capabilities.directional ? { directionCount } : {}),
      };
    case "staticObject":
      return { ...shared, footprint: footprint(state) };
    case "nature": {
      const climate = natureClimate(state.environment);
      return {
        ...shared,
        ...(climate ? { climate } : {}),
        footprint: footprint(state),
      };
    }
    case "building": {
      const condition = buildingCondition(state.condition);
      return {
        ...shared,
        ...(condition ? { condition } : {}),
        footprint: footprint(state),
      };
    }
    case "tileset":
      return {
        ...shared,
        tileUsage: selection.subtype === "groundTile" ? "floor" : "wall",
      };
    case "item":
      return shared;
    default:
      return shared;
  }
}

function migrationName(source: LegacyV1MigrationSource): string {
  const preferred = source.displayName?.trim() || source.state.projectName.trim();
  return (preferred || `Migrated V1 asset ${source.sourceIndex + 1}`).slice(0, 120);
}

function buildLegacyData(
  source: LegacyV1MigrationSource,
  warnings: readonly LegacyV1MigrationWarning[],
): Readonly<Record<string, unknown>> {
  return {
    source: {
      kind: source.sourceKind,
      storageKey: source.sourceStorageKey,
      index: source.sourceIndex,
      fingerprint: fingerprintValue(source.state),
      ...(source.sourceTimestamp ? { timestamp: source.sourceTimestamp } : {}),
    },
    normalizedState: { ...source.state },
    warnings: warnings.map((warning) => warning.message),
  };
}

export function transformLegacyV1Sources(
  sources: readonly LegacyV1MigrationSource[],
  migratedAt: string,
): LegacyV1TransformationResult {
  const baseProfiles = new Map<string, ReturnType<typeof parseBaseProfile>>();
  const categoryProfiles = new Map<string, ReturnType<typeof parseCategoryProfile>>();
  const assetProfiles: ReturnType<typeof parseAssetProfile>[] = [];
  const warnings: LegacyV1MigrationWarning[] = [];

  sources.forEach((source) => {
    const selection = LEGACY_V1_ASSET_SELECTIONS[source.state.assetType];
    const capabilities = capabilitiesForSelection(selection);
    const values = buildBaseValues(source.state, capabilities);
    const baseId = `v1-base-${fingerprintValue(values)}`;
    const categoryId = `v1-category-${fingerprintValue({
      baseId,
      category: selection.category,
      subtype: selection.subtype,
    })}`;
    const assetId = `v1-asset-${fingerprintValue({
      sourceStorageKey: source.sourceStorageKey,
      sourceIndex: source.sourceIndex,
    })}`;

    if (!baseProfiles.has(baseId)) {
      baseProfiles.set(
        baseId,
        parseBaseProfile({
          schemaVersion: 2,
          kind: "baseProfile",
          id: baseId,
          name: `Migrated V1 base · ${values.tileSize}px`,
          iconId: "profile-base",
          values,
          locks: {},
          migratedFromVersion: 1,
          createdAt: migratedAt,
          updatedAt: migratedAt,
        }),
      );
    }

    if (!categoryProfiles.has(categoryId)) {
      categoryProfiles.set(
        categoryId,
        parseCategoryProfile({
          schemaVersion: 2,
          kind: "categoryProfile",
          id: categoryId,
          name: `Migrated ${selection.category} · ${selection.subtype}`,
          baseProfileId: baseId,
          category: selection.category,
          subtype: selection.subtype,
          iconId: CATEGORY_ICON_IDS[selection.category],
          capabilities,
          overrides: {},
          defaults: {},
          tags: ["migration", "v1", selection.category],
          migratedFromVersion: 1,
          createdAt: migratedAt,
          updatedAt: migratedAt,
        }),
      );
    }

    const sourceWarnings: LegacyV1MigrationWarning[] = [];
    if (FALLBACK_SELECTIONS.has(source.state.assetType)) {
      sourceWarnings.push({
        sourceStorageKey: source.sourceStorageKey,
        sourceIndex: source.sourceIndex,
        code: "fallbackSubtype",
        message: `Legacy asset type "${source.state.assetType}" maps to the closest V2 subtype "${selection.category}/${selection.subtype}".`,
      });
    }
    if (
      (source.state.outputMode === "directional4" || source.state.outputMode === "directional8") &&
      !capabilities.directional
    ) {
      sourceWarnings.push({
        sourceStorageKey: source.sourceStorageKey,
        sourceIndex: source.sourceIndex,
        code: "discardedDirections",
        message: `Legacy output mode "${source.state.outputMode}" was isolated because "${selection.category}/${selection.subtype}" is not directional.`,
      });
    }
    warnings.push(...sourceWarnings);

    assetProfiles.push(
      parseAssetProfile({
        schemaVersion: 2,
        kind: "assetProfile",
        id: assetId,
        name: migrationName(source),
        baseProfileId: baseId,
        categoryProfileId: categoryId,
        compatibilityKey: createCompatibilityKey(values, selection),
        category: selection.category,
        subtype: selection.subtype,
        iconId: CATEGORY_ICON_IDS[selection.category],
        badgeIconIds: ["migration-v1"],
        capabilities,
        overrides: {},
        answers: buildAnswers(source.state, selection, capabilities),
        tags: ["migration", "v1", selection.category],
        favorite: false,
        migratedFromVersion: 1,
        legacyData: buildLegacyData(source, sourceWarnings),
        createdAt: migratedAt,
        updatedAt: migratedAt,
      }),
    );
  });

  const library = ProfileLibrarySchema.parse({
    baseProfiles: [...baseProfiles.values()],
    categoryProfiles: [...categoryProfiles.values()],
    assetProfiles,
  });

  return { library, warnings };
}
