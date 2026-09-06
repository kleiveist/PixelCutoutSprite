import {
  ASSET_CAPABILITY_IDS,
  ASSET_SUBTYPES,
  type AssetCapabilities,
  type AssetCapability,
  type AssetCategory,
  type AssetSubtypeByCategory,
  type DirectionCount,
} from "./asset.types";

const DIRECTION_COUNTS = Object.freeze([4, 8] as const);
const NO_DIRECTION_COUNTS = Object.freeze([] as const);

function capabilitySet(...enabled: readonly AssetCapability[]): AssetCapabilities {
  const enabledCapabilities = new Set(enabled);
  const entries = ASSET_CAPABILITY_IDS.map(
    (capability) => [capability, enabledCapabilities.has(capability)] as const,
  );

  return Object.freeze(Object.fromEntries(entries)) as AssetCapabilities;
}

export const CATEGORY_CAPABILITY_DEFAULTS: Readonly<Record<AssetCategory, AssetCapabilities>> =
  Object.freeze({
    character: capabilitySet(
      "movable",
      "directional",
      "animated",
      "transparent",
      "scaledCharacter",
    ),
    movingObject: capabilitySet("movable", "animated", "transparent", "footprint"),
    staticObject: capabilitySet("transparent", "footprint"),
    texture: capabilitySet("tileable"),
    nature: capabilitySet("transparent", "footprint"),
    building: capabilitySet("gridBound", "transparent", "footprint"),
    tileset: capabilitySet("tileable", "gridBound", "transparent"),
    item: capabilitySet("transparent"),
    artwork: capabilitySet("transparent", "freeComposition"),
  });

type CapabilitySubtypeCatalog = {
  readonly [Category in AssetCategory]: readonly AssetSubtypeByCategory[Category][];
};

export const DIRECTIONAL_SUBTYPES = Object.freeze({
  character: ASSET_SUBTYPES.character,
  movingObject: Object.freeze([
    "cart",
    "rollingObject",
    "slidingObject",
    "mechanicalConstruct",
    "boat",
    "platform",
    "nonHumanoidUnit",
  ] as const),
  staticObject: Object.freeze([]),
  texture: Object.freeze([]),
  nature: Object.freeze([]),
  building: Object.freeze([]),
  tileset: Object.freeze([]),
  item: Object.freeze([]),
  artwork: Object.freeze([]),
} satisfies CapabilitySubtypeCatalog);

export const ANIMATED_SUBTYPES = Object.freeze({
  character: ASSET_SUBTYPES.character,
  movingObject: ASSET_SUBTYPES.movingObject,
  staticObject: Object.freeze(["container", "chest", "door", "interactiveObject"] as const),
  texture: Object.freeze([]),
  nature: Object.freeze([
    "tree",
    "deciduousTree",
    "conifer",
    "witheredTree",
    "magicTree",
    "bush",
    "grassTuft",
    "vine",
  ] as const),
  building: Object.freeze(["gate"] as const),
  tileset: Object.freeze(["animatedTile"] as const),
  item: Object.freeze([]),
  artwork: Object.freeze([]),
} satisfies CapabilitySubtypeCatalog);

export const WEARABLE_SUBTYPES = Object.freeze({
  character: Object.freeze([]),
  movingObject: Object.freeze([]),
  staticObject: Object.freeze([]),
  texture: Object.freeze([]),
  nature: Object.freeze([]),
  building: Object.freeze([]),
  tileset: Object.freeze([]),
  item: Object.freeze(["tool", "clothing", "armorPiece", "bag", "jewelry"] as const),
  artwork: Object.freeze([]),
} satisfies CapabilitySubtypeCatalog);

export const MODULAR_SUBTYPES = Object.freeze({
  character: Object.freeze([]),
  movingObject: Object.freeze([]),
  staticObject: Object.freeze([]),
  texture: Object.freeze([]),
  nature: Object.freeze([]),
  building: Object.freeze(["gate", "fortification", "dungeonModule"] as const),
  tileset: Object.freeze(["transition", "corner", "edge", "autotile"] as const),
  item: Object.freeze([]),
  artwork: Object.freeze([]),
} satisfies CapabilitySubtypeCatalog);

function subtypeListIncludes<
  Catalog extends CapabilitySubtypeCatalog,
  Category extends AssetCategory,
>(catalog: Catalog, category: Category, subtype: AssetSubtypeByCategory[Category]): boolean {
  const subtypes: readonly string[] = catalog[category];
  return subtypes.includes(subtype);
}

function assertKnownSubtype<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): void {
  const knownSubtypes: readonly string[] = ASSET_SUBTYPES[category];
  if (!knownSubtypes.includes(subtype)) {
    throw new RangeError(`Unknown subtype "${subtype}" for asset category "${category}".`);
  }
}

export function resolveCapabilities<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): AssetCapabilities {
  assertKnownSubtype(category, subtype);

  const defaults = CATEGORY_CAPABILITY_DEFAULTS[category];
  return Object.freeze({
    ...defaults,
    directional: subtypeListIncludes(DIRECTIONAL_SUBTYPES, category, subtype),
    animated: subtypeListIncludes(ANIMATED_SUBTYPES, category, subtype),
    wearable: subtypeListIncludes(WEARABLE_SUBTYPES, category, subtype),
    modular: subtypeListIncludes(MODULAR_SUBTYPES, category, subtype),
  });
}

export function supportsDirections<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): boolean {
  return resolveCapabilities(category, subtype).directional;
}

export function supportsAnimation<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): boolean {
  return resolveCapabilities(category, subtype).animated;
}

export function requiresCharacterScale<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): boolean {
  return resolveCapabilities(category, subtype).scaledCharacter;
}

export function getAllowedDirectionCounts<Category extends AssetCategory>(
  category: Category,
  subtype: AssetSubtypeByCategory[Category],
): readonly DirectionCount[] {
  return supportsDirections(category, subtype) ? DIRECTION_COUNTS : NO_DIRECTION_COUNTS;
}
