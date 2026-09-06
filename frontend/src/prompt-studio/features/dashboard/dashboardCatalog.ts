import { ASSET_CATEGORY_IDS, type AssetCategory, type AssetSubtype } from "../../domain/assets";

export type DashboardAccent =
  "ember" | "sky" | "clay" | "violet" | "leaf" | "gold" | "aqua" | "rose" | "indigo";

export interface DashboardCategoryDefinition {
  readonly id: AssetCategory;
  readonly label: string;
  readonly shortDescription: string;
  readonly examples: string;
  readonly capabilityLabel: string;
  readonly accent: DashboardAccent;
}

const categoryDefinitions = {
  character: {
    id: "character",
    label: "Charakter / Figur",
    shortDescription: "Helden, NPCs, Gegner und Kreaturen mit klarer Silhouette.",
    examples: "NPC · Held · Boss",
    capabilityLabel: "Richtung + Animation",
    accent: "ember",
  },
  movingObject: {
    id: "movingObject",
    label: "Bewegliches Objekt",
    shortDescription: "Wagen, Maschinen und magische Konstrukte in Bewegung.",
    examples: "Wagen · Boot · Mechanik",
    capabilityLabel: "Bewegungslogik",
    accent: "sky",
  },
  staticObject: {
    id: "staticObject",
    label: "Statisches Objekt",
    shortDescription: "Lesbare Weltobjekte ohne unnötige Richtungsvarianten.",
    examples: "Kiste · Brunnen · Altar",
    capabilityLabel: "World Asset",
    accent: "clay",
  },
  texture: {
    id: "texture",
    label: "Textur / Material",
    shortDescription: "Kachelbare Oberflächen mit kontrollierter Materialwirkung.",
    examples: "Holz · Stein · Schnee",
    capabilityLabel: "Seamless + Material",
    accent: "violet",
  },
  nature: {
    id: "nature",
    label: "Natur / Pflanze",
    shortDescription: "Bäume, Büsche und organische Elemente im Weltmaßstab.",
    examples: "Baum · Pilz · Wurzel",
    capabilityLabel: "World Scale",
    accent: "leaf",
  },
  building: {
    id: "building",
    label: "Gebäude / Architektur",
    shortDescription: "Häuser, Ruinen und modulare Architekturbausteine.",
    examples: "Haus · Turm · Tempel",
    capabilityLabel: "Footprint + Grid",
    accent: "gold",
  },
  tileset: {
    id: "tileset",
    label: "Tileset / Mapping",
    shortDescription: "Böden, Wände und Übergänge für konsistente Karten.",
    examples: "Boden · Wand · Autotile",
    capabilityLabel: "Grid + Tileable",
    accent: "aqua",
  },
  item: {
    id: "item",
    label: "Item / Ausrüstung",
    shortDescription: "Kompakte Waffen, Werkzeuge, Kleidung und Questobjekte.",
    examples: "Schwert · Trank · Werkzeug",
    capabilityLabel: "Icon + World Asset",
    accent: "rose",
  },
  artwork: {
    id: "artwork",
    label: "Artwork / Konzeptbild",
    shortDescription: "Freie Motive und Szenen ohne erzwungene Tile-Geometrie.",
    examples: "Konzept · Szene · Promo",
    capabilityLabel: "Freie Komposition",
    accent: "indigo",
  },
} as const satisfies Record<AssetCategory, DashboardCategoryDefinition>;

export const DASHBOARD_CATEGORIES = ASSET_CATEGORY_IDS.map(
  (category) => categoryDefinitions[category],
);

export function getDashboardCategory(category: AssetCategory): DashboardCategoryDefinition {
  return categoryDefinitions[category];
}

const subtypeLabels: Readonly<Partial<Record<AssetSubtype, string>>> = {
  hero: "Held",
  npc: "NPC",
  merchant: "Händler",
  villager: "Dorfbewohner",
  artisan: "Handwerker",
  guard: "Wache",
  enemy: "Gegner",
  boss: "Boss",
  animal: "Tier",
  creature: "Kreatur",
  cart: "Wagen",
  floatingCrystal: "Schwebender Kristall",
  mechanicalConstruct: "Mechanisches Konstrukt",
  furniture: "Möbel",
  container: "Behälter",
  barrel: "Fass",
  crate: "Kiste",
  chest: "Truhe",
  door: "Tür",
  well: "Brunnen",
  wood: "Holz",
  stone: "Stein",
  snow: "Schnee",
  ice: "Eis",
  metal: "Metall",
  fabric: "Stoff",
  tree: "Baum",
  bush: "Busch",
  mushroom: "Pilz",
  house: "Haus",
  hut: "Hütte",
  tower: "Turm",
  temple: "Tempel",
  ruin: "Ruine",
  groundTile: "Bodentile",
  wallTile: "Wandtile",
  transition: "Übergang",
  weapon: "Waffe",
  tool: "Werkzeug",
  armorPiece: "Rüstungsteil",
  consumable: "Verbrauchsitem",
  questItem: "Questobjekt",
  characterConcept: "Charakterkonzept",
  environmentConcept: "Umgebungskonzept",
  scene: "Szene",
  promoArtwork: "Promo-Artwork",
};

export function formatSubtypeLabel(subtype: AssetSubtype): string {
  const knownLabel = subtypeLabels[subtype];
  if (knownLabel) return knownLabel;

  const words = subtype.replace(/([a-z])([A-Z])/g, "$1 $2");
  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}

export const MATERIAL_BADGE_IDS = [
  "wood",
  "stone",
  "snow",
  "ice",
  "metal",
  "cloth",
  "leather",
] as const;

export type MaterialBadgeId = (typeof MATERIAL_BADGE_IDS)[number];

export const MATERIAL_BADGE_LABELS = {
  wood: "Holz",
  stone: "Stein",
  snow: "Schnee",
  ice: "Eis",
  metal: "Metall",
  cloth: "Stoff",
  leather: "Leder",
} as const satisfies Record<MaterialBadgeId, string>;
