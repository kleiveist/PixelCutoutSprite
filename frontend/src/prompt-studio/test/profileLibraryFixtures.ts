import { resolveCapabilities, type AssetSelection } from "../domain/assets";
import { createCompatibilityKey } from "../domain/profiles";
import {
  ProfileLibrarySchema,
  parseAssetProfile,
  parseBaseProfile,
  parseCategoryProfile,
  type AssetProfile,
  type BaseProfile,
  type ProfileLibrary,
} from "../schemas";

export const PROFILE_FIXTURE_TIMESTAMP = "2026-09-02T12:00:00.000Z";

const sharedValues = {
  pixelDensity: "modernHd",
  styleProfile: "both",
  tileSize: 32,
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

function baseProfile(id: string, name: string, characterHeight: number): BaseProfile {
  return parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id,
    name,
    iconId: "world-grid",
    values: { ...sharedValues, characterHeight },
    locks: {},
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: PROFILE_FIXTURE_TIMESTAMP,
  });
}

function compatibility(base: BaseProfile, selection: AssetSelection): string {
  return createCompatibilityKey(base.values, selection);
}

export function createProfileLibraryFixture(): ProfileLibrary {
  const base80 = baseProfile("base_world_80", "Weltfamilie 32 px / Figuren 80 px", 80);
  const base80Twin = baseProfile("base_world_80_twin", "Parallele Weltfamilie 80 px", 80);
  const base96 = baseProfile("base_world_96", "Weltfamilie 32 px / Figuren 96 px", 96);
  const unusedBase = baseProfile("base_unused", "Unbenutztes Basisprofil", 72);

  const npcSelection = { category: "character", subtype: "npc" } as const;
  const npcCategory = parseCategoryProfile({
    schemaVersion: 2,
    kind: "categoryProfile",
    id: "category_npc_80",
    name: "NPCs 80 px",
    baseProfileId: base80.id,
    category: npcSelection.category,
    subtype: npcSelection.subtype,
    iconId: "character-npc",
    capabilities: resolveCapabilities(npcSelection.category, npcSelection.subtype),
    overrides: {},
    defaults: { animationAction: "walk", directionCount: 8 },
    tags: ["NPC"],
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: PROFILE_FIXTURE_TIMESTAMP,
  });

  const smith = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_smith_80",
    name: "Dorfschmied mit Lederschürze",
    baseProfileId: base80.id,
    categoryProfileId: npcCategory.id,
    compatibilityKey: compatibility(base80, npcSelection),
    category: npcSelection.category,
    subtype: npcSelection.subtype,
    iconId: "character-npc",
    badgeIconIds: ["material-leather", "material-metal"],
    capabilities: resolveCapabilities(npcSelection.category, npcSelection.subtype),
    overrides: {},
    answers: {
      role: "blacksmith",
      directionCount: 8,
      animationAction: "walk",
      framesPerDirection: 5,
    },
    tags: ["Dorf", "Handwerk", "Leder", "Metall", "Geheimfund"],
    favorite: true,
    migratedFromVersion: 1,
    legacyData: { source: "fixture" },
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T18:00:00.000Z",
  });

  const guard = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_guard_80",
    name: "Wache am Nordtor",
    baseProfileId: base80Twin.id,
    compatibilityKey: compatibility(base80Twin, npcSelection),
    category: npcSelection.category,
    subtype: npcSelection.subtype,
    iconId: "character-npc",
    badgeIconIds: ["material-metal"],
    capabilities: resolveCapabilities(npcSelection.category, npcSelection.subtype),
    overrides: {},
    answers: {
      role: "guard",
      directionCount: 8,
      animationAction: "idle",
      framesPerDirection: 4,
    },
    tags: ["Stadt", "Wache"],
    favorite: false,
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T17:00:00.000Z",
  });

  const mage = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_mage_96",
    name: "Hofmagier 96 px",
    baseProfileId: base96.id,
    compatibilityKey: compatibility(base96, npcSelection),
    category: npcSelection.category,
    subtype: npcSelection.subtype,
    iconId: "character-npc",
    badgeIconIds: ["material-cloth"],
    capabilities: resolveCapabilities(npcSelection.category, npcSelection.subtype),
    overrides: {},
    answers: { role: "mage", directionCount: 4 },
    tags: ["Hof", "Magie"],
    favorite: false,
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T16:00:00.000Z",
  });

  const woodSelection = { category: "texture", subtype: "wood" } as const;
  const wood = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_oak_wood",
    name: "Nahtlose Eichenplanken",
    baseProfileId: base80.id,
    compatibilityKey: compatibility(base80, woodSelection),
    category: woodSelection.category,
    subtype: woodSelection.subtype,
    iconId: "texture-grid",
    badgeIconIds: ["material-wood"],
    capabilities: resolveCapabilities(woodSelection.category, woodSelection.subtype),
    overrides: {},
    answers: { seamless: true, usage: "floor" },
    tags: ["Material", "Eiche"],
    favorite: false,
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T15:00:00.000Z",
  });

  const stoneSelection = { category: "texture", subtype: "stone" } as const;
  const stone = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_wet_stone",
    name: "Nasser grauer Stein",
    baseProfileId: base96.id,
    compatibilityKey: compatibility(base96, stoneSelection),
    category: stoneSelection.category,
    subtype: stoneSelection.subtype,
    iconId: "texture-grid",
    badgeIconIds: ["material-stone"],
    capabilities: resolveCapabilities(stoneSelection.category, stoneSelection.subtype),
    overrides: {},
    answers: { seamless: true, usage: "wall", condition: "wet" },
    tags: ["Material", "Dungeon"],
    favorite: true,
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T14:00:00.000Z",
  });

  const artworkSelection = {
    category: "artwork",
    subtype: "promoArtwork",
  } as const;
  const artwork = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_forest_promo",
    name: "Nachtwald Key Art",
    baseProfileId: base80.id,
    compatibilityKey: compatibility(base80, artworkSelection),
    category: artworkSelection.category,
    subtype: artworkSelection.subtype,
    iconId: "artwork-frame",
    badgeIconIds: [],
    capabilities: resolveCapabilities(artworkSelection.category, artworkSelection.subtype),
    overrides: {},
    answers: {
      purpose: "presentation",
      composition: "scene",
      background: "complete",
    },
    tags: ["Promo", "Wald"],
    favorite: false,
    createdAt: PROFILE_FIXTURE_TIMESTAMP,
    updatedAt: "2026-09-02T13:00:00.000Z",
  });

  const assetProfiles: readonly AssetProfile[] = [smith, guard, mage, wood, stone, artwork];

  return ProfileLibrarySchema.parse({
    baseProfiles: [base80, base80Twin, base96, unusedBase],
    categoryProfiles: [npcCategory],
    assetProfiles,
  });
}
