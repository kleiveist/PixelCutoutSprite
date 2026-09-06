import type { PromptLanguage, PromptModuleId, PromptModuleResult } from "./promptEngine.types";

interface LocalizedLabel {
  readonly en: string;
  readonly de: string;
}

const VALUE_LABELS: Readonly<Record<string, LocalizedLabel>> = Object.freeze({
  classicHd: { en: "Classic-HD", de: "Classic-HD" },
  modernHd: { en: "Modern-HD", de: "Modern-HD" },
  ultraHd: { en: "Ultra-HD", de: "Ultra-HD" },
  classic: { en: "classic", de: "klassisch" },
  dark: { en: "dark", de: "dunkel" },
  topdown: { en: "near-vertical top-down", de: "fast senkrechte Draufsicht" },
  threeQuarter: { en: "frontal oblique 3/4 top-down", de: "frontale schräge 3/4-Draufsicht" },
  isometric: { en: "isometric", de: "isometrisch" },
  side: { en: "side view", de: "Seitenansicht" },
  orthographic: { en: "orthographic", de: "orthografisch" },
  mildPerspective: { en: "mild perspective", de: "leichte Perspektive" },
  southToNorth: { en: "south to north", de: "Süd nach Nord" },
  swToNe: { en: "southwest to northeast", de: "Südwest nach Nordost" },
  seToNw: { en: "southeast to northwest", de: "Südost nach Nordwest" },
  darkOutline: { en: "dark outline", de: "dunkle Kontur" },
  softSelective: { en: "soft selective", de: "weich und selektiv" },
  minimal: { en: "minimal", de: "minimal" },
  natural: { en: "natural and lightly muted", de: "natürlich und leicht gedämpft" },
  vivid: { en: "vivid with controlled saturation", de: "kräftig mit kontrollierter Sättigung" },
  desaturated: { en: "dark and desaturated", de: "dunkel und entsättigt" },
  byProfile: { en: "defined by the style profile", de: "durch das Stilprofil bestimmt" },
  transparent: { en: "transparent", de: "transparent" },
  scene: { en: "scene", de: "Szene" },
  adaptive: { en: "context-adaptive", de: "kontextabhängig" },
  neutralDay: { en: "neutral daylight", de: "neutrales Tageslicht" },
  warmInterior: { en: "warm interior light", de: "warmes Innenlicht" },
  gloomyDiffuse: { en: "gloomy diffuse light", de: "düsteres diffuses Licht" },
  neutralNight: { en: "neutral low-intensity night light", de: "neutrales schwaches Nachtlicht" },
  coolNight: { en: "slightly cool night light", de: "leicht kühles Nachtlicht" },
  custom: { en: "custom", de: "benutzerdefiniert" },
  none: { en: "none", de: "keine" },
  yes: { en: "yes", de: "ja" },
  no: { en: "no", de: "nein" },
  adult: { en: "adult", de: "erwachsen" },
  older: { en: "older", de: "älter" },
  veryOld: { en: "very old", de: "sehr alt" },
  young: { en: "young", de: "jung" },
  sturdy: { en: "sturdy", de: "kräftig" },
  broad: { en: "broad", de: "breit" },
  slim: { en: "slim", de: "schmal" },
  upright: { en: "upright", de: "aufrecht" },
  relaxed: { en: "relaxed", de: "entspannt" },
  hunched: { en: "hunched", de: "gebeugt" },
  dynamic: { en: "dynamic", de: "dynamisch" },
  clean: { en: "clean", de: "sauber" },
  used: { en: "used", de: "gebraucht" },
  weathered: { en: "weathered", de: "verwittert" },
  damaged: { en: "damaged", de: "beschädigt" },
  winter: { en: "winter", de: "Winter" },
  snow: { en: "snow climate", de: "Schneeklima" },
  ancient: { en: "ancient", de: "uralt" },
  dead: { en: "dead", de: "abgestorben" },
  dense: { en: "dense", de: "dicht" },
  covered: { en: "covered", de: "bedeckt" },
  heavy: { en: "heavy", de: "stark" },
  wind: { en: "wind loop", de: "Windschleife" },
  wood: { en: "wood", de: "Holz" },
  stone: { en: "stone", de: "Stein" },
  metal: { en: "metal", de: "Metall" },
  fabric: { en: "fabric", de: "Stoff" },
  leather: { en: "leather", de: "Leder" },
  mixed: { en: "mixed materials", de: "Mischmaterial" },
  floor: { en: "floor", de: "Boden" },
  wall: { en: "wall", de: "Wand" },
  roof: { en: "roof", de: "Dach" },
  surface: { en: "object surface", de: "Objektoberfläche" },
  grainAligned: { en: "grain-aligned", de: "entlang der Maserung" },
  coarse: { en: "coarse", de: "grob" },
  fine: { en: "fine", de: "fein" },
  planked: { en: "planked", de: "aus Planken" },
  dry: { en: "dry", de: "trocken" },
  neutralEven: { en: "neutral and even", de: "neutral und gleichmäßig" },
  worldAligned: { en: "aligned to world light", de: "am Weltlicht ausgerichtet" },
  roll: { en: "rolling", de: "rollend" },
  slide: { en: "sliding", de: "gleitend" },
  hover: { en: "hovering", de: "schwebend" },
  walk: { en: "walk", de: "Gehen" },
  run: { en: "run", de: "Laufen" },
  move: { en: "movement", de: "Bewegung" },
  rotate: { en: "rotation", de: "Rotation" },
  interact: { en: "interaction", de: "Interaktion" },
  openClose: { en: "open/close", de: "Öffnen/Schließen" },
  pulse: { en: "pulse", de: "Pulsieren" },
  wheels: { en: "wheels", de: "Räder" },
  magicDrive: { en: "magical drive", de: "magischer Antrieb" },
  bottomCenter: { en: "bottom-center", de: "unten mittig" },
  footprintCenter: { en: "footprint center", de: "Mitte der Standfläche" },
  canvasCenter: { en: "canvas center", de: "Canvas-Mitte" },
  contact: { en: "small contact shadow", de: "kleiner Kontaktschatten" },
  motionAdjusted: {
    en: "motion-adjusted contact shadow",
    de: "bewegungsangepasster Kontaktschatten",
  },
  maintained: { en: "well maintained", de: "gepflegt" },
  abandoned: { en: "abandoned", de: "verlassen" },
  inhabited: { en: "inhabited", de: "bewohnt" },
  active: { en: "active", de: "aktiv" },
  village: { en: "village", de: "Dorf" },
  city: { en: "city", de: "Stadt" },
  forest: { en: "forest", de: "Wald" },
  rectangular: { en: "rectangular", de: "rechteckig" },
  gable: { en: "gable", de: "Satteldach" },
  timberFrame: { en: "timber frame", de: "Fachwerk" },
  warmLit: { en: "warm-lit", de: "warm beleuchtet" },
  mapIntegrated: { en: "map-integrated", de: "in die Karte integriert" },
  tileAligned: { en: "tile-aligned", de: "am Tile-Raster ausgerichtet" },
  fullyBlocking: { en: "fully blocking", de: "vollständig blockierend" },
  walkableEntrance: { en: "walkable entrance", de: "begehbarer Eingang" },
  seamless: { en: "seamless", de: "nahtlos" },
  matchedEdges: { en: "matched edges", de: "passende Kanten" },
  bothAxes: { en: "both axes", de: "beide Achsen" },
  horizontal: { en: "horizontal", de: "horizontal" },
  vertical: { en: "vertical", de: "vertikal" },
  both: { en: "both", de: "beide" },
  strict: { en: "strict repetition", de: "strenge Wiederholung" },
  randomized: { en: "controlled randomization", de: "kontrollierte Zufallsvariation" },
  icon: { en: "icon", de: "Icon" },
  worldAsset: { en: "world asset", de: "Weltasset" },
  equipped: { en: "equipped view", de: "ausgerüstete Ansicht" },
  practical: { en: "practical", de: "praktisch" },
  decorative: { en: "decorative", de: "dekorativ" },
  wearable: { en: "wearable", de: "tragbar" },
  usable: { en: "usable", de: "benutzbar" },
  silhouetteFirst: { en: "silhouette-first", de: "Silhouette zuerst" },
  detailRich: { en: "detail-rich", de: "detailreich" },
  subtle: { en: "subtle", de: "dezent" },
  emissive: { en: "emissive", de: "emissiv" },
  concept: { en: "concept", de: "Konzept" },
  presentation: { en: "presentation", de: "Präsentation" },
  productionReference: { en: "production reference", de: "Produktionsreferenz" },
  figure: { en: "figure", de: "Figur" },
  object: { en: "object", de: "Objekt" },
  environment: { en: "environment", de: "Umgebung" },
  singleSubject: { en: "single subject", de: "Einzelmotiv" },
  group: { en: "group", de: "Gruppe" },
  square: { en: "square", de: "quadratisch" },
  portrait: { en: "portrait", de: "Hochformat" },
  landscape: { en: "landscape", de: "Querformat" },
  free: { en: "free format", de: "freies Format" },
  complete: { en: "fully developed", de: "vollständig ausgearbeitet" },
  simple: { en: "simple", de: "einfach" },
  form: { en: "form", de: "Form" },
  material: { en: "material", de: "Material" },
  mood: { en: "mood", de: "Stimmung" },
  story: { en: "story", de: "Geschichte" },
  scale: { en: "scale", de: "Maßstab" },
  neutral: { en: "neutral", de: "neutral" },
  warm: { en: "warm", de: "warm" },
  gloomy: { en: "gloomy", de: "düster" },
  night: { en: "night", de: "Nacht" },
  overview: { en: "overview", de: "Übersicht" },
  productionConcept: { en: "production concept", de: "Produktionskonzept" },
  showcase: { en: "showcase", de: "Showcase" },
});

export function localize(language: PromptLanguage, english: string, german: string): string {
  return language === "de" ? german : english;
}

export function normalizePromptText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function humanizeIdentifier(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[_-]+/gu, " ")
    .toLocaleLowerCase("en-US");
}

export function labelValue(value: string, language: PromptLanguage): string {
  return VALUE_LABELS[value]?.[language] ?? humanizeIdentifier(value);
}

export function formatBoolean(value: boolean, language: PromptLanguage): string {
  return value ? localize(language, "yes", "ja") : localize(language, "no", "nein");
}

export function formatList(values: readonly string[], language: PromptLanguage): string {
  return values.map((value) => labelValue(value, language)).join(", ");
}

export function formatFootprint(
  footprint: Readonly<{ widthTiles: number; depthTiles: number }>,
  language: PromptLanguage,
): string {
  return localize(
    language,
    `${String(footprint.widthTiles)} × ${String(footprint.depthTiles)} tiles`,
    `${String(footprint.widthTiles)} × ${String(footprint.depthTiles)} Tiles`,
  );
}

function uniqueNonEmpty(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const rawValue of values) {
    const value = normalizePromptText(rawValue);
    if (value === "" || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return Object.freeze(result);
}

export function createPromptModuleResult(
  id: PromptModuleId,
  input: Readonly<{
    heading?: string;
    main?: readonly string[];
    negative?: readonly string[];
    technical?: readonly string[];
  }> = {},
): PromptModuleResult {
  const mainLines = uniqueNonEmpty(input.main ?? []);
  const main =
    input.heading === undefined || mainLines.length === 0
      ? undefined
      : Object.freeze({
          heading: normalizePromptText(input.heading),
          lines: mainLines,
        });

  return Object.freeze({
    id,
    ...(main === undefined ? {} : { main }),
    negative: uniqueNonEmpty(input.negative ?? []),
    technical: uniqueNonEmpty(input.technical ?? []),
  });
}

export function detailLine(
  language: PromptLanguage,
  englishLabel: string,
  germanLabel: string,
  value: string | number | boolean | undefined,
): string | null {
  if (value === undefined) return null;
  const formatted =
    typeof value === "string"
      ? normalizePromptText(value)
      : typeof value === "boolean"
        ? formatBoolean(value, language)
        : String(value);
  if (formatted === "") return null;
  const suffix = /[.!?]$/u.test(formatted) ? "" : ".";
  return `${localize(language, englishLabel, germanLabel)}: ${formatted}${suffix}`;
}
