import type { AssetCapabilities, AssetCategory, AssetSubtype } from "../../domain/assets";
import {
  getDefaultArtworkType,
  type ArtworkBackground,
  type ArtworkComposition,
  type ArtworkDetailLevel,
  type ArtworkFocus,
  type ArtworkFormat,
  type ArtworkLightingDrama,
  type ArtworkMotif,
  type ArtworkPurpose,
  type ArtworkSubtype,
  type ArtworkType,
} from "../../domain/artworks";
import {
  CHARACTER_ANIMATION_ACTION_IDS,
  type CharacterAnimationActionId,
} from "../../domain/characters";
import {
  getDefaultBuildingType,
  type BuildingCollisionMode,
  type BuildingCondition,
  type BuildingDoorState,
  type BuildingDoorType,
  type BuildingFacadeStyle,
  type BuildingLighting,
  type BuildingMappingMode,
  type BuildingMaterial,
  type BuildingOccupancy,
  type BuildingRoofMaterial,
  type BuildingRoofShape,
  type BuildingSize,
  type BuildingSubtype,
  type BuildingType,
  type BuildingWindowLighting,
  type BuildingWindowShape,
} from "../../domain/buildings";
import {
  getDefaultItemClass,
  type ItemClass,
  type ItemCondition,
  type ItemGlowMode,
  type ItemMaterial,
  type ItemPresentation,
  type ItemPurpose,
  type ItemReadability,
  type ItemShadowMode,
  type ItemSignificance,
  type ItemSize,
  type ItemSubtype,
  type ItemWearPosition,
} from "../../domain/items";
import {
  MOVING_OBJECT_ANIMATION_TYPE_IDS,
  getDefaultMovingObjectClass,
  type MovingObjectAnchorMode,
  type MovingObjectAnimationType,
  type MovingObjectClass,
  type MovingObjectCondition,
  type MovingObjectMaterial,
  type MovingObjectMovementType,
  type MovingObjectSubtype,
} from "../../domain/moving-objects";
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
  natureSubtypeHasCrown,
  natureSubtypeHasRoots,
  natureSubtypeHasTrunk,
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
  type NatureSubtype,
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
  type StaticObjectSubtype,
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
  type TilesetSubtype,
  type TilesetTechnicalSpecification,
  type TilesetTileableAxes,
  type TilesetTransitionMode,
  type TilesetType,
  type TilesetUsage,
  type TilesetVariantKind,
} from "../../domain/tilesets";
import type { ResolvedProfile } from "../../domain/profiles";
import type { BaseProfile, ProfileLibrary, WizardDraft } from "../../schemas";
import { formatSubtypeLabel, getDashboardCategory } from "../dashboard/dashboardCatalog";
import { resolveWizardDraftSnapshot } from "./wizardLifecycle";
import type { WizardCoreFormValues } from "./wizardSteps";
import styles from "./WizardView.module.css";

const PIXEL_DENSITY_LABELS = {
  classicHd: "Classic-HD",
  modernHd: "Modern-HD",
  ultraHd: "Ultra-HD",
} as const;

const STYLE_PROFILE_LABELS = {
  classic: "Stil A · klassische Fantasy",
  dark: "Stil B · düstere Fantasy",
  both: "Stil A + B",
} as const;

const PERSPECTIVE_LABELS = {
  topdown: "Top-down",
  threeQuarter: "3/4-RPG",
  isometric: "Isometrisch",
  side: "Seitenansicht",
} as const;

const PROJECTION_LABELS = {
  orthographic: "Orthografisch",
  mildPerspective: "Leichte Perspektive",
} as const;

const OUTLINE_LABELS = {
  dark: "Dunkel",
  softSelective: "Selektiv",
  minimal: "Minimal",
} as const;

const BACKGROUND_LABELS = {
  transparent: "Transparent",
  scene: "Vollständige Szene",
} as const;

const LIGHTING_LABELS = {
  adaptive: "Kontextabhängig",
  neutralDay: "Neutrales Tageslicht",
  warmInterior: "Warmes Innenlicht",
  gloomyDiffuse: "Diffus und gedämpft",
  neutralNight: "Neutrales Nachtlicht",
  coolNight: "Kühles Nachtlicht",
  custom: "Individuell",
} as const;

const CHARACTER_ANIMATION_LABELS: Readonly<Record<CharacterAnimationActionId, string>> = {
  idle: "Idle",
  walk: "Walk",
  run: "Run",
  attack: "Attack",
  use: "Use",
  talk: "Talk",
  interact: "Interact",
  hurt: "Hurt",
  special: "Spezialaktion",
};

const MOVING_OBJECT_CLASS_LABELS: Readonly<Record<MovingObjectClass, string>> = {
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

const MOVING_OBJECT_MOVEMENT_LABELS: Readonly<Record<MovingObjectMovementType, string>> = {
  roll: "Rollen",
  slide: "Gleiten",
  hover: "Schweben",
  walk: "Laufen",
  crawl: "Kriechen",
  fly: "Fliegen",
  rotate: "Rotieren",
};

const MOVING_OBJECT_ANCHOR_LABELS: Readonly<Record<MovingObjectAnchorMode, string>> = {
  automatic: "Automatisch",
  bottomCenter: "Unten mittig",
  footprintCenter: "Mitte der Standfläche",
  canvasCenter: "Canvas-Mitte",
};

const MOVING_OBJECT_MATERIAL_LABELS: Readonly<Record<MovingObjectMaterial, string>> = {
  wood: "Holz",
  metal: "Metall",
  fabric: "Stoff",
  stone: "Stein",
  magic: "Magische Substanz",
  mixed: "Mischmaterial",
};

const MOVING_OBJECT_CONDITION_LABELS: Readonly<Record<MovingObjectCondition, string>> = {
  new: "Neu",
  used: "Gebraucht",
  damaged: "Beschädigt",
  improvised: "Provisorisch",
};

const MOVING_OBJECT_ANIMATION_LABELS: Readonly<Record<MovingObjectAnimationType, string>> = {
  idle: "Idle",
  move: "Bewegung",
  rotate: "Rotation",
  interact: "Interaktion",
  openClose: "Öffnen / Schließen",
  pulse: "Pulsieren",
};

const TEXTURE_MATERIAL_LABELS: Readonly<Record<TextureMaterialType, string>> = {
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

const TEXTURE_USAGE_LABELS: Readonly<Record<TextureUsage, string>> = {
  floor: "Boden",
  wall: "Wand",
  roof: "Dach",
  surface: "Objektoberfläche",
  clothing: "Kleidung",
  decor: "Dekor",
};

const TEXTURE_STRUCTURE_LABELS: Readonly<Record<TextureStructure, string>> = {
  fine: "Fein",
  medium: "Mittel",
  coarse: "Grob",
};

const TEXTURE_CONDITION_LABELS: Readonly<Record<TextureCondition, string>> = {
  new: "Neu",
  polished: "Poliert",
  rough: "Rau",
  old: "Alt",
  wet: "Nass",
  frosted: "Frostig",
  damaged: "Beschädigt",
  dirty: "Verschmutzt",
};

const TEXTURE_SURFACE_LABELS: Readonly<Record<TextureSurface, string>> = {
  continuous: "Durchgehend",
  planked: "Planken",
  jointed: "Mit Fugen",
  cracked: "Rissig",
  granular: "Körnig",
  layered: "Geschichtet",
  woven: "Gewebt",
  organic: "Organisch",
};

const TEXTURE_MOISTURE_LABELS: Readonly<Record<TextureMoisture, string>> = {
  dry: "Trocken",
  damp: "Feucht",
  wet: "Nass",
};

const TEXTURE_ICING_LABELS: Readonly<Record<TextureIcing, string>> = {
  none: "Keine Vereisung",
  lightFrost: "Leichter Frost",
  frosted: "Bereift",
  iceCrusted: "Eiskruste",
};

const TEXTURE_LIGHTING_LABELS: Readonly<Record<TextureLighting, string>> = {
  neutralEven: "Neutral und gleichmäßig",
  contextual: "Kontextabhängig",
  worldAligned: "An Weltlicht ausgerichtet",
};

const TEXTURE_ORIENTATION_LABELS: Readonly<Record<TextureOrientation, string>> = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  radial: "Radial",
  unordered: "Ungeordnet",
  grainAligned: "Entlang der Maserung",
};

const NATURE_PLANT_TYPE_LABELS: Readonly<Record<NaturePlantType, string>> = {
  tree: "Baum",
  bush: "Busch",
  grass: "Grasbüschel",
  mushroom: "Pilz",
  root: "Wurzel",
  treeStump: "Baumstumpf",
  vine: "Ranke",
};

const NATURE_CLIMATE_LABELS: Readonly<Record<NatureClimate, string>> = {
  temperate: "Gemäßigt",
  mountain: "Gebirge",
  snow: "Schneegebiet",
  swamp: "Sumpf",
  dry: "Trocken",
  dark: "Düsterwald",
  magical: "Magischer Wald",
};

const NATURE_SEASON_LABELS: Readonly<Record<NatureSeason, string>> = {
  spring: "Frühling",
  summer: "Sommer",
  autumn: "Herbst",
  winter: "Winter",
  timeless: "Zeitlos",
};

const NATURE_AGE_LABELS: Readonly<Record<NatureAge, string>> = {
  young: "Jung",
  mature: "Ausgewachsen",
  ancient: "Uralt",
  dead: "Abgestorben",
};

const NATURE_SILHOUETTE_LABELS: Readonly<Record<NatureSilhouette, string>> = {
  broad: "Breit",
  narrow: "Schmal",
  asymmetric: "Asymmetrisch",
  gnarled: "Knorrig",
  upright: "Aufrecht",
  spreading: "Ausladend",
  compact: "Kompakt",
};

const NATURE_TRUNK_THICKNESS_LABELS: Readonly<Record<NatureTrunkThickness, string>> = {
  thin: "Dünn",
  medium: "Mittel",
  thick: "Dick",
  massive: "Massiv",
};

const NATURE_TRUNK_SHAPE_LABELS: Readonly<Record<NatureTrunkShape, string>> = {
  straight: "Gerade",
  tapered: "Konisch",
  twisted: "Verdreht",
  gnarled: "Knorrig",
  split: "Gespalten",
  hollow: "Hohl",
};

const NATURE_CROWN_SHAPE_LABELS: Readonly<Record<NatureCrownShape, string>> = {
  round: "Rund",
  tall: "Hoch",
  tiered: "Gestuft",
  spreading: "Ausladend",
  conical: "Kegelförmig",
  irregular: "Unregelmäßig",
  damaged: "Beschädigt",
  bare: "Kahl",
};

const NATURE_CROWN_DENSITY_LABELS: Readonly<Record<NatureCrownDensity, string>> = {
  sparse: "Spärlich",
  loose: "Locker",
  medium: "Mittel",
  dense: "Dicht",
  bare: "Kahl",
};

const NATURE_ROOT_VISIBILITY_LABELS: Readonly<Record<NatureRootVisibility, string>> = {
  hidden: "Verdeckt",
  visible: "Sichtbar",
  spreading: "Ausladend",
  rockWrapping: "Felsen umschlingend",
  exposed: "Freigelegt",
};

const NATURE_MOSS_LABELS: Readonly<Record<NatureMossCoverage, string>> = {
  none: "Kein Moos",
  light: "Leicht",
  moderate: "Mittel",
  heavy: "Stark",
};

const NATURE_MUSHROOM_LABELS: Readonly<Record<NatureMushroomGrowth, string>> = {
  none: "Keine Pilze",
  few: "Vereinzelt",
  clustered: "In Gruppen",
  abundant: "Reichlich",
};

const NATURE_SNOW_LABELS: Readonly<Record<NatureSnowCover, string>> = {
  none: "Kein Schnee",
  dusting: "Leicht bestäubt",
  partial: "Teilweise bedeckt",
  covered: "Bedeckt",
  heavy: "Stark bedeckt",
};

const NATURE_VINE_LABELS: Readonly<Record<NatureVineGrowth, string>> = {
  none: "Keine Ranken",
  light: "Leicht",
  draped: "Herabhängend",
  entangled: "Dicht verschlungen",
};

const NATURE_GROUNDING_LABELS: Readonly<Record<NatureGrounding, string>> = {
  natural: "Natürlich eingebettet",
  soilPatch: "Erdfläche",
  grassPatch: "Grasfläche",
  rocky: "Felsig",
  snowy: "Verschneit",
  swampy: "Sumpfig",
  freestanding: "Freigestellt",
};

const STATIC_OBJECT_CLASS_LABELS: Readonly<Record<StaticObjectClass, string>> = {
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

const STATIC_OBJECT_PURPOSE_LABELS: Readonly<Record<StaticObjectPurpose, string>> = {
  decorative: "Dekorativ",
  interactive: "Interaktiv",
  walkable: "Begehbar",
  blocking: "Blockierend",
};

const STATIC_OBJECT_BASIC_SHAPE_LABELS: Readonly<Record<StaticObjectBasicShape, string>> = {
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

const STATIC_OBJECT_PROPORTION_LABELS: Readonly<Record<StaticObjectProportion, string>> = {
  compact: "Kompakt",
  balanced: "Ausgewogen",
  tall: "Hoch",
  wide: "Breit",
  low: "Niedrig",
  slender: "Schlank",
  massive: "Massiv",
};

const STATIC_OBJECT_SYMMETRY_LABELS: Readonly<Record<StaticObjectSymmetry, string>> = {
  bilateral: "Bilateral",
  radial: "Radial",
  asymmetric: "Asymmetrisch",
  none: "Keine",
};

const STATIC_OBJECT_MATERIAL_LABELS: Readonly<Record<StaticObjectMaterial, string>> = {
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

const STATIC_OBJECT_CONDITION_LABELS: Readonly<Record<StaticObjectCondition, string>> = {
  clean: "Sauber",
  used: "Gebraucht",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  overgrown: "Überwachsen",
};

const STATIC_OBJECT_INTERACTION_LABELS: Readonly<Record<StaticObjectInteraction, string>> = {
  none: "Keine",
  open: "Öffnen",
  tilt: "Kippen",
  glow: "Leuchten",
  break: "Zerbrechen",
};

const STATIC_OBJECT_SHADOW_LABELS: Readonly<Record<StaticObjectShadowMode, string>> = {
  none: "Kein Schatten",
  contact: "Kontaktschatten",
};

const BUILDING_TYPE_LABELS: Readonly<Record<BuildingType, string>> = {
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

const BUILDING_SIZE_LABELS: Readonly<Record<BuildingSize, string>> = {
  compact: "Kompakt",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  monumental: "Monumental",
};

const BUILDING_MATERIAL_LABELS: Readonly<Record<BuildingMaterial, string>> = {
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

const BUILDING_ROOF_SHAPE_LABELS: Readonly<Record<BuildingRoofShape, string>> = {
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

const BUILDING_ROOF_MATERIAL_LABELS: Readonly<Record<BuildingRoofMaterial, string>> = {
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

const BUILDING_FACADE_LABELS: Readonly<Record<BuildingFacadeStyle, string>> = {
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

const BUILDING_DOOR_TYPE_LABELS: Readonly<Record<BuildingDoorType, string>> = {
  single: "Einflügelige Tür",
  double: "Doppeltür",
  arched: "Bogentür",
  reinforced: "Verstärktes Tor",
  portcullis: "Fallgatter",
  openPassage: "Offener Durchgang",
  custom: "Individuell",
};

const BUILDING_DOOR_STATE_LABELS: Readonly<Record<BuildingDoorState, string>> = {
  open: "Offen",
  closed: "Geschlossen",
  ajar: "Angelehnt",
  blocked: "Blockiert",
  broken: "Beschädigt",
};

const BUILDING_WINDOW_SHAPE_LABELS: Readonly<Record<BuildingWindowShape, string>> = {
  square: "Quadratisch",
  rectangular: "Rechteckig",
  arched: "Bogenfenster",
  round: "Rund",
  narrowSlit: "Schmale Schießscharte",
  irregular: "Unregelmäßig",
  none: "Keine Fenster",
};

const BUILDING_WINDOW_LIGHTING_LABELS: Readonly<Record<BuildingWindowLighting, string>> = {
  dark: "Dunkel",
  neutral: "Neutral",
  warmLit: "Warm beleuchtet",
  coolLit: "Kühl beleuchtet",
  mixed: "Gemischte Lichtzustände",
  boarded: "Vernagelt / verdeckt",
};

const BUILDING_CONDITION_LABELS: Readonly<Record<BuildingCondition, string>> = {
  maintained: "Gepflegt",
  used: "Genutzt",
  weathered: "Verwittert",
  damaged: "Beschädigt",
  abandoned: "Verlassen",
  overgrown: "Überwuchert",
};

const BUILDING_OCCUPANCY_LABELS: Readonly<Record<BuildingOccupancy, string>> = {
  inhabited: "Bewohnt",
  active: "Aktiv genutzt",
  vacant: "Leerstehend",
  abandoned: "Verlassen",
};

const BUILDING_MAPPING_LABELS: Readonly<Record<BuildingMappingMode, string>> = {
  freestanding: "Freistehend",
  mapIntegrated: "In Karte integriert",
  tileAligned: "Am Tile-Raster ausgerichtet",
  modularSet: "Modularer Bauteilsatz",
};

const BUILDING_COLLISION_LABELS: Readonly<Record<BuildingCollisionMode, string>> = {
  fullyBlocking: "Vollständig blockierend",
  walkableEntrance: "Begehbarer Eingang",
  walkableInterior: "Begehbarer Innenraum",
  mixed: "Gemischte Kollisionszonen",
};

const BUILDING_LIGHTING_LABELS: Readonly<Record<BuildingLighting, string>> = {
  worldAligned: "Nur geerbtes Weltlicht",
  warmInterior: "Warmes Innenlicht",
  darkInterior: "Dunkler Innenraum",
  neutralInterior: "Neutrales Innenlicht",
  visibleSources: "Sichtbare lokale Lichtquellen",
  emissive: "Kontrolliert emissiv",
  custom: "Individuell",
};

const TILESET_TYPE_LABELS: Readonly<Record<TilesetType, string>> = {
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

const TILESET_USAGE_LABELS: Readonly<Record<TilesetUsage, string>> = {
  floor: "Bodenfläche",
  wall: "Wandfläche",
  roof: "Dachfläche",
  transition: "Übergang / Anschluss",
  decor: "Dekoration",
};

const TILESET_EDGE_LABELS: Readonly<Record<TilesetEdgeSet, string>> = {
  none: "Keine eigenen Kanten",
  cardinal: "Vier Kardinalkanten",
  cardinalAndDiagonal: "Kardinal- und Diagonalkanten",
  custom: "Individuelles Kantenset",
};

const TILESET_CORNER_LABELS: Readonly<Record<TilesetCornerSet, string>> = {
  none: "Keine Eckvarianten",
  outer: "Außenecken",
  inner: "Innenecken",
  innerAndOuter: "Innen- und Außenecken",
  custom: "Individuelles Eckset",
};

const TILESET_TRANSITION_LABELS: Readonly<Record<TilesetTransitionMode, string>> = {
  none: "Kein Materialübergang",
  oneWay: "Einseitig",
  bidirectional: "Beidseitig",
  multiMaterial: "Mehrere Materialien",
  custom: "Individuell",
};

const TILESET_SEAM_LABELS: Readonly<Record<TilesetSeamMode, string>> = {
  seamless: "Vollständig nahtlos",
  matchedEdges: "Passende Randpixel",
  intentionalBoundary: "Sichtbare Grenze",
  overlap: "Überlappender Rand",
  custom: "Individuell",
};

const TILESET_AXES_LABELS: Readonly<Record<TilesetTileableAxes, string>> = {
  horizontal: "Horizontal",
  vertical: "Vertikal",
  both: "Horizontal und vertikal",
  none: "Keine Achsenwiederholung",
};

const TILESET_REPEAT_LABELS: Readonly<Record<TilesetRepeatMode, string>> = {
  strict: "Strikt regelmäßig",
  staggered: "Versetzt",
  randomized: "Kontrolliert variiert",
  nonRepeating: "Nicht wiederholend",
};

const TILESET_VARIANT_LABELS: Readonly<Record<TilesetVariantKind, string>> = {
  clean: "sauber",
  damaged: "beschädigt",
  decorated: "dekoriert",
  decal: "Dekal",
  seasonal: "saisonal",
  randomized: "zufällig variiert",
};

const TILESET_ATLAS_LAYOUT_LABELS: Readonly<Record<TilesetAtlasLayout, string>> = {
  automatic: "Automatisch kompakt",
  singleRow: "Eine Zeile",
  singleColumn: "Eine Spalte",
  fixedColumns: "Feste Spaltenzahl",
};

const ITEM_CLASS_LABELS: Readonly<Record<ItemClass, string>> = {
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
const ITEM_PURPOSE_LABELS: Readonly<Record<ItemPurpose, string>> = {
  practical: "Praktisch",
  decorative: "Dekorativ",
  wearable: "Tragbar",
  usable: "Benutzbar",
};
const ITEM_PRESENTATION_LABELS: Readonly<Record<ItemPresentation, string>> = {
  icon: "Inventar-Icon",
  worldAsset: "Weltobjekt",
  equipped: "Ausgerüstet",
};
const ITEM_WEAR_POSITION_LABELS: Readonly<Record<ItemWearPosition, string>> = {
  head: "Kopf",
  neck: "Hals",
  hand: "Hand",
  body: "Körper",
  back: "Rücken",
  belt: "Gürtel",
};
const ITEM_MATERIAL_LABELS: Readonly<Record<ItemMaterial, string>> = {
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
const ITEM_CONDITION_LABELS: Readonly<Record<ItemCondition, string>> = {
  new: "Neu / makellos",
  used: "Gebraucht",
  worn: "Abgenutzt",
  damaged: "Beschädigt",
  ancient: "Alt / historisch",
  magicallyAltered: "Magisch verändert",
};
const ITEM_SIGNIFICANCE_LABELS: Readonly<Record<ItemSignificance, string>> = {
  common: "Alltäglich",
  valuable: "Wertvoll",
  rare: "Selten",
  ceremonial: "Zeremoniell",
  magical: "Magisch",
  questCritical: "Handlungsentscheidend",
};
const ITEM_SIZE_LABELS: Readonly<Record<ItemSize, string>> = {
  tiny: "Winzig",
  small: "Klein",
  medium: "Mittel",
  large: "Groß",
  oversized: "Überdimensioniert",
};
const ITEM_READABILITY_LABELS: Readonly<Record<ItemReadability, string>> = {
  silhouetteFirst: "Silhouette zuerst",
  balanced: "Ausgewogen",
  detailRich: "Detailreich",
};
const ITEM_GLOW_LABELS: Readonly<Record<ItemGlowMode, string>> = {
  none: "Kein Leuchten",
  subtle: "Subtil",
  emissive: "Emissiv",
};
const ITEM_SHADOW_LABELS: Readonly<Record<ItemShadowMode, string>> = {
  none: "Kein eigener Schatten",
  contact: "Kontaktschatten",
};

const ARTWORK_TYPE_LABELS: Readonly<Record<ArtworkType, string>> = {
  characterConcept: "Charakterkonzept",
  environmentConcept: "Umgebungskonzept",
  buildingConcept: "Gebäudeentwurf",
  materialStudy: "Materialstudie",
  scene: "Szene",
  promoArtwork: "Promo-Artwork",
  moodPainting: "Stimmungsbild",
};
const ARTWORK_PURPOSE_LABELS: Readonly<Record<ArtworkPurpose, string>> = {
  concept: "Konzept",
  presentation: "Präsentation",
  productionReference: "Produktionsreferenz",
};
const ARTWORK_MOTIF_LABELS: Readonly<Record<ArtworkMotif, string>> = {
  figure: "Figur",
  object: "Objekt",
  environment: "Umgebung",
  scene: "Szene",
};
const ARTWORK_COMPOSITION_LABELS: Readonly<Record<ArtworkComposition, string>> = {
  singleSubject: "Einzelmotiv",
  group: "Gruppe",
  scene: "Gestaffelte Szene",
};
const ARTWORK_FORMAT_LABELS: Readonly<Record<ArtworkFormat, string>> = {
  square: "Quadratisch",
  portrait: "Hochformat",
  landscape: "Querformat",
  free: "Freies Format",
};
const ARTWORK_BACKGROUND_LABELS: Readonly<Record<ArtworkBackground, string>> = {
  transparent: "Transparent",
  simple: "Einfach",
  complete: "Vollständig ausgearbeitet",
};
const ARTWORK_FOCUS_LABELS: Readonly<Record<ArtworkFocus, string>> = {
  form: "Form",
  material: "Material",
  mood: "Stimmung",
  story: "Geschichte",
  scale: "Maßstab",
};
const ARTWORK_LIGHTING_LABELS: Readonly<Record<ArtworkLightingDrama, string>> = {
  neutral: "Neutral",
  warm: "Warm",
  gloomy: "Düster",
  night: "Nacht",
  custom: "Benutzerdefiniert",
};
const ARTWORK_DETAIL_LABELS: Readonly<Record<ArtworkDetailLevel, string>> = {
  overview: "Übersicht",
  productionConcept: "Produktionskonzept",
  showcase: "Showcase",
};

function natureAnimationSummary(animationType: WizardCoreFormValues["animationType"]): string {
  switch (animationType) {
    case "wind":
      return "Windbewegung";
    case "magic":
      return "Magischer Loop";
    case "custom":
      return "Individuell";
    default:
      return "Noch nicht ausgewählt";
  }
}

function staticObjectAnimationSummary(
  animationType: WizardCoreFormValues["animationType"],
): string {
  switch (animationType) {
    case "openClose":
      return "Öffnen / Schließen";
    case "glow":
      return "Leuchten";
    case "break":
      return "Zerbrechen";
    case "custom":
      return "Individuell";
    default:
      return "Noch nicht ausgewählt";
  }
}

function buildingAnimationSummary(animationType: WizardCoreFormValues["animationType"]): string {
  switch (animationType) {
    case "openClose":
      return "Öffnen / Schließen";
    case "custom":
      return "Individuell";
    default:
      return "Noch nicht ausgewählt";
  }
}

function tilesetAnimationSummary(animationType: WizardCoreFormValues["animationType"]): string {
  switch (animationType) {
    case "water":
      return "Wasser";
    case "lava":
      return "Lava";
    case "magic":
      return "Magie";
    case "custom":
      return "Individuell";
    default:
      return "Noch nicht ausgewählt";
  }
}

function validTilesetMetricInteger(
  value: number | undefined,
  minimum: number,
  maximum: number,
): value is number {
  return value !== undefined && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function tilesetTechnicalSpecification(
  values: WizardCoreFormValues,
): TilesetTechnicalSpecification | null {
  if (
    !validTilesetMetricInteger(values.tileSize, 1, 8192) ||
    !validTilesetMetricInteger(values.tilesetAtlasTileCount, 1, 256) ||
    (values.tilesetAtlasLayout === "fixedColumns" &&
      !validTilesetMetricInteger(values.tilesetAtlasColumns, 1, 64)) ||
    (values.tilesetAtlasLayout !== undefined &&
      values.tilesetAtlasLayout !== "fixedColumns" &&
      values.tilesetAtlasColumns !== undefined) ||
    (values.tilesetAtlasGutterPixels !== undefined &&
      !validTilesetMetricInteger(values.tilesetAtlasGutterPixels, 0, 64)) ||
    (values.tilesetAtlasMarginPixels !== undefined &&
      !validTilesetMetricInteger(values.tilesetAtlasMarginPixels, 0, 64))
  ) {
    return null;
  }

  try {
    return createTilesetTechnicalSpecification({
      tileSizePixels: values.tileSize,
      tileCount: values.tilesetAtlasTileCount,
      ...(values.tilesetAtlasLayout === undefined ? {} : { layout: values.tilesetAtlasLayout }),
      ...(values.tilesetAtlasColumns === undefined
        ? {}
        : { fixedColumns: values.tilesetAtlasColumns }),
      ...(values.tilesetAtlasGutterPixels === undefined
        ? {}
        : { gutterPixels: values.tilesetAtlasGutterPixels }),
      ...(values.tilesetAtlasMarginPixels === undefined
        ? {}
        : { marginPixels: values.tilesetAtlasMarginPixels }),
    });
  } catch {
    return null;
  }
}

function characterAnimationSummary(
  frames: WizardCoreFormValues["characterAnimationFrames"],
): string {
  if (frames === undefined) return "Noch nicht ausgewählt";

  const selected = CHARACTER_ANIMATION_ACTION_IDS.flatMap((action) => {
    const frameCount = frames[action];
    if (frameCount === undefined) return [];
    return [
      `${CHARACTER_ANIMATION_LABELS[action]} · ${frameCount} ${
        frameCount === 1 ? "Frame" : "Frames"
      }`,
    ];
  });

  return selected.length === 0 ? "Noch nicht ausgewählt" : selected.join("; ");
}

function movingObjectAnimationSummary(
  frames: WizardCoreFormValues["movingObjectAnimationFrames"],
): string {
  if (frames === undefined) return "Noch nicht ausgewählt";

  const selected = MOVING_OBJECT_ANIMATION_TYPE_IDS.flatMap((type) => {
    const frameCount = frames[type];
    return frameCount === undefined
      ? []
      : [
          `${MOVING_OBJECT_ANIMATION_LABELS[type]} · ${frameCount} ${
            frameCount === 1 ? "Frame" : "Frames"
          }`,
        ];
  });
  return selected.length === 0 ? "Noch nicht ausgewählt" : selected.join("; ");
}

interface SummaryProfile {
  readonly base: BaseProfile | null;
  readonly resolved: ResolvedProfile | null;
  readonly sourceName: string | null;
}

function sourceAssetProfileId(draft: WizardDraft): string | null {
  if (!("sourceAssetProfileId" in draft)) return null;
  return typeof draft.sourceAssetProfileId === "string" ? draft.sourceAssetProfileId : null;
}

function findSummaryProfile(draft: WizardDraft, library: ProfileLibrary | null): SummaryProfile {
  if (!library || !("baseProfileId" in draft)) {
    return { base: null, resolved: null, sourceName: null };
  }

  const base = library.baseProfiles.find((profile) => profile.id === draft.baseProfileId);
  if (!base) return { base: null, resolved: null, sourceName: null };

  const sourceId = sourceAssetProfileId(draft);
  const sourceAsset = sourceId
    ? library.assetProfiles.find((profile) => profile.id === sourceId)
    : undefined;
  const resolution = resolveWizardDraftSnapshot(draft, library);

  return {
    base,
    resolved: resolution?.status === "resolved" ? resolution.profile : null,
    sourceName: sourceAsset?.name ?? null,
  };
}

function summaryCategory(
  draft: WizardDraft,
  categoryHint: AssetCategory | null,
  activeCategory: AssetCategory | null,
): AssetCategory | null {
  return activeCategory ?? ("category" in draft ? draft.category : categoryHint);
}

export interface WizardSelectionSummary {
  readonly category: AssetCategory;
  readonly subtype: AssetSubtype;
  readonly capabilities: AssetCapabilities;
}

function SummaryFact({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export interface WizardTechnicalSummaryProps {
  readonly categoryHint: AssetCategory | null;
  readonly draft: WizardDraft;
  readonly library: ProfileLibrary | null;
  readonly projectName: string;
  readonly activeCategory: AssetCategory | null;
  readonly activeSubtype: AssetSubtype | null;
  readonly selection: WizardSelectionSummary | null;
  readonly formValues: WizardCoreFormValues;
}

export function WizardTechnicalSummary({
  categoryHint,
  draft,
  library,
  projectName,
  activeCategory,
  activeSubtype,
  selection,
  formValues,
}: WizardTechnicalSummaryProps) {
  const category = summaryCategory(draft, categoryHint, activeCategory);
  const draftMatchesActiveSelection =
    !("category" in draft) ||
    (draft.category === activeCategory && draft.subtype === activeSubtype);
  const profile = draftMatchesActiveSelection
    ? findSummaryProfile(draft, library)
    : { base: null, resolved: null, sourceName: null };
  const technicalValues =
    "category" in draft ? (profile.resolved?.values ?? null) : (profile.base?.values ?? null);
  const isFreeComposition = profile.resolved?.capabilities.freeComposition === true;
  const usesCharacterScale = profile.resolved?.capabilities.scaledCharacter === true;
  const natureSubtype =
    selection?.category === "nature" ? (selection.subtype as NatureSubtype) : null;
  const natureHasTrunk = natureSubtype !== null && natureSubtypeHasTrunk(natureSubtype);
  const natureHasCrown = natureSubtype !== null && natureSubtypeHasCrown(natureSubtype);
  const natureHasRoots = natureSubtype !== null && natureSubtypeHasRoots(natureSubtype);
  const activeTilesetSpecification =
    selection?.category === "tileset" ? tilesetTechnicalSpecification(formValues) : null;

  return (
    <aside className={styles.technicalSummary} aria-labelledby="wizard-technical-summary-title">
      <p className={styles.eyebrow}>Live-Überblick</p>
      <h2 id="wizard-technical-summary-title">Technische Zusammenfassung</h2>
      <dl className={styles.summaryList}>
        <SummaryFact label="Projekt" value={projectName.trim() || "Noch nicht benannt"} />
        {category ? (
          <SummaryFact label="Asset-Kategorie" value={getDashboardCategory(category).label} />
        ) : null}
        {selection ? (
          <>
            <SummaryFact label="Untertyp" value={formatSubtypeLabel(selection.subtype)} />
            <SummaryFact
              label="Asset-Logik"
              value={
                [
                  selection.capabilities.movable ? "beweglich" : null,
                  selection.capabilities.directional ? "richtungsfähig" : null,
                  selection.capabilities.animated ? "Animation" : null,
                  selection.capabilities.tileable ? "kachelbar" : null,
                  selection.capabilities.scaledCharacter ? "Figurenmaßstab" : null,
                  selection.capabilities.freeComposition ? "freie Komposition" : null,
                ]
                  .filter((value): value is string => value !== null)
                  .join(" · ") || "statisches Einzelasset"
              }
            />
          </>
        ) : null}
        {profile.sourceName ? <SummaryFact label="Assetprofil" value={profile.sourceName} /> : null}
        {profile.base ? <SummaryFact label="Basisprofil" value={profile.base.name} /> : null}
        {selection?.category === "character" ? (
          <>
            {formValues.role?.trim() ? (
              <SummaryFact label="Rolle / Beruf" value={formValues.role.trim()} />
            ) : null}
            {selection.capabilities.directional ? (
              <SummaryFact
                label="Richtungsset"
                value={
                  formValues.directionCount === undefined
                    ? "Noch nicht ausgewählt"
                    : `${formValues.directionCount} Richtungen`
                }
              />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animationen"
                value={characterAnimationSummary(formValues.characterAnimationFrames)}
              />
            ) : null}
            {formValues.silhouette?.trim() ? (
              <SummaryFact label="Silhouette" value={formValues.silhouette.trim()} />
            ) : null}
          </>
        ) : null}
        {selection?.category === "movingObject" ? (
          <>
            <SummaryFact
              label="Objektklasse"
              value={
                MOVING_OBJECT_CLASS_LABELS[
                  formValues.movingObjectClass ??
                    getDefaultMovingObjectClass(selection.subtype as MovingObjectSubtype)
                ]
              }
            />
            {formValues.movementType !== undefined ? (
              <SummaryFact
                label="Bewegungsart"
                value={MOVING_OBJECT_MOVEMENT_LABELS[formValues.movementType]}
              />
            ) : null}
            {formValues.movingObjectFootprintWidthTiles !== undefined &&
            formValues.movingObjectFootprintDepthTiles !== undefined ? (
              <SummaryFact
                label="Standfläche"
                value={`${formValues.movingObjectFootprintWidthTiles} × ${formValues.movingObjectFootprintDepthTiles} Tiles`}
              />
            ) : null}
            {formValues.movingObjectAnchorMode !== undefined ? (
              <SummaryFact
                label="Ausrichtungsanker"
                value={MOVING_OBJECT_ANCHOR_LABELS[formValues.movingObjectAnchorMode]}
              />
            ) : null}
            {selection.capabilities.directional ? (
              <SummaryFact
                label="Richtungsset"
                value={
                  formValues.directionCount === undefined
                    ? "Noch nicht ausgewählt"
                    : `${formValues.directionCount} Richtungen`
                }
              />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animationen"
                value={movingObjectAnimationSummary(formValues.movingObjectAnimationFrames)}
              />
            ) : null}
            {formValues.movingObjectMaterial !== undefined ? (
              <SummaryFact
                label="Material"
                value={MOVING_OBJECT_MATERIAL_LABELS[formValues.movingObjectMaterial]}
              />
            ) : null}
            {formValues.movingObjectCondition !== undefined ? (
              <SummaryFact
                label="Zustand"
                value={MOVING_OBJECT_CONDITION_LABELS[formValues.movingObjectCondition]}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "staticObject" ? (
          <>
            <SummaryFact
              label="Objektklasse"
              value={
                STATIC_OBJECT_CLASS_LABELS[
                  formValues.staticObjectClass ??
                    getDefaultStaticObjectClass(selection.subtype as StaticObjectSubtype)
                ]
              }
            />
            {formValues.staticObjectPurpose !== undefined ? (
              <SummaryFact
                label="Funktion"
                value={STATIC_OBJECT_PURPOSE_LABELS[formValues.staticObjectPurpose]}
              />
            ) : null}
            {formValues.staticObjectBasicShape !== undefined ? (
              <SummaryFact
                label="Grundform"
                value={STATIC_OBJECT_BASIC_SHAPE_LABELS[formValues.staticObjectBasicShape]}
              />
            ) : null}
            {formValues.staticObjectProportion !== undefined ? (
              <SummaryFact
                label="Proportion"
                value={STATIC_OBJECT_PROPORTION_LABELS[formValues.staticObjectProportion]}
              />
            ) : null}
            {formValues.staticObjectSymmetry !== undefined ? (
              <SummaryFact
                label="Symmetrie"
                value={STATIC_OBJECT_SYMMETRY_LABELS[formValues.staticObjectSymmetry]}
              />
            ) : null}
            {formValues.staticObjectPrimaryMaterial !== undefined ? (
              <SummaryFact
                label="Hauptmaterial"
                value={STATIC_OBJECT_MATERIAL_LABELS[formValues.staticObjectPrimaryMaterial]}
              />
            ) : null}
            {formValues.staticObjectSecondaryMaterial !== undefined ? (
              <SummaryFact
                label="Zweitmaterial"
                value={STATIC_OBJECT_MATERIAL_LABELS[formValues.staticObjectSecondaryMaterial]}
              />
            ) : null}
            {formValues.staticObjectCondition !== undefined ? (
              <SummaryFact
                label="Zustand"
                value={STATIC_OBJECT_CONDITION_LABELS[formValues.staticObjectCondition]}
              />
            ) : null}
            {formValues.staticObjectFootprintWidthTiles !== undefined &&
            formValues.staticObjectFootprintDepthTiles !== undefined ? (
              <SummaryFact
                label="Standfläche"
                value={`${formValues.staticObjectFootprintWidthTiles} × ${formValues.staticObjectFootprintDepthTiles} Tiles`}
              />
            ) : null}
            {formValues.staticObjectInteraction !== undefined ? (
              <SummaryFact
                label="Interaktion"
                value={STATIC_OBJECT_INTERACTION_LABELS[formValues.staticObjectInteraction]}
              />
            ) : null}
            {formValues.staticObjectShadowMode !== undefined ? (
              <SummaryFact
                label="Schatten"
                value={STATIC_OBJECT_SHADOW_LABELS[formValues.staticObjectShadowMode]}
              />
            ) : null}
            {formValues.staticObjectVariantCount !== undefined ? (
              <SummaryFact label="Varianten" value={String(formValues.staticObjectVariantCount)} />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animation"
                value={staticObjectAnimationSummary(formValues.animationType)}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "building" ? (
          <>
            <SummaryFact
              label="Gebäudetyp"
              value={
                BUILDING_TYPE_LABELS[
                  formValues.buildingType ??
                    getDefaultBuildingType(selection.subtype as BuildingSubtype)
                ]
              }
            />
            {formValues.buildingPurpose?.trim() ? (
              <SummaryFact label="Nutzung" value={formValues.buildingPurpose.trim()} />
            ) : null}
            {formValues.buildingSize !== undefined ? (
              <SummaryFact label="Größe" value={BUILDING_SIZE_LABELS[formValues.buildingSize]} />
            ) : null}
            {formValues.buildingFootprintWidthTiles !== undefined &&
            formValues.buildingFootprintDepthTiles !== undefined ? (
              <SummaryFact
                label="Standfläche"
                value={`${formValues.buildingFootprintWidthTiles} × ${formValues.buildingFootprintDepthTiles} Tiles`}
              />
            ) : null}
            {formValues.buildingFloors !== undefined ? (
              <SummaryFact label="Geschosse" value={String(formValues.buildingFloors)} />
            ) : null}
            {formValues.buildingHeightPixels !== undefined ? (
              <SummaryFact label="Gebäudehöhe" value={`${formValues.buildingHeightPixels} px`} />
            ) : null}
            {formValues.buildingPrimaryMaterial !== undefined ? (
              <SummaryFact
                label="Hauptmaterial"
                value={BUILDING_MATERIAL_LABELS[formValues.buildingPrimaryMaterial]}
              />
            ) : null}
            {formValues.buildingSecondaryMaterial !== undefined ? (
              <SummaryFact
                label="Zweitmaterial"
                value={BUILDING_MATERIAL_LABELS[formValues.buildingSecondaryMaterial]}
              />
            ) : null}
            {formValues.buildingRoofShape !== undefined ? (
              <SummaryFact
                label="Dachform"
                value={BUILDING_ROOF_SHAPE_LABELS[formValues.buildingRoofShape]}
              />
            ) : null}
            {formValues.buildingRoofMaterial !== undefined ? (
              <SummaryFact
                label="Dachmaterial"
                value={BUILDING_ROOF_MATERIAL_LABELS[formValues.buildingRoofMaterial]}
              />
            ) : null}
            {formValues.buildingFacadeStyle !== undefined ? (
              <SummaryFact
                label="Fassade"
                value={BUILDING_FACADE_LABELS[formValues.buildingFacadeStyle]}
              />
            ) : null}
            {formValues.buildingDoorCount !== undefined ? (
              <SummaryFact
                label="Türen"
                value={[
                  String(formValues.buildingDoorCount),
                  formValues.buildingDoorType === undefined
                    ? null
                    : BUILDING_DOOR_TYPE_LABELS[formValues.buildingDoorType],
                  formValues.buildingDoorState === undefined
                    ? null
                    : BUILDING_DOOR_STATE_LABELS[formValues.buildingDoorState],
                ]
                  .filter((value): value is string => value !== null)
                  .join(" · ")}
              />
            ) : null}
            {formValues.buildingWindowCount !== undefined ? (
              <SummaryFact
                label="Fenster"
                value={[
                  String(formValues.buildingWindowCount),
                  formValues.buildingWindowShape === undefined
                    ? null
                    : BUILDING_WINDOW_SHAPE_LABELS[formValues.buildingWindowShape],
                  formValues.buildingWindowLighting === undefined
                    ? null
                    : BUILDING_WINDOW_LIGHTING_LABELS[formValues.buildingWindowLighting],
                ]
                  .filter((value): value is string => value !== null)
                  .join(" · ")}
              />
            ) : null}
            {formValues.buildingCondition !== undefined ? (
              <SummaryFact
                label="Zustand"
                value={BUILDING_CONDITION_LABELS[formValues.buildingCondition]}
              />
            ) : null}
            {formValues.buildingOccupancy !== undefined ? (
              <SummaryFact
                label="Belegung"
                value={BUILDING_OCCUPANCY_LABELS[formValues.buildingOccupancy]}
              />
            ) : null}
            {formValues.buildingMappingMode !== undefined ? (
              <SummaryFact
                label="Mapping"
                value={BUILDING_MAPPING_LABELS[formValues.buildingMappingMode]}
              />
            ) : null}
            {formValues.buildingCollisionMode !== undefined ? (
              <SummaryFact
                label="Kollision"
                value={BUILDING_COLLISION_LABELS[formValues.buildingCollisionMode]}
              />
            ) : null}
            {selection.capabilities.modular ? (
              <SummaryFact
                label="Modularität"
                value={
                  formValues.buildingModular === undefined
                    ? "Noch nicht ausgewählt"
                    : formValues.buildingModular
                      ? "Modular"
                      : "Einzelbauwerk"
                }
              />
            ) : null}
            {formValues.buildingLighting !== undefined ? (
              <SummaryFact
                label="Gebäudelicht"
                value={BUILDING_LIGHTING_LABELS[formValues.buildingLighting]}
              />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animation"
                value={buildingAnimationSummary(formValues.animationType)}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "tileset" ? (
          <>
            <SummaryFact
              label="Tiletyp"
              value={
                TILESET_TYPE_LABELS[
                  formValues.tilesetType ??
                    getDefaultTilesetType(selection.subtype as TilesetSubtype)
                ]
              }
            />
            {formValues.tilesetUsage !== undefined ? (
              <SummaryFact
                label="Mapping-Einsatz"
                value={TILESET_USAGE_LABELS[formValues.tilesetUsage]}
              />
            ) : null}
            {formValues.tilesetEdgeSet !== undefined ? (
              <SummaryFact label="Kanten" value={TILESET_EDGE_LABELS[formValues.tilesetEdgeSet]} />
            ) : null}
            {formValues.tilesetCornerSet !== undefined ? (
              <SummaryFact
                label="Ecken"
                value={TILESET_CORNER_LABELS[formValues.tilesetCornerSet]}
              />
            ) : null}
            {formValues.tilesetTransitionMode !== undefined ? (
              <SummaryFact
                label="Übergang"
                value={TILESET_TRANSITION_LABELS[formValues.tilesetTransitionMode]}
              />
            ) : null}
            {formValues.tilesetSourceMaterial?.trim() ||
            formValues.tilesetTargetMaterial?.trim() ? (
              <SummaryFact
                label="Materialgrenze"
                value={`${formValues.tilesetSourceMaterial?.trim() || "offen"} → ${formValues.tilesetTargetMaterial?.trim() || "offen"}`}
              />
            ) : null}
            {formValues.tilesetSeamMode !== undefined ? (
              <SummaryFact
                label="Seam-Regel"
                value={TILESET_SEAM_LABELS[formValues.tilesetSeamMode]}
              />
            ) : null}
            {formValues.tileableAxes !== undefined ? (
              <SummaryFact
                label="Kachelbare Achsen"
                value={TILESET_AXES_LABELS[formValues.tileableAxes]}
              />
            ) : null}
            {formValues.tilesetRepeatMode !== undefined ? (
              <SummaryFact
                label="Wiederholung"
                value={TILESET_REPEAT_LABELS[formValues.tilesetRepeatMode]}
              />
            ) : null}
            {formValues.tilesetVariantCount !== undefined ? (
              <SummaryFact
                label="Varianten pro Zustand"
                value={String(formValues.tilesetVariantCount)}
              />
            ) : null}
            {formValues.tilesetVariantKinds !== undefined ? (
              <SummaryFact
                label="Variantenarten"
                value={formValues.tilesetVariantKinds
                  .map((variant) => TILESET_VARIANT_LABELS[variant])
                  .join(", ")}
              />
            ) : null}
            {activeTilesetSpecification !== null ? (
              <>
                <SummaryFact
                  label="Atlaslayout"
                  value={TILESET_ATLAS_LAYOUT_LABELS[activeTilesetSpecification.metrics.layout]}
                />
                <SummaryFact
                  label="Atlas-Spezifikation"
                  value={`${String(activeTilesetSpecification.metrics.columns)} × ${String(activeTilesetSpecification.metrics.rows)} Zellen · ${String(activeTilesetSpecification.metrics.atlasWidthPixels)} × ${String(activeTilesetSpecification.metrics.atlasHeightPixels)} px · ${String(activeTilesetSpecification.metrics.tileCount)}/${String(activeTilesetSpecification.metrics.capacity)} Slots`}
                />
              </>
            ) : formValues.tilesetAtlasLayout !== undefined ? (
              <SummaryFact
                label="Atlaslayout"
                value={TILESET_ATLAS_LAYOUT_LABELS[formValues.tilesetAtlasLayout]}
              />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animation"
                value={tilesetAnimationSummary(formValues.animationType)}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "item" ? (
          <>
            <SummaryFact
              label="Itemklasse"
              value={
                ITEM_CLASS_LABELS[
                  formValues.itemClass ?? getDefaultItemClass(selection.subtype as ItemSubtype)
                ]
              }
            />
            {formValues.itemPurpose !== undefined ? (
              <SummaryFact label="Zweck" value={ITEM_PURPOSE_LABELS[formValues.itemPurpose]} />
            ) : null}
            {formValues.itemPresentation !== undefined ? (
              <SummaryFact
                label="Darstellung"
                value={ITEM_PRESENTATION_LABELS[formValues.itemPresentation]}
              />
            ) : null}
            {formValues.itemWearPosition !== undefined ? (
              <SummaryFact
                label="Trageposition"
                value={ITEM_WEAR_POSITION_LABELS[formValues.itemWearPosition]}
              />
            ) : null}
            {formValues.itemPrimaryMaterial !== undefined ? (
              <SummaryFact
                label="Material"
                value={[
                  ITEM_MATERIAL_LABELS[formValues.itemPrimaryMaterial],
                  formValues.itemSecondaryMaterial === undefined
                    ? null
                    : ITEM_MATERIAL_LABELS[formValues.itemSecondaryMaterial],
                ]
                  .filter((value): value is string => value !== null)
                  .join(" + ")}
              />
            ) : null}
            {formValues.itemCondition !== undefined ? (
              <SummaryFact
                label="Zustand"
                value={ITEM_CONDITION_LABELS[formValues.itemCondition]}
              />
            ) : null}
            {formValues.itemSize !== undefined ? (
              <SummaryFact label="Relative Größe" value={ITEM_SIZE_LABELS[formValues.itemSize]} />
            ) : null}
            {formValues.itemReadability !== undefined ? (
              <SummaryFact
                label="Lesbarkeit"
                value={ITEM_READABILITY_LABELS[formValues.itemReadability]}
              />
            ) : null}
            {formValues.itemSignificance !== undefined ? (
              <SummaryFact
                label="Bedeutung"
                value={ITEM_SIGNIFICANCE_LABELS[formValues.itemSignificance]}
              />
            ) : null}
            {formValues.itemFunctionDetails?.trim() ? (
              <SummaryFact label="Funktion" value={formValues.itemFunctionDetails.trim()} />
            ) : null}
            {formValues.itemMeaningDetails?.trim() ? (
              <SummaryFact label="Symbolik" value={formValues.itemMeaningDetails.trim()} />
            ) : null}
            {formValues.itemGlowMode !== undefined ? (
              <SummaryFact label="Leuchteffekt" value={ITEM_GLOW_LABELS[formValues.itemGlowMode]} />
            ) : null}
            {formValues.itemShadowMode !== undefined ? (
              <SummaryFact label="Schatten" value={ITEM_SHADOW_LABELS[formValues.itemShadowMode]} />
            ) : null}
            {formValues.itemIconSize !== undefined ? (
              <SummaryFact label="Icongröße" value={`${String(formValues.itemIconSize)} px`} />
            ) : null}
            {formValues.itemVariantCount !== undefined ? (
              <SummaryFact label="Varianten" value={String(formValues.itemVariantCount)} />
            ) : null}
          </>
        ) : null}
        {selection?.category === "artwork" ? (
          <>
            <SummaryFact
              label="Artworktyp"
              value={
                ARTWORK_TYPE_LABELS[getDefaultArtworkType(selection.subtype as ArtworkSubtype)]
              }
            />
            {formValues.artworkPurpose !== undefined ? (
              <SummaryFact
                label="Zweck"
                value={ARTWORK_PURPOSE_LABELS[formValues.artworkPurpose]}
              />
            ) : null}
            {formValues.artworkMotif !== undefined ? (
              <SummaryFact label="Motiv" value={ARTWORK_MOTIF_LABELS[formValues.artworkMotif]} />
            ) : null}
            {formValues.artworkSceneDescription?.trim() ? (
              <SummaryFact label="Szene" value={formValues.artworkSceneDescription.trim()} />
            ) : null}
            {formValues.artworkComposition !== undefined ? (
              <SummaryFact
                label="Komposition"
                value={ARTWORK_COMPOSITION_LABELS[formValues.artworkComposition]}
              />
            ) : null}
            {formValues.artworkFormat !== undefined ? (
              <SummaryFact label="Format" value={ARTWORK_FORMAT_LABELS[formValues.artworkFormat]} />
            ) : null}
            {formValues.artworkBackground !== undefined ? (
              <SummaryFact
                label="Artwork-Hintergrund"
                value={ARTWORK_BACKGROUND_LABELS[formValues.artworkBackground]}
              />
            ) : null}
            {formValues.artworkFocus !== undefined ? (
              <SummaryFact label="Fokus" value={ARTWORK_FOCUS_LABELS[formValues.artworkFocus]} />
            ) : null}
            {formValues.artworkLightingDrama !== undefined ? (
              <SummaryFact
                label="Lichtdramaturgie"
                value={ARTWORK_LIGHTING_LABELS[formValues.artworkLightingDrama]}
              />
            ) : null}
            {formValues.artworkDetailLevel !== undefined ? (
              <SummaryFact
                label="Detailgrad"
                value={ARTWORK_DETAIL_LABELS[formValues.artworkDetailLevel]}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "texture" ? (
          <>
            <SummaryFact
              label="Material"
              value={
                TEXTURE_MATERIAL_LABELS[
                  formValues.textureMaterialType ??
                    getDefaultTextureMaterialType(selection.subtype as TextureSubtype)
                ]
              }
            />
            {formValues.textureUsage !== undefined ? (
              <SummaryFact label="Einsatz" value={TEXTURE_USAGE_LABELS[formValues.textureUsage]} />
            ) : null}
            {formValues.seamless !== undefined ? (
              <SummaryFact
                label="Kachelbarkeit"
                value={formValues.seamless ? "Nahtlos" : "Nicht nahtlos"}
              />
            ) : null}
            {formValues.textureStructure !== undefined ? (
              <SummaryFact
                label="Strukturgrad"
                value={TEXTURE_STRUCTURE_LABELS[formValues.textureStructure]}
              />
            ) : null}
            {formValues.textureSurface !== undefined ? (
              <SummaryFact
                label="Oberfläche"
                value={TEXTURE_SURFACE_LABELS[formValues.textureSurface]}
              />
            ) : null}
            {formValues.textureCondition !== undefined ? (
              <SummaryFact
                label="Zustand"
                value={TEXTURE_CONDITION_LABELS[formValues.textureCondition]}
              />
            ) : null}
            {formValues.textureMoisture !== undefined ? (
              <SummaryFact
                label="Feuchtigkeit"
                value={TEXTURE_MOISTURE_LABELS[formValues.textureMoisture]}
              />
            ) : null}
            {formValues.textureIcing !== undefined ? (
              <SummaryFact
                label="Vereisung"
                value={TEXTURE_ICING_LABELS[formValues.textureIcing]}
              />
            ) : null}
            {formValues.textureOrientation !== undefined ? (
              <SummaryFact
                label="Ausrichtung"
                value={TEXTURE_ORIENTATION_LABELS[formValues.textureOrientation]}
              />
            ) : null}
            {formValues.textureLighting !== undefined ? (
              <SummaryFact
                label="Materiallicht"
                value={TEXTURE_LIGHTING_LABELS[formValues.textureLighting]}
              />
            ) : null}
          </>
        ) : null}
        {selection?.category === "nature" ? (
          <>
            <SummaryFact
              label="Pflanzentyp"
              value={
                NATURE_PLANT_TYPE_LABELS[
                  getDefaultNaturePlantType(selection.subtype as NatureSubtype)
                ]
              }
            />
            {formValues.natureSpecies?.trim() ? (
              <SummaryFact label="Art" value={formValues.natureSpecies.trim()} />
            ) : null}
            {formValues.natureClimate !== undefined ? (
              <SummaryFact label="Klima" value={NATURE_CLIMATE_LABELS[formValues.natureClimate]} />
            ) : null}
            {formValues.natureSeason !== undefined ? (
              <SummaryFact label="Saison" value={NATURE_SEASON_LABELS[formValues.natureSeason]} />
            ) : null}
            {formValues.natureAge !== undefined ? (
              <SummaryFact label="Alter" value={NATURE_AGE_LABELS[formValues.natureAge]} />
            ) : null}
            {formValues.natureSilhouette !== undefined ? (
              <SummaryFact
                label="Silhouette"
                value={NATURE_SILHOUETTE_LABELS[formValues.natureSilhouette]}
              />
            ) : null}
            {natureHasTrunk && formValues.natureTrunkThickness !== undefined ? (
              <SummaryFact
                label="Stammstärke"
                value={NATURE_TRUNK_THICKNESS_LABELS[formValues.natureTrunkThickness]}
              />
            ) : null}
            {natureHasTrunk && formValues.natureTrunkShape !== undefined ? (
              <SummaryFact
                label="Stammform"
                value={NATURE_TRUNK_SHAPE_LABELS[formValues.natureTrunkShape]}
              />
            ) : null}
            {natureHasCrown && formValues.natureCrownShape !== undefined ? (
              <SummaryFact
                label="Kronenform"
                value={NATURE_CROWN_SHAPE_LABELS[formValues.natureCrownShape]}
              />
            ) : null}
            {natureHasCrown && formValues.natureCrownDensity !== undefined ? (
              <SummaryFact
                label="Kronendichte"
                value={NATURE_CROWN_DENSITY_LABELS[formValues.natureCrownDensity]}
              />
            ) : null}
            {natureHasRoots && formValues.natureRootVisibility !== undefined ? (
              <SummaryFact
                label="Wurzeln"
                value={NATURE_ROOT_VISIBILITY_LABELS[formValues.natureRootVisibility]}
              />
            ) : null}
            {formValues.natureMossCoverage !== undefined ? (
              <SummaryFact
                label="Moosbewuchs"
                value={NATURE_MOSS_LABELS[formValues.natureMossCoverage]}
              />
            ) : null}
            {formValues.natureMushroomGrowth !== undefined ? (
              <SummaryFact
                label="Pilzbewuchs"
                value={NATURE_MUSHROOM_LABELS[formValues.natureMushroomGrowth]}
              />
            ) : null}
            {formValues.natureSnowCover !== undefined ? (
              <SummaryFact
                label="Schneedecke"
                value={NATURE_SNOW_LABELS[formValues.natureSnowCover]}
              />
            ) : null}
            {formValues.natureVineGrowth !== undefined ? (
              <SummaryFact
                label="Rankenbewuchs"
                value={NATURE_VINE_LABELS[formValues.natureVineGrowth]}
              />
            ) : null}
            {formValues.natureFootprintWidthTiles !== undefined &&
            formValues.natureFootprintDepthTiles !== undefined ? (
              <SummaryFact
                label="Standfläche"
                value={`${formValues.natureFootprintWidthTiles} × ${formValues.natureFootprintDepthTiles} Tiles`}
              />
            ) : null}
            {formValues.natureGrounding !== undefined ? (
              <SummaryFact
                label="Bodenanschluss"
                value={NATURE_GROUNDING_LABELS[formValues.natureGrounding]}
              />
            ) : null}
            {formValues.natureVariantCount !== undefined ? (
              <SummaryFact label="Varianten" value={String(formValues.natureVariantCount)} />
            ) : null}
            {selection.capabilities.animated ? (
              <SummaryFact
                label="Animation"
                value={natureAnimationSummary(formValues.animationType)}
              />
            ) : null}
          </>
        ) : null}
        {technicalValues ? (
          <>
            <SummaryFact
              label="Pixelstil"
              value={PIXEL_DENSITY_LABELS[technicalValues.pixelDensity]}
            />
            <SummaryFact
              label="Stilprofil"
              value={STYLE_PROFILE_LABELS[technicalValues.styleProfile]}
            />
            {!isFreeComposition ? (
              <>
                <SummaryFact
                  label="Tile-Raster"
                  value={`${technicalValues.tileSize} × ${technicalValues.tileSize} px`}
                />
                <SummaryFact
                  label="Perspektive"
                  value={PERSPECTIVE_LABELS[technicalValues.perspectiveType]}
                />
                <SummaryFact
                  label="Projektion"
                  value={PROJECTION_LABELS[technicalValues.projectionType]}
                />
                <SummaryFact label="Kameraneigung" value={`${technicalValues.cameraAngle}°`} />
              </>
            ) : null}
            {usesCharacterScale && technicalValues.characterHeight !== undefined ? (
              <SummaryFact label="Figurenhöhe" value={`${technicalValues.characterHeight} px`} />
            ) : null}
            <SummaryFact label="Outline" value={OUTLINE_LABELS[technicalValues.outlineStyle]} />
            <SummaryFact
              label="Hintergrund"
              value={BACKGROUND_LABELS[technicalValues.backgroundMode]}
            />
            <SummaryFact
              label="Lichtlogik"
              value={LIGHTING_LABELS[technicalValues.lightingDefaults.policy]}
            />
          </>
        ) : null}
      </dl>
      {!technicalValues ? (
        <p className={styles.summaryHint}>
          Technische Werte erscheinen, sobald ein Basisprofil Teil des Entwurfs ist.
        </p>
      ) : null}
    </aside>
  );
}
