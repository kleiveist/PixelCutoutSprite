export const ASSET_CATEGORY_IDS = Object.freeze([
  "character",
  "movingObject",
  "staticObject",
  "texture",
  "nature",
  "building",
  "tileset",
  "item",
  "artwork",
] as const);

export type AssetCategory = (typeof ASSET_CATEGORY_IDS)[number];

export const ASSET_CAPABILITY_IDS = Object.freeze([
  "movable",
  "directional",
  "animated",
  "tileable",
  "gridBound",
  "transparent",
  "scaledCharacter",
  "footprint",
  "wearable",
  "modular",
  "freeComposition",
] as const);

export type AssetCapability = (typeof ASSET_CAPABILITY_IDS)[number];
export type AssetCapabilities = Readonly<Record<AssetCapability, boolean>>;

export const ASSET_SUBTYPES = Object.freeze({
  character: Object.freeze([
    "hero",
    "npc",
    "merchant",
    "villager",
    "artisan",
    "guard",
    "scholar",
    "religiousFigure",
    "enemy",
    "boss",
    "animal",
    "creature",
  ] as const),
  movingObject: Object.freeze([
    "cart",
    "rollingObject",
    "floatingObject",
    "floatingCrystal",
    "slidingObject",
    "mechanicalConstruct",
    "boat",
    "platform",
    "magicObject",
    "nonHumanoidUnit",
  ] as const),
  staticObject: Object.freeze([
    "furniture",
    "container",
    "barrel",
    "crate",
    "chest",
    "door",
    "well",
    "sign",
    "pillar",
    "altar",
    "decoration",
    "workTool",
    "interactiveObject",
  ] as const),
  texture: Object.freeze([
    "wood",
    "stone",
    "snow",
    "ice",
    "earth",
    "sand",
    "grass",
    "moss",
    "metal",
    "fabric",
    "leather",
    "brick",
    "paving",
    "clay",
    "ceramic",
    "customMaterial",
  ] as const),
  nature: Object.freeze([
    "tree",
    "deciduousTree",
    "conifer",
    "witheredTree",
    "magicTree",
    "bush",
    "grassTuft",
    "mushroom",
    "root",
    "treeStump",
    "vine",
  ] as const),
  building: Object.freeze([
    "house",
    "hut",
    "shop",
    "workshop",
    "inn",
    "tower",
    "gate",
    "temple",
    "ruin",
    "fortification",
    "dungeonModule",
  ] as const),
  tileset: Object.freeze([
    "groundTile",
    "wallTile",
    "roofPart",
    "transition",
    "corner",
    "edge",
    "autotile",
    "decal",
    "animatedTile",
  ] as const),
  item: Object.freeze([
    "sword",
    "potion",
    "weapon",
    "tool",
    "clothing",
    "armorPiece",
    "bag",
    "jewelry",
    "consumable",
    "keyItem",
    "questItem",
    "collectible",
  ] as const),
  artwork: Object.freeze([
    "concept",
    "characterConcept",
    "environmentConcept",
    "buildingConcept",
    "materialStudy",
    "scene",
    "promoArtwork",
    "moodPainting",
  ] as const),
});

export type AssetSubtypeByCategory = {
  readonly [Category in AssetCategory]: (typeof ASSET_SUBTYPES)[Category][number];
};

export type AssetSubtype = AssetSubtypeByCategory[AssetCategory];

export type AssetSelection = {
  readonly [Category in AssetCategory]: Readonly<{
    category: Category;
    subtype: AssetSubtypeByCategory[Category];
  }>;
}[AssetCategory];

export type DirectionCount = 4 | 8;

type AssetCategoryCatalog = {
  readonly [Category in AssetCategory]: Readonly<{
    id: Category;
    subtypes: (typeof ASSET_SUBTYPES)[Category];
  }>;
};

export const ASSET_CATEGORY_CATALOG = Object.freeze({
  character: Object.freeze({ id: "character", subtypes: ASSET_SUBTYPES.character }),
  movingObject: Object.freeze({ id: "movingObject", subtypes: ASSET_SUBTYPES.movingObject }),
  staticObject: Object.freeze({ id: "staticObject", subtypes: ASSET_SUBTYPES.staticObject }),
  texture: Object.freeze({ id: "texture", subtypes: ASSET_SUBTYPES.texture }),
  nature: Object.freeze({ id: "nature", subtypes: ASSET_SUBTYPES.nature }),
  building: Object.freeze({ id: "building", subtypes: ASSET_SUBTYPES.building }),
  tileset: Object.freeze({ id: "tileset", subtypes: ASSET_SUBTYPES.tileset }),
  item: Object.freeze({ id: "item", subtypes: ASSET_SUBTYPES.item }),
  artwork: Object.freeze({ id: "artwork", subtypes: ASSET_SUBTYPES.artwork }),
} satisfies AssetCategoryCatalog);
