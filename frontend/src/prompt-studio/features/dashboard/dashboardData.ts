import type { AssetSubtype } from "../../domain/assets";
import {
  getDefaultArtworkType,
  type ArtworkComposition,
  type ArtworkDetailLevel,
  type ArtworkFocus,
  type ArtworkFormat,
  type ArtworkLightingDrama,
  type ArtworkMotif,
  type ArtworkPurpose,
  type ArtworkType,
} from "../../domain/artworks";
import {
  getDefaultBuildingType,
  type BuildingCollisionMode,
  type BuildingCondition,
  type BuildingFacadeStyle,
  type BuildingLighting,
  type BuildingMappingMode,
  type BuildingMaterial,
  type BuildingOccupancy,
  type BuildingRoofMaterial,
  type BuildingRoofShape,
  type BuildingSize,
  type BuildingType,
} from "../../domain/buildings";
import type {
  MovingObjectAnchorMode,
  MovingObjectClass,
  MovingObjectCondition,
  MovingObjectMaterial,
} from "../../domain/moving-objects";
import {
  getDefaultItemClass,
  type ItemClass,
  type ItemCondition,
  type ItemMaterial,
  type ItemPresentation,
  type ItemPurpose,
  type ItemReadability,
  type ItemShadowMode,
  type ItemSignificance,
  type ItemSize,
} from "../../domain/items";
import { getDefaultMovingObjectClass } from "../../domain/moving-objects";
import {
  getDefaultTextureMaterialType,
  type TextureCondition,
  type TextureIcing,
  type TextureLighting,
  type TextureMaterialType,
  type TextureMoisture,
  type TextureOrientation,
  type TextureStructure,
  type TextureSubtype,
  type TextureSurface,
  type TextureUsage,
} from "../../domain/textures";
import {
  getDefaultNaturePlantType,
  type NatureAge,
  type NatureClimate,
  type NatureCrownDensity,
  type NatureCrownShape,
  type NatureGrounding,
  type NatureMossCoverage,
  type NatureMushroomGrowth,
  type NaturePlantType,
  type NatureRootVisibility,
  type NatureSeason,
  type NatureSilhouette,
  type NatureSnowCover,
  type NatureTrunkShape,
  type NatureTrunkThickness,
  type NatureVineGrowth,
} from "../../domain/nature";
import {
  getDefaultStaticObjectClass,
  type StaticObjectBasicShape,
  type StaticObjectClass,
  type StaticObjectCondition,
  type StaticObjectInteraction,
  type StaticObjectMaterial,
  type StaticObjectProportion,
  type StaticObjectPurpose,
  type StaticObjectShadowMode,
  type StaticObjectSymmetry,
} from "../../domain/static-objects";
import {
  createTilesetTechnicalSpecification,
  getDefaultTilesetType,
  type TilesetAtlasLayout,
  type TilesetCornerSet,
  type TilesetEdgeSet,
  type TilesetRepeatMode,
  type TilesetSeamMode,
  type TilesetTransitionMode,
  type TilesetType,
  type TilesetUsage,
  type TilesetVariantKind,
} from "../../domain/tilesets";
import { resolveProfile, type ResolvedProfile } from "../../domain/profiles";
import type {
  AssetProfile,
  BaseProfile,
  ProfileLibrary,
  StableId,
  WizardDraft,
} from "../../schemas";
import type { StorageReadResult, V2StorageAdapter } from "../../services";
import {
  MATERIAL_BADGE_IDS,
  formatSubtypeLabel,
  getDashboardCategory,
  type MaterialBadgeId,
} from "./dashboardCatalog";

const RECENT_PROFILE_LIMIT = 3;
const FAVORITE_PROFILE_LIMIT = 3;
const BASE_PROFILE_LIMIT = 3;

export type DashboardStorage = Pick<V2StorageAdapter, "readDraft" | "readProfileLibrary">;

export interface DashboardProfileSummary {
  readonly id: StableId;
  readonly name: string;
  readonly category: AssetProfile["category"];
  readonly subtype: AssetProfile["subtype"];
  readonly categoryLabel: string;
  readonly subtypeLabel: string;
  readonly baseProfileName: string;
  readonly baseProfileId: StableId;
  readonly compatibilityKey: string;
  readonly facts: readonly string[];
  readonly tags: readonly string[];
  readonly materials: readonly MaterialBadgeId[];
  readonly favorite: boolean;
  readonly updatedAt: string;
}

export interface DashboardBaseProfileSummary {
  readonly id: StableId;
  readonly name: string;
  readonly facts: readonly string[];
  readonly active: boolean;
  readonly updatedAt: string;
}

export type DashboardCollectionStatus = "ready" | "empty" | "invalid" | "unavailable";
export type DashboardDraftStatus = "ready" | "empty" | "invalid" | "unavailable";

export interface DashboardData {
  readonly collectionStatus: DashboardCollectionStatus;
  readonly recentProfiles: readonly DashboardProfileSummary[];
  readonly favoriteProfiles: readonly DashboardProfileSummary[];
  readonly baseProfiles: readonly DashboardBaseProfileSummary[];
  readonly skippedProfileCount: number;
  readonly draftStatus: DashboardDraftStatus;
  readonly draft: WizardDraft | null;
}

const pixelDensityLabels = {
  classicHd: "Classic-HD",
  modernHd: "Modern-HD",
  ultraHd: "Ultra-HD",
} as const;

const perspectiveLabels = {
  topdown: "Top-down",
  threeQuarter: "3/4-RPG",
  isometric: "Isometrisch",
  side: "Seitenansicht",
} as const;

const styleProfileLabels = {
  classic: "Stil A",
  dark: "Stil B",
  both: "Stil A + B",
} as const;

const movementTypeLabels = {
  roll: "Rollen",
  slide: "Gleiten",
  hover: "Schweben",
  walk: "Laufen",
  crawl: "Kriechen",
  fly: "Fliegen",
  rotate: "Rotieren",
} as const;

const movingObjectClassLabels: Readonly<Record<MovingObjectClass, string>> = {
  cart: "Karren / Wagen",
  rollingObject: "Rollendes Objekt",
  floatingObject: "Schwebendes Objekt",
  slidingObject: "Gleitendes Objekt",
  mechanicalConstruct: "Mechanische Konstruktion",
  boat: "Boot",
  platform: "Plattform",
  magicObject: "Magisches Objekt",
  nonHumanoidUnit: "Nicht-humanoide Einheit",
};

const movingObjectAnchorLabels: Readonly<Record<MovingObjectAnchorMode, string>> = {
  automatic: "Automatischer Anker",
  bottomCenter: "Anker unten mittig",
  footprintCenter: "Anker in Standflächenmitte",
  canvasCenter: "Anker in Canvas-Mitte",
};

const movingObjectMaterialLabels: Readonly<Record<MovingObjectMaterial, string>> = {
  wood: "Holz",
  metal: "Metall",
  fabric: "Stoff",
  stone: "Stein",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
};

const movingObjectConditionLabels: Readonly<Record<MovingObjectCondition, string>> = {
  new: "Neu",
  used: "Gebraucht",
  damaged: "Beschädigt",
  improvised: "Provisorisch",
};

const textureMaterialLabels: Readonly<Record<TextureMaterialType, string>> = {
  wood: "Holz",
  stone: "Stein",
  snow: "Schnee",
  ice: "Eis",
  earth: "Erde",
  sand: "Sand",
  grass: "Gras",
  moss: "Moos",
  metal: "Metall",
  fabric: "Stoff",
  leather: "Leder",
  brick: "Ziegel",
  paving: "Pflaster",
  clay: "Lehm",
  ceramic: "Keramik",
  customMaterial: "Eigenes Material",
};

const textureUsageLabels: Readonly<Record<TextureUsage, string>> = {
  floor: "Boden",
  wall: "Wand",
  roof: "Dach",
  surface: "Objektoberfläche",
  clothing: "Kleidung",
  decor: "Dekor",
};

const textureStructureLabels: Readonly<Record<TextureStructure, string>> = {
  fine: "Fein",
  medium: "Mittel",
  coarse: "Grob",
};

const textureConditionLabels: Readonly<Record<TextureCondition, string>> = {
  new: "Neu",
  polished: "Poliert",
  rough: "Rau",
  old: "Alt",
  wet: "Nass",
  frosted: "Frostig",
  damaged: "Beschädigt",
  dirty: "Verschmutzt",
};

const textureLightingLabels: Readonly<Record<TextureLighting, string>> = {
  neutralEven: "Neutral beleuchtet",
  contextual: "Kontextlicht",
  worldAligned: "Weltlicht",
};

const textureSurfaceLabels: Readonly<Record<TextureSurface, string>> = {
  continuous: "Durchgehend",
  planked: "Planken",
  jointed: "Mit Fugen",
  cracked: "Rissig",
  granular: "Körnig",
  layered: "Geschichtet",
  woven: "Gewebt",
  organic: "Organisch",
};

const textureMoistureLabels: Readonly<Record<TextureMoisture, string>> = {
  dry: "Trocken",
  damp: "Feucht",
  wet: "Nass",
};

const textureIcingLabels: Readonly<Record<TextureIcing, string>> = {
  none: "Keine",
  lightFrost: "Leichter Frost",
  frosted: "Bereift",
  iceCrusted: "Eiskruste",
};

const textureOrientationLabels: Readonly<Record<TextureOrientation, string>> = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  radial: "Radial",
  unordered: "Ungeordnet",
  grainAligned: "Entlang der Maserung",
};

const naturePlantTypeLabels: Readonly<Record<NaturePlantType, string>> = {
  tree: "Baum",
  bush: "Busch",
  grass: "Grasbüschel",
  mushroom: "Pilz",
  root: "Wurzel",
  treeStump: "Baumstumpf",
  vine: "Ranke",
};

const natureClimateLabels: Readonly<Record<NatureClimate, string>> = {
  temperate: "Gemäßigt",
  mountain: "Gebirge",
  snow: "Schneegebiet",
  swamp: "Sumpf",
  dry: "Trocken",
  dark: "Düsterwald",
  magical: "Magischer Wald",
};

const natureSeasonLabels: Readonly<Record<NatureSeason, string>> = {
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
  winter: "Winter",
  timeless: "Zeitlos",
};

const natureAgeLabels: Readonly<Record<NatureAge, string>> = {
  young: "Jung",
  mature: "Ausgewachsen",
  ancient: "Uralt",
  dead: "Abgestorben",
};

const natureSilhouetteLabels: Readonly<Record<NatureSilhouette, string>> = {
  broad: "Breit",
  narrow: "Schmal",
  asymmetric: "Asymmetrisch",
  gnarled: "Knorrig",
  upright: "Aufrecht",
  spreading: "Ausladend",
  compact: "Kompakt",
};

const natureTrunkThicknessLabels: Readonly<Record<NatureTrunkThickness, string>> = {
  thin: "Dünn",
  medium: "Mittel",
  thick: "Dick",
  massive: "Massiv",
};

const natureTrunkShapeLabels: Readonly<Record<NatureTrunkShape, string>> = {
  straight: "Gerade",
  tapered: "Konisch",
  twisted: "Verdreht",
  gnarled: "Knorrig",
  split: "Gespalten",
  hollow: "Hohl",
};

const natureCrownShapeLabels: Readonly<Record<NatureCrownShape, string>> = {
  round: "Rund",
  tall: "Hoch",
  tiered: "Gestuft",
  spreading: "Ausladend",
  conical: "Kegelförmig",
  irregular: "Unregelmäßig",
  damaged: "Beschädigt",
  bare: "Kahl",
};

const natureCrownDensityLabels: Readonly<Record<NatureCrownDensity, string>> = {
  sparse: "Spärlich",
  loose: "Locker",
  medium: "Mittel",
  dense: "Dicht",
  bare: "Kahl",
};

const natureRootVisibilityLabels: Readonly<Record<NatureRootVisibility, string>> = {
  hidden: "Verdeckt",
  visible: "Sichtbar",
  spreading: "Ausladend",
  rockWrapping: "Felsen umschlingend",
  exposed: "Freigelegt",
};

const natureMossLabels: Readonly<Record<NatureMossCoverage, string>> = {
  none: "Kein Moos",
  light: "Leicht",
  moderate: "Mittel",
  heavy: "Stark",
};

const natureMushroomLabels: Readonly<Record<NatureMushroomGrowth, string>> = {
  none: "Keine Pilze",
  few: "Vereinzelt",
  clustered: "In Gruppen",
  abundant: "Reichlich",
};

const natureSnowLabels: Readonly<Record<NatureSnowCover, string>> = {
  none: "Kein Schnee",
  dusting: "Leicht bestäubt",
  partial: "Teilweise bedeckt",
  covered: "Bedeckt",
  heavy: "Stark bedeckt",
};

const natureVineLabels: Readonly<Record<NatureVineGrowth, string>> = {
  none: "Keine Ranken",
  light: "Leicht",
  draped: "Herabhängend",
  entangled: "Dicht verschlungen",
};

const natureGroundingLabels: Readonly<Record<NatureGrounding, string>> = {
  natural: "Natürlich eingebettet",
  soilPatch: "Erdfläche",
  grassPatch: "Grasfläche",
  rocky: "Felsig",
  snowy: "Verschneit",
  swampy: "Sumpfig",
  freestanding: "Freigestellt",
};

const staticObjectClassLabels: Readonly<Record<StaticObjectClass, string>> = {
  furniture: "Möbel",
  container: "Behälter",
  door: "Tür",
  well: "Brunnen",
  sign: "Schild",
  pillar: "Säule",
  altar: "Altar",
  decoration: "Dekoration",
  workTool: "Arbeitsgerät",
  interactiveObject: "Interaktives Objekt",
};

const staticObjectPurposeLabels: Readonly<Record<StaticObjectPurpose, string>> = {
  decorative: "Dekorativ",
  interactive: "Interaktiv",
  walkable: "Begehbar",
  blocking: "Blockierend",
};

const staticObjectShapeLabels: Readonly<Record<StaticObjectBasicShape, string>> = {
  boxy: "Kastenförmig",
  cylindrical: "Zylindrisch",
  round: "Rund",
  planar: "Flächig",
  arched: "Bogenförmig",
  stepped: "Gestuft",
  organic: "Organisch",
  irregular: "Unregelmäßig",
  custom: "Individuell",
};

const staticObjectProportionLabels: Readonly<Record<StaticObjectProportion, string>> = {
  compact: "Kompakt",
  balanced: "Ausgewogen",
  tall: "Hoch",
  wide: "Breit",
  low: "Niedrig",
  slender: "Schlank",
  massive: "Massiv",
};

const staticObjectSymmetryLabels: Readonly<Record<StaticObjectSymmetry, string>> = {
  bilateral: "Bilateral",
  radial: "Radial",
  asymmetric: "Asymmetrisch",
  none: "Keine",
};

const staticObjectMaterialLabels: Readonly<Record<StaticObjectMaterial, string>> = {
  wood: "Holz",
  stone: "Stein",
  metal: "Metall",
  ceramic: "Keramik",
  glass: "Glas",
  fabric: "Stoff",
  leather: "Leder",
  rope: "Seil",
  bone: "Knochen",
  organic: "Organisches Material",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
  custom: "Eigenes Material",
};

const staticObjectConditionLabels: Readonly<Record<StaticObjectCondition, string>> = {
  clean: "Sauber",
  used: "Gebraucht",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  overgrown: "Überwachsen",
};

const staticObjectInteractionLabels: Readonly<Record<StaticObjectInteraction, string>> = {
  none: "Keine",
  open: "Öffnen",
  tilt: "Kippen",
  glow: "Leuchten",
  break: "Zerbrechen",
};

const staticObjectShadowLabels: Readonly<Record<StaticObjectShadowMode, string>> = {
  none: "Kein Schatten",
  contact: "Kontaktschatten",
};

const buildingTypeLabels: Readonly<Record<BuildingType, string>> = {
  residential: "Wohngebäude",
  commercial: "Geschäftsgebäude",
  workshop: "Werkstattgebäude",
  hospitality: "Beherbergung / Gasthaus",
  tower: "Turmbau",
  gate: "Torbau",
  sacred: "Sakralbau",
  ruin: "Ruinenbau",
  fortification: "Befestigungsbau",
  dungeonModule: "Dungeon-Modul",
};

const buildingSizeLabels: Readonly<Record<BuildingSize, string>> = {
  compact: "Kompakt",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  monumental: "Monumental",
};

const buildingMaterialLabels: Readonly<Record<BuildingMaterial, string>> = {
  wood: "Holz",
  stone: "Stein",
  clay: "Lehm",
  brick: "Ziegel",
  plaster: "Putz",
  metal: "Metall",
  timberFrame: "Fachwerk",
  mixed: "Mischbau",
  custom: "Eigenes Material",
};

const buildingRoofShapeLabels: Readonly<Record<BuildingRoofShape, string>> = {
  gable: "Satteldach",
  hipped: "Walmdach",
  flat: "Flachdach",
  shed: "Pultdach",
  conical: "Kegeldach",
  domed: "Kuppeldach",
  collapsed: "Eingestürzt",
  none: "Kein Dach",
  custom: "Individuell",
};

const buildingRoofMaterialLabels: Readonly<Record<BuildingRoofMaterial, string>> = {
  thatch: "Reet / Stroh",
  woodShingle: "Holzschindeln",
  slate: "Schiefer",
  tile: "Dachziegel",
  metal: "Metall",
  stone: "Stein",
  earth: "Erde / Grassoden",
  mixed: "Mischmaterial",
  none: "Kein Dachmaterial",
  custom: "Eigenes Material",
};

const buildingFacadeLabels: Readonly<Record<BuildingFacadeStyle, string>> = {
  timberFrame: "Fachwerk",
  plastered: "Verputzt",
  masonry: "Sichtmauerwerk",
  brick: "Ziegelfassade",
  fortified: "Befestigt",
  carved: "Verziert / gemeißelt",
  ruined: "Aufgebrochen / ruinös",
  mixed: "Gemischt",
  custom: "Individuell",
};

const buildingConditionLabels: Readonly<Record<BuildingCondition, string>> = {
  maintained: "Gepflegt",
  used: "Genutzt",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  abandoned: "Verlassen",
  overgrown: "Überwuchert",
};

const buildingOccupancyLabels: Readonly<Record<BuildingOccupancy, string>> = {
  inhabited: "Bewohnt",
  active: "Aktiv genutzt",
  vacant: "Leerstehend",
  abandoned: "Verlassen",
};

const buildingMappingLabels: Readonly<Record<BuildingMappingMode, string>> = {
  freestanding: "Freistehend",
  mapIntegrated: "In Karte integriert",
  tileAligned: "Am Tile-Raster ausgerichtet",
  modularSet: "Modularer Bauteilsatz",
};

const buildingCollisionLabels: Readonly<Record<BuildingCollisionMode, string>> = {
  fullyBlocking: "Vollständig blockierend",
  walkableEntrance: "Begehbarer Eingang",
  walkableInterior: "Begehbarer Innenraum",
  mixed: "Gemischte Kollisionszonen",
};

const buildingLightingLabels: Readonly<Record<BuildingLighting, string>> = {
  worldAligned: "Nur geerbtes Weltlicht",
  warmInterior: "Warmes Innenlicht",
  darkInterior: "Dunkler Innenraum",
  neutralInterior: "Neutrales Innenlicht",
  visibleSources: "Sichtbare lokale Lichtquellen",
  emissive: "Kontrolliert emissiv",
  custom: "Individuell",
};

const tilesetTypeLabels: Readonly<Record<TilesetType, string>> = {
  ground: "Boden",
  wall: "Wand",
  roof: "Dach",
  transition: "Materialübergang",
  corner: "Eckverbindung",
  edge: "Kantenverbindung",
  autotile: "Regelbasiertes Autotile",
  decal: "Tile-Dekal",
  animated: "Animiertes Tile",
};

const tilesetUsageLabels: Readonly<Record<TilesetUsage, string>> = {
  floor: "Bodenfläche",
  wall: "Wandfläche",
  roof: "Dachfläche",
  transition: "Übergang / Anschluss",
  decor: "Dekoration",
};

const tilesetEdgeLabels: Readonly<Record<TilesetEdgeSet, string>> = {
  none: "Keine eigenen Kanten",
  cardinal: "Vier Kardinalkanten",
  cardinalAndDiagonal: "Kardinal- und Diagonalkanten",
  custom: "Individuelles Kantenset",
};

const tilesetCornerLabels: Readonly<Record<TilesetCornerSet, string>> = {
  none: "Keine Eckvarianten",
  outer: "Außenecken",
  inner: "Innenecken",
  innerAndOuter: "Innen- und Außenecken",
  custom: "Individuelles Eckset",
};

const tilesetTransitionLabels: Readonly<Record<TilesetTransitionMode, string>> = {
  none: "Kein Materialübergang",
  oneWay: "Einseitig",
  bidirectional: "Beidseitig",
  multiMaterial: "Mehrere Materialien",
  custom: "Individuell",
};

const tilesetSeamLabels: Readonly<Record<TilesetSeamMode, string>> = {
  seamless: "Vollständig nahtlos",
  matchedEdges: "Passende Randpixel",
  intentionalBoundary: "Sichtbare Grenze",
  overlap: "Überlappender Rand",
  custom: "Individuell",
};

const tilesetAxesLabels = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  both: "Horizontal und vertikal",
  none: "Keine Achsenwiederholung",
} as const;

const tilesetRepeatLabels: Readonly<Record<TilesetRepeatMode, string>> = {
  strict: "Strikt regelmäßig",
  staggered: "Versetzt",
  randomized: "Kontrolliert variiert",
  nonRepeating: "Nicht wiederholend",
};

const tilesetVariantLabels: Readonly<Record<TilesetVariantKind, string>> = {
  clean: "sauber",
  damaged: "beschädigt",
  decorated: "dekoriert",
  decal: "Dekal",
  seasonal: "saisonal",
  randomized: "zufällig variiert",
};

const tilesetAtlasLayoutLabels: Readonly<Record<TilesetAtlasLayout, string>> = {
  automatic: "Automatisch kompakt",
  singleRow: "Eine Zeile",
  singleColumn: "Eine Spalte",
  fixedColumns: "Feste Spaltenzahl",
};

const itemClassLabels: Readonly<Record<ItemClass, string>> = {
  weapon: "Waffe",
  tool: "Werkzeug",
  clothing: "Kleidung",
  armor: "Rüstung",
  bag: "Tasche",
  jewelry: "Schmuck",
  consumable: "Verbrauchsgegenstand",
  keyItem: "Schlüsselgegenstand",
  questItem: "Questgegenstand",
  collectible: "Sammelobjekt",
};
const itemPurposeLabels: Readonly<Record<ItemPurpose, string>> = {
  practical: "Praktisch",
  decorative: "Dekorativ",
  wearable: "Tragbar",
  usable: "Benutzbar",
};
const itemPresentationLabels: Readonly<Record<ItemPresentation, string>> = {
  icon: "Inventar-Icon",
  worldAsset: "Weltobjekt",
  equipped: "Ausgerüstet",
};
const itemMaterialLabels: Readonly<Record<ItemMaterial, string>> = {
  wood: "Holz",
  metal: "Metall",
  leather: "Leder",
  fabric: "Stoff",
  glass: "Glas",
  ceramic: "Keramik",
  stone: "Stein",
  bone: "Knochen",
  organic: "Organisch",
  liquid: "Flüssigkeit",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
  custom: "Eigenes Material",
};
const itemConditionLabels: Readonly<Record<ItemCondition, string>> = {
  new: "Neu / makellos",
  used: "Gebraucht",
  worn: "Abgenutzt",
  damaged: "Beschädigt",
  ancient: "Alt / historisch",
  magicallyAltered: "Magisch verändert",
};
const itemSignificanceLabels: Readonly<Record<ItemSignificance, string>> = {
  common: "Alltäglich",
  valuable: "Wertvoll",
  rare: "Selten",
  ceremonial: "Zeremoniell",
  magical: "Magisch",
  questCritical: "Handlungsentscheidend",
};
const itemSizeLabels: Readonly<Record<ItemSize, string>> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  oversized: "Überdimensioniert",
};
const itemReadabilityLabels: Readonly<Record<ItemReadability, string>> = {
  silhouetteFirst: "Silhouette zuerst",
  balanced: "Ausgewogen",
  detailRich: "Detailreich",
};
const itemShadowLabels: Readonly<Record<ItemShadowMode, string>> = {
  none: "Kein eigener Schatten",
  contact: "Kontaktschatten",
};

const artworkTypeLabels: Readonly<Record<ArtworkType, string>> = {
  concept: "Konzept",
  characterConcept: "Charakterkonzept",
  environmentConcept: "Umgebungskonzept",
  buildingConcept: "Gebäudeentwurf",
  materialStudy: "Materialstudie",
  scene: "Szene",
  promoArtwork: "Promo-Artwork",
  moodPainting: "Stimmungsbild",
};
const artworkPurposeLabels: Readonly<Record<ArtworkPurpose, string>> = {
  concept: "Konzept",
  presentation: "Präsentation",
  productionReference: "Produktionsreferenz",
};
const artworkMotifLabels: Readonly<Record<ArtworkMotif, string>> = {
  figure: "Figur",
  object: "Objekt",
  environment: "Umgebung",
  scene: "Szene",
};
const artworkCompositionLabels: Readonly<Record<ArtworkComposition, string>> = {
  singleSubject: "Einzelmotiv",
  group: "Gruppe",
  scene: "Gestaffelte Szene",
};
const artworkFormatLabels: Readonly<Record<ArtworkFormat, string>> = {
  square: "Quadratisch",
  portrait: "Hochformat",
  landscape: "Querformat",
  free: "Freies Format",
};
const artworkFocusLabels: Readonly<Record<ArtworkFocus, string>> = {
  form: "Form",
  material: "Material",
  mood: "Stimmung",
  story: "Geschichte",
  scale: "Maßstab",
};
const artworkLightingLabels: Readonly<Record<ArtworkLightingDrama, string>> = {
  neutral: "Neutral",
  warm: "Warm",
  gloomy: "Düster",
  night: "Nacht",
  custom: "Individuell",
};
const artworkDetailLabels: Readonly<Record<ArtworkDetailLevel, string>> = {
  overview: "Übersicht",
  productionConcept: "Produktionskonzept",
  showcase: "Showcase",
};

const animationLabels = {
  idle: "Idle",
  walk: "Walk",
  run: "Run",
  use: "Benutzen",
  interact: "Interaktion",
  talk: "Talk",
  attack: "Attack",
  hurt: "Hurt",
  special: "Spezial",
  move: "Bewegung",
  rotate: "Rotation",
  openClose: "Öffnen / Schließen",
  pulse: "Pulsieren",
  glow: "Leuchten",
  break: "Zerbrechen",
  custom: "Eigene Animation",
  wind: "Wind",
  magic: "Magie",
  water: "Wasser",
  lava: "Lava",
} as const;

const materialSubtypeMap: Readonly<Partial<Record<AssetSubtype, MaterialBadgeId>>> = {
  wood: "wood",
  stone: "stone",
  snow: "snow",
  ice: "ice",
  metal: "metal",
  fabric: "cloth",
  leather: "leather",
};

const itemMaterialBadgeMap: Readonly<Partial<Record<ItemMaterial, MaterialBadgeId>>> = {
  wood: "wood",
  stone: "stone",
  metal: "metal",
  fabric: "cloth",
  leather: "leather",
};

const materialBadgeIconMap: Readonly<Record<string, MaterialBadgeId>> = {
  "material-wood": "wood",
  "material-stone": "stone",
  "material-snow": "snow",
  "material-ice": "ice",
  "material-metal": "metal",
  "material-cloth": "cloth",
  "material-fabric": "cloth",
  "material-leather": "leather",
};

export function compareUpdatedAtThenId(
  left: Readonly<{ updatedAt: string; id: StableId }>,
  right: Readonly<{ updatedAt: string; id: StableId }>,
): number {
  if (left.updatedAt !== right.updatedAt) {
    return left.updatedAt > right.updatedAt ? -1 : 1;
  }
  return left.id.localeCompare(right.id);
}

function animationFact(
  animation: keyof typeof animationLabels,
  framesPerDirection?: number,
): string {
  const label = animationLabels[animation];
  return framesPerDirection === undefined
    ? `Animation: ${label}`
    : `${label} · ${framesPerDirection} Frames`;
}

function validTilesetMetricInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): value is number {
  return value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function tilesetAtlasFact(profile: ResolvedProfile): string | null {
  if (profile.categoryData.category !== "tileset") return null;

  const answers = profile.categoryData.answers;
  if (
    !validTilesetMetricInteger(profile.values.tileSize, 1, 8192) ||
    !validTilesetMetricInteger(answers.atlasTileCount, 1, 256) ||
    (answers.atlasLayout === "fixedColumns" &&
      !validTilesetMetricInteger(answers.atlasColumns, 1, 64)) ||
    (answers.atlasLayout !== undefined &&
      answers.atlasLayout !== "fixedColumns" &&
      answers.atlasColumns !== undefined)
  ) {
    return null;
  }

  try {
    const specification = createTilesetTechnicalSpecification({
      tileSizePixels: profile.values.tileSize,
      tileCount: answers.atlasTileCount,
      ...(answers.atlasLayout === undefined ? {} : { layout: answers.atlasLayout }),
      ...(answers.atlasColumns === undefined ? {} : { fixedColumns: answers.atlasColumns }),
      ...(answers.atlasGutterPixels === undefined
        ? {}
        : { gutterPixels: answers.atlasGutterPixels }),
      ...(answers.atlasMarginPixels === undefined
        ? {}
        : { marginPixels: answers.atlasMarginPixels }),
    });
    const { metrics } = specification;
    return `Atlas: ${String(metrics.columns)} × ${String(metrics.rows)} · ${String(metrics.atlasWidthPixels)} × ${String(metrics.atlasHeightPixels)} px · ${String(metrics.tileCount)}/${String(metrics.capacity)} Slots`;
  } catch {
    return null;
  }
}

function profileActivityFacts(profile: ResolvedProfile): readonly string[] {
  switch (profile.categoryData.category) {
    case "character": {
      const { animationAction, animationActions, directionCount, framesPerDirection, role } =
        profile.categoryData.answers;
      const animationFacts =
        animationActions === undefined
          ? animationAction === undefined
            ? []
            : [animationFact(animationAction, framesPerDirection)]
          : animationActions.map((animation) => animationFact(animation.action, animation.frames));
      return [
        ...(role === undefined ? [] : [`Rolle: ${role}`]),
        ...(directionCount === undefined ? [] : [`${directionCount} Richtungen`]),
        ...animationFacts,
      ];
    }
    case "movingObject": {
      const {
        anchorMode,
        animationSequences,
        animationType,
        condition,
        directionCount,
        footprint,
        framesPerDirection,
        material,
        objectClass,
        movementType,
      } = profile.categoryData.answers;
      const animationFacts =
        animationSequences === undefined
          ? animationType === undefined
            ? []
            : [animationFact(animationType, framesPerDirection)]
          : animationSequences.map((sequence) => animationFact(sequence.type, sequence.frames));
      return [
        `Klasse: ${
          movingObjectClassLabels[
            objectClass ?? getDefaultMovingObjectClass(profile.categoryData.subtype)
          ]
        }`,
        ...(movementType === undefined ? [] : [`Bewegung: ${movementTypeLabels[movementType]}`]),
        ...(footprint === undefined
          ? []
          : [`Standfläche: ${footprint.widthTiles} × ${footprint.depthTiles} Tiles`]),
        ...(anchorMode === undefined ? [] : [movingObjectAnchorLabels[anchorMode]]),
        ...(!profile.capabilities.directional || directionCount === undefined
          ? []
          : [`${directionCount} Richtungen`]),
        ...animationFacts,
        ...(material === undefined ? [] : [`Material: ${movingObjectMaterialLabels[material]}`]),
        ...(condition === undefined ? [] : [`Zustand: ${movingObjectConditionLabels[condition]}`]),
      ];
    }
    case "staticObject": {
      const {
        animationType,
        basicShape,
        condition,
        footprint,
        interaction,
        objectClass,
        primaryMaterial,
        proportion,
        purpose,
        secondaryMaterial,
        shadowMode,
        symmetry,
        variantCount,
      } = profile.categoryData.answers;
      const resolvedClass =
        objectClass ?? getDefaultStaticObjectClass(profile.categoryData.subtype);
      return [
        `Klasse: ${staticObjectClassLabels[resolvedClass]}`,
        ...(purpose === undefined ? [] : [`Funktion: ${staticObjectPurposeLabels[purpose]}`]),
        ...(basicShape === undefined ? [] : [`Grundform: ${staticObjectShapeLabels[basicShape]}`]),
        ...(proportion === undefined
          ? []
          : [`Proportion: ${staticObjectProportionLabels[proportion]}`]),
        ...(symmetry === undefined ? [] : [`Symmetrie: ${staticObjectSymmetryLabels[symmetry]}`]),
        ...(primaryMaterial === undefined
          ? []
          : [`Hauptmaterial: ${staticObjectMaterialLabels[primaryMaterial]}`]),
        ...(secondaryMaterial === undefined
          ? []
          : [`Zweitmaterial: ${staticObjectMaterialLabels[secondaryMaterial]}`]),
        ...(condition === undefined ? [] : [`Zustand: ${staticObjectConditionLabels[condition]}`]),
        ...(footprint === undefined
          ? []
          : [`Standfläche: ${footprint.widthTiles} × ${footprint.depthTiles} Tiles`]),
        ...(interaction === undefined
          ? []
          : [`Interaktion: ${staticObjectInteractionLabels[interaction]}`]),
        ...(shadowMode === undefined ? [] : [`Schatten: ${staticObjectShadowLabels[shadowMode]}`]),
        ...(variantCount === undefined ? [] : [`Varianten: ${variantCount}`]),
        ...(!profile.capabilities.animated || animationType === undefined
          ? []
          : [animationFact(animationType)]),
      ];
    }
    case "tileset": {
      const {
        animationType,
        atlasLayout,
        cornerSet,
        edgeSet,
        repeatMode,
        seamMode,
        sourceMaterial,
        targetMaterial,
        tileableAxes,
        tilesetType,
        tileUsage,
        transitionMode,
        variantCount,
        variantKinds,
      } = profile.categoryData.answers;
      const atlasFact = tilesetAtlasFact(profile);
      return [
        `Tiletyp: ${
          tilesetTypeLabels[tilesetType ?? getDefaultTilesetType(profile.categoryData.subtype)]
        }`,
        ...(tileUsage === undefined ? [] : [`Mapping-Einsatz: ${tilesetUsageLabels[tileUsage]}`]),
        ...(edgeSet === undefined ? [] : [`Kanten: ${tilesetEdgeLabels[edgeSet]}`]),
        ...(cornerSet === undefined ? [] : [`Ecken: ${tilesetCornerLabels[cornerSet]}`]),
        ...(transitionMode === undefined
          ? []
          : [`Übergang: ${tilesetTransitionLabels[transitionMode]}`]),
        ...(sourceMaterial === undefined && targetMaterial === undefined
          ? []
          : [`Materialgrenze: ${sourceMaterial ?? "offen"} → ${targetMaterial ?? "offen"}`]),
        ...(seamMode === undefined ? [] : [`Seam-Regel: ${tilesetSeamLabels[seamMode]}`]),
        ...(tileableAxes === undefined
          ? []
          : [`Kachelbare Achsen: ${tilesetAxesLabels[tileableAxes]}`]),
        ...(repeatMode === undefined ? [] : [`Wiederholung: ${tilesetRepeatLabels[repeatMode]}`]),
        ...(variantCount === undefined ? [] : [`Varianten pro Zustand: ${String(variantCount)}`]),
        ...(variantKinds === undefined
          ? []
          : [
              `Variantenarten: ${variantKinds
                .map((variant) => tilesetVariantLabels[variant])
                .join(", ")}`,
            ]),
        ...(atlasLayout === undefined
          ? []
          : [`Atlaslayout: ${tilesetAtlasLayoutLabels[atlasLayout]}`]),
        ...(atlasFact === null ? [] : [atlasFact]),
        ...(!profile.capabilities.animated || animationType === undefined
          ? []
          : [animationFact(animationType)]),
      ];
    }
    case "nature": {
      const {
        age,
        animationType,
        climate,
        crownDensity,
        crownShape,
        footprint,
        grounding,
        mossCoverage,
        mushroomGrowth,
        plantType,
        rootVisibility,
        season,
        silhouette,
        snowCover,
        species,
        trunkShape,
        trunkThickness,
        variantCount,
        vineGrowth,
      } = profile.categoryData.answers;
      const resolvedPlantType =
        plantType ?? getDefaultNaturePlantType(profile.categoryData.subtype);
      return [
        `Pflanzentyp: ${naturePlantTypeLabels[resolvedPlantType]}`,
        ...(species === undefined ? [] : [`Art: ${species}`]),
        ...(climate === undefined ? [] : [`Klima: ${natureClimateLabels[climate]}`]),
        ...(season === undefined ? [] : [`Saison: ${natureSeasonLabels[season]}`]),
        ...(age === undefined ? [] : [`Alter: ${natureAgeLabels[age]}`]),
        ...(silhouette === undefined ? [] : [`Silhouette: ${natureSilhouetteLabels[silhouette]}`]),
        ...(trunkThickness === undefined
          ? []
          : [`Stammstärke: ${natureTrunkThicknessLabels[trunkThickness]}`]),
        ...(trunkShape === undefined ? [] : [`Stammform: ${natureTrunkShapeLabels[trunkShape]}`]),
        ...(crownShape === undefined ? [] : [`Kronenform: ${natureCrownShapeLabels[crownShape]}`]),
        ...(crownDensity === undefined
          ? []
          : [`Kronendichte: ${natureCrownDensityLabels[crownDensity]}`]),
        ...(rootVisibility === undefined
          ? []
          : [`Wurzeln: ${natureRootVisibilityLabels[rootVisibility]}`]),
        ...(mossCoverage === undefined ? [] : [`Moos: ${natureMossLabels[mossCoverage]}`]),
        ...(mushroomGrowth === undefined ? [] : [`Pilze: ${natureMushroomLabels[mushroomGrowth]}`]),
        ...(snowCover === undefined ? [] : [`Schnee: ${natureSnowLabels[snowCover]}`]),
        ...(vineGrowth === undefined ? [] : [`Ranken: ${natureVineLabels[vineGrowth]}`]),
        ...(footprint === undefined
          ? []
          : [`Standfläche: ${footprint.widthTiles} × ${footprint.depthTiles} Tiles`]),
        ...(grounding === undefined ? [] : [`Bodenanschluss: ${natureGroundingLabels[grounding]}`]),
        ...(variantCount === undefined ? [] : [`Varianten: ${variantCount}`]),
        ...(!profile.capabilities.animated || animationType === undefined
          ? []
          : [animationFact(animationType)]),
      ];
    }
    case "texture": {
      const {
        condition,
        icing,
        lighting,
        materialType,
        moisture,
        orientation,
        seamless,
        structure,
        surface,
        usage,
      } = profile.categoryData.answers;
      const resolvedMaterial =
        materialType ?? getDefaultTextureMaterialType(profile.categoryData.subtype);
      return [
        `Material: ${textureMaterialLabels[resolvedMaterial]}`,
        ...(usage === undefined ? [] : [`Einsatz: ${textureUsageLabels[usage]}`]),
        ...(seamless === undefined ? [] : [seamless ? "Nahtlos kachelbar" : "Nicht nahtlos"]),
        ...(structure === undefined ? [] : [`Struktur: ${textureStructureLabels[structure]}`]),
        ...(condition === undefined ? [] : [`Zustand: ${textureConditionLabels[condition]}`]),
        ...(surface === undefined ? [] : [`Oberfläche: ${textureSurfaceLabels[surface]}`]),
        ...(moisture === undefined ? [] : [`Feuchtigkeit: ${textureMoistureLabels[moisture]}`]),
        ...(icing === undefined ? [] : [`Vereisung: ${textureIcingLabels[icing]}`]),
        ...(orientation === undefined
          ? []
          : [`Ausrichtung: ${textureOrientationLabels[orientation]}`]),
        ...(lighting === undefined ? [] : [textureLightingLabels[lighting]]),
      ];
    }
    case "building": {
      const {
        animationType,
        buildingType,
        collisionMode,
        condition,
        doorCount,
        facadeStyle,
        floors,
        footprint,
        heightPixels,
        lighting,
        mappingMode,
        modular,
        occupancy,
        primaryMaterial,
        roofMaterial,
        roofShape,
        size,
        windowCount,
      } = profile.categoryData.answers;
      const resolvedType = buildingType ?? getDefaultBuildingType(profile.categoryData.subtype);
      return [
        `Gebäudetyp: ${buildingTypeLabels[resolvedType]}`,
        ...(size === undefined ? [] : [`Größe: ${buildingSizeLabels[size]}`]),
        ...(footprint === undefined
          ? []
          : [`Standfläche: ${footprint.widthTiles} × ${footprint.depthTiles} Tiles`]),
        ...(floors === undefined ? [] : [`Geschosse: ${floors}`]),
        ...(heightPixels === undefined ? [] : [`Gebäudehöhe: ${heightPixels} px`]),
        ...(primaryMaterial === undefined
          ? []
          : [`Hauptmaterial: ${buildingMaterialLabels[primaryMaterial]}`]),
        ...(roofShape === undefined ? [] : [`Dachform: ${buildingRoofShapeLabels[roofShape]}`]),
        ...(roofMaterial === undefined
          ? []
          : [`Dachmaterial: ${buildingRoofMaterialLabels[roofMaterial]}`]),
        ...(facadeStyle === undefined ? [] : [`Fassade: ${buildingFacadeLabels[facadeStyle]}`]),
        ...(doorCount === undefined ? [] : [`Türen: ${doorCount}`]),
        ...(windowCount === undefined ? [] : [`Fenster: ${windowCount}`]),
        ...(condition === undefined ? [] : [`Zustand: ${buildingConditionLabels[condition]}`]),
        ...(occupancy === undefined ? [] : [`Belegung: ${buildingOccupancyLabels[occupancy]}`]),
        ...(mappingMode === undefined ? [] : [`Mapping: ${buildingMappingLabels[mappingMode]}`]),
        ...(collisionMode === undefined
          ? []
          : [`Kollision: ${buildingCollisionLabels[collisionMode]}`]),
        ...(!profile.capabilities.modular || modular === undefined
          ? []
          : [modular ? "Modular" : "Einzelbauwerk"]),
        ...(lighting === undefined ? [] : [`Gebäudelicht: ${buildingLightingLabels[lighting]}`]),
        ...(!profile.capabilities.animated || animationType === undefined
          ? []
          : [animationFact(animationType)]),
      ];
    }
    case "item": {
      const {
        condition,
        functionDetails,
        iconSize,
        itemClass,
        primaryMaterial,
        presentation,
        purpose,
        readability,
        secondaryMaterial,
        shadowMode,
        significance,
        size,
        variantCount,
      } = profile.categoryData.answers;
      return [
        `Itemklasse: ${itemClassLabels[itemClass ?? getDefaultItemClass(profile.categoryData.subtype)]}`,
        ...(purpose === undefined ? [] : [`Zweck: ${itemPurposeLabels[purpose]}`]),
        ...(presentation === undefined
          ? []
          : [`Darstellung: ${itemPresentationLabels[presentation]}`]),
        ...(primaryMaterial === undefined
          ? []
          : [`Hauptmaterial: ${itemMaterialLabels[primaryMaterial]}`]),
        ...(secondaryMaterial === undefined
          ? []
          : [`Zweitmaterial: ${itemMaterialLabels[secondaryMaterial]}`]),
        ...(condition === undefined ? [] : [`Zustand: ${itemConditionLabels[condition]}`]),
        ...(size === undefined ? [] : [`Größe: ${itemSizeLabels[size]}`]),
        ...(readability === undefined ? [] : [`Lesbarkeit: ${itemReadabilityLabels[readability]}`]),
        ...(significance === undefined
          ? []
          : [`Bedeutung: ${itemSignificanceLabels[significance]}`]),
        ...(functionDetails === undefined ? [] : [`Funktion: ${functionDetails}`]),
        ...(shadowMode === undefined ? [] : [`Schatten: ${itemShadowLabels[shadowMode]}`]),
        ...(iconSize === undefined ? [] : [`Icongröße: ${String(iconSize)} px`]),
        ...(variantCount === undefined ? [] : [`Varianten: ${String(variantCount)}`]),
      ];
    }
    case "artwork": {
      const {
        composition,
        detailLevel,
        focus,
        format,
        lightingDrama,
        motif,
        purpose,
        sceneDescription,
      } = profile.categoryData.answers;
      return [
        `Artworktyp: ${artworkTypeLabels[getDefaultArtworkType(profile.categoryData.subtype)]}`,
        ...(purpose === undefined ? [] : [`Zweck: ${artworkPurposeLabels[purpose]}`]),
        ...(motif === undefined ? [] : [`Motiv: ${artworkMotifLabels[motif]}`]),
        ...(composition === undefined
          ? []
          : [`Komposition: ${artworkCompositionLabels[composition]}`]),
        ...(format === undefined ? [] : [`Format: ${artworkFormatLabels[format]}`]),
        ...(focus === undefined ? [] : [`Fokus: ${artworkFocusLabels[focus]}`]),
        ...(lightingDrama === undefined ? [] : [`Licht: ${artworkLightingLabels[lightingDrama]}`]),
        ...(detailLevel === undefined ? [] : [`Detailgrad: ${artworkDetailLabels[detailLevel]}`]),
        ...(sceneDescription === undefined ? [] : [`Szene: ${sceneDescription}`]),
      ];
    }
  }
}

function backgroundFact(profile: ResolvedProfile): string | null {
  if (!profile.capabilities.transparent) return null;
  if (profile.categoryData.category === "artwork") {
    switch (profile.categoryData.answers.background) {
      case "transparent":
        return "Transparent";
      case "simple":
        return "Einfacher Hintergrund";
      case "complete":
        return "Vollständiger Hintergrund";
      case undefined:
        break;
    }
  }
  return profile.values.backgroundMode === "transparent" ? "Transparent" : "Szenenhintergrund";
}

function profileFacts(profile: ResolvedProfile): readonly string[] {
  const facts: string[] = [pixelDensityLabels[profile.values.pixelDensity]];

  if (!profile.capabilities.freeComposition) {
    facts.push(`${profile.values.tileSize} px Tile`);
    facts.push(perspectiveLabels[profile.values.perspectiveType]);
  }
  if (profile.capabilities.scaledCharacter && profile.values.characterHeight !== undefined) {
    facts.push(`${profile.values.characterHeight} px Figur`);
  }
  const background = backgroundFact(profile);
  if (background) facts.push(background);
  facts.push(...profileActivityFacts(profile));
  facts.push(styleProfileLabels[profile.values.styleProfile]);

  return facts;
}

function profileMaterials(profile: AssetProfile): readonly MaterialBadgeId[] {
  const selected = new Set<MaterialBadgeId>();
  const subtypeMaterial = materialSubtypeMap[profile.subtype];
  if (subtypeMaterial) selected.add(subtypeMaterial);
  if (profile.category === "texture") {
    const material =
      materialSubtypeMap[
        profile.answers.materialType ??
          getDefaultTextureMaterialType(profile.subtype as TextureSubtype)
      ];
    if (material) selected.add(material);
  }
  if (profile.category === "item") {
    for (const itemMaterial of [
      profile.answers.primaryMaterial,
      profile.answers.secondaryMaterial,
    ]) {
      if (itemMaterial === undefined) continue;
      const material = itemMaterialBadgeMap[itemMaterial];
      if (material) selected.add(material);
    }
  }

  for (const iconId of profile.badgeIconIds) {
    const material = materialBadgeIconMap[iconId];
    if (material) selected.add(material);
  }

  return MATERIAL_BADGE_IDS.filter((material) => selected.has(material));
}

export function resolveProfileSummary(
  profile: AssetProfile,
  library: ProfileLibrary,
): DashboardProfileSummary | null {
  const baseProfile = library.baseProfiles.find(
    (candidate) => candidate.id === profile.baseProfileId,
  );
  if (!baseProfile) return null;

  const categoryProfile = profile.categoryProfileId
    ? library.categoryProfiles.find((candidate) => candidate.id === profile.categoryProfileId)
    : undefined;
  const result = resolveProfile({
    baseProfile,
    assetProfile: profile,
    ...(categoryProfile ? { categoryProfile } : {}),
  });
  if (result.status !== "resolved") return null;

  return {
    id: profile.id,
    name: profile.name,
    category: profile.category,
    subtype: profile.subtype,
    categoryLabel: getDashboardCategory(profile.category).label,
    subtypeLabel: formatSubtypeLabel(profile.subtype),
    baseProfileName: baseProfile.name,
    baseProfileId: baseProfile.id,
    compatibilityKey: result.profile.compatibilityKey,
    facts: profileFacts(result.profile),
    tags: profile.tags.slice(0, 4),
    materials: profileMaterials(profile),
    favorite: profile.favorite,
    updatedAt: profile.updatedAt,
  };
}

function baseProfileFacts(profile: BaseProfile): readonly string[] {
  return [
    pixelDensityLabels[profile.values.pixelDensity],
    `${profile.values.tileSize} px`,
    ...(profile.values.characterHeight === undefined
      ? []
      : [`${profile.values.characterHeight} px Figur`]),
    perspectiveLabels[profile.values.perspectiveType],
  ];
}

function selectBaseProfiles(
  profiles: readonly BaseProfile[],
  activeBaseProfileId: StableId | null,
): readonly DashboardBaseProfileSummary[] {
  return profiles
    .map((profile) => ({
      id: profile.id,
      name: profile.name,
      facts: baseProfileFacts(profile),
      active: profile.id === activeBaseProfileId,
      updatedAt: profile.updatedAt,
    }))
    .sort((left, right) => {
      if (left.active !== right.active) return left.active ? -1 : 1;
      return compareUpdatedAtThenId(left, right);
    })
    .slice(0, BASE_PROFILE_LIMIT);
}

function collectionStatus(result: StorageReadResult<ProfileLibrary>): DashboardCollectionStatus {
  if (result.status !== "valid") return result.status;
  return result.value.assetProfiles.length === 0 ? "empty" : "ready";
}

function draftData(result: StorageReadResult<WizardDraft>): Readonly<{
  status: DashboardDraftStatus;
  draft: WizardDraft | null;
}> {
  return result.status === "valid"
    ? { status: "ready", draft: result.value }
    : { status: result.status, draft: null };
}

export function createDashboardData(
  profileResult: StorageReadResult<ProfileLibrary>,
  draftResult: StorageReadResult<WizardDraft>,
  activeBaseProfileId: StableId | null,
): DashboardData {
  const resolvedProfiles =
    profileResult.status === "valid"
      ? profileResult.value.assetProfiles
          .map((profile) => resolveProfileSummary(profile, profileResult.value))
          .filter((profile): profile is DashboardProfileSummary => profile !== null)
          .sort(compareUpdatedAtThenId)
      : [];
  const selectedDraft = draftData(draftResult);

  return {
    collectionStatus: collectionStatus(profileResult),
    recentProfiles: resolvedProfiles.slice(0, RECENT_PROFILE_LIMIT),
    favoriteProfiles: resolvedProfiles
      .filter((profile) => profile.favorite)
      .slice(0, FAVORITE_PROFILE_LIMIT),
    baseProfiles:
      profileResult.status === "valid"
        ? selectBaseProfiles(profileResult.value.baseProfiles, activeBaseProfileId)
        : [],
    skippedProfileCount:
      profileResult.status === "valid"
        ? profileResult.value.assetProfiles.length - resolvedProfiles.length
        : 0,
    draftStatus: selectedDraft.status,
    draft: selectedDraft.draft,
  };
}

export function readDashboardData(
  storage: DashboardStorage,
  activeBaseProfileId: StableId | null,
): DashboardData {
  return createDashboardData(
    storage.readProfileLibrary(),
    storage.readDraft(),
    activeBaseProfileId,
  );
}

export function formatDashboardDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
