import {
  LEGACY_CHARACTER_ASSET_TYPES as CHARACTER_ASSET_TYPES,
  LEGACY_INDOOR_ENVIRONMENTS as INDOOR_ENVIRONMENTS,
  LEGACY_OUTPUT_MODE_DIRECTIONS as OUTPUT_MODE_DIRECTIONS,
} from "./legacyV1.defaults";
import {
  resolveLegacyV1FrameSize as resolveFrameSize,
  resolveLegacyV1Layout as resolveLayout,
} from "./legacyV1.metrics";
import { mergeLegacyV1State as mergeState } from "./legacyV1.state";
import type {
  LegacyColorBudget,
  LegacyLocalizedLabel,
  LegacyOutputLanguage,
  LegacyOutlineStyle,
  LegacyPaletteMode,
  LegacyPixelDensity,
  LegacyPromptOutput,
  LegacyStyleBalance,
  LegacyStyleProfile,
  LegacyV1State,
  LegacyV1StateInput,
} from "./legacyV1.types";

type LabelDictionary = Readonly<Record<string, LegacyLocalizedLabel>>;

export const LEGACY_PROFILE_LABELS: Readonly<Record<LegacyStyleProfile, LegacyLocalizedLabel>> =
  Object.freeze({
    classic: Object.freeze({
      de: "Profil A · Klassische Fantasy",
      en: "Profile A · Classic Fantasy",
    }),
    dark: Object.freeze({ de: "Profil B · Düstere Fantasy", en: "Profile B · Dark Fantasy" }),
  });

export const LEGACY_LANGUAGE_LABELS: Readonly<Record<LegacyOutputLanguage, string>> = Object.freeze(
  {
    de: "Deutsch",
    en: "English",
  },
);

const ASSET_LABELS: LabelDictionary = Object.freeze({
  hero: { de: "Heldenfigur", en: "hero character" },
  npc: { de: "NPC-Figur", en: "NPC character" },
  enemy: { de: "Gegnerfigur", en: "enemy character" },
  boss: { de: "Bossfigur", en: "boss character" },
  creature: { de: "Kreatur oder Tier", en: "creature or animal" },
  building: { de: "Gebäude", en: "building" },
  interiorObject: { de: "Innenraumobjekt", en: "interior object" },
  outdoorObject: { de: "Außenobjekt", en: "outdoor object" },
  plant: { de: "Pflanze", en: "plant" },
  tree: { de: "Baum", en: "tree" },
  rock: { de: "Felsformation", en: "rock formation" },
  ruin: { de: "Ruinenstruktur", en: "ruin structure" },
  weapon: { de: "Waffe", en: "weapon" },
  armor: { de: "Rüstungsteil", en: "armor piece" },
  consumable: { de: "Verbrauchsgegenstand", en: "consumable item" },
  questItem: { de: "Quest- oder Schatzobjekt", en: "quest or treasure item" },
  groundTile: { de: "Boden-Tile", en: "ground tile" },
  wallElement: { de: "Wand- oder Architekturelement", en: "wall or architectural element" },
});

const ENVIRONMENT_LABELS: LabelDictionary = Object.freeze({
  outdoor: { de: "Außenbereich", en: "outdoor area" },
  indoor: { de: "Innenraum", en: "interior" },
  forest: { de: "Wald", en: "forest" },
  village: { de: "Dorf", en: "village" },
  town: { de: "Stadt", en: "town" },
  ruinArea: { de: "Ruinengebiet", en: "ruin area" },
  dungeon: { de: "Dungeon", en: "dungeon" },
  cave: { de: "Höhle", en: "cave" },
  mountain: { de: "Gebirge", en: "mountain region" },
  snow: { de: "Schneegebiet", en: "snow region" },
  swamp: { de: "Sumpf", en: "swamp" },
  desert: { de: "Wüste", en: "desert" },
  magicArea: { de: "magischer Ort", en: "magical location" },
});

const TIME_LABELS: LabelDictionary = Object.freeze({
  day: { de: "Tag", en: "day" },
  night: { de: "Nacht", en: "night" },
  dawn: { de: "Morgendämmerung", en: "dawn" },
  dusk: { de: "Abenddämmerung", en: "dusk" },
  interiorLit: { de: "beleuchteter Innenraum", en: "lit interior" },
  interiorDark: { de: "dunkler Innenraum", en: "dark interior" },
  notApplicable: { de: "ohne feste Tageszeit", en: "without a fixed time of day" },
});

const MOOD_LABELS: LabelDictionary = Object.freeze({
  neutral: { de: "neutral", en: "neutral" },
  adventure: { de: "abenteuerlich", en: "adventurous" },
  cozy: { de: "warm und bewohnt", en: "warm and inhabited" },
  ominous: { de: "unheilvoll", en: "ominous" },
  melancholic: { de: "melancholisch", en: "melancholic" },
  magical: { de: "magisch", en: "magical" },
  hostile: { de: "feindselig", en: "hostile" },
});

const FACING_LABELS: LabelDictionary = Object.freeze({
  south: { de: "Süd / vorne", en: "south / front" },
  southwest: { de: "Südwest / vorne-links", en: "southwest / front-left" },
  west: { de: "West / links", en: "west / left" },
  northwest: { de: "Nordwest / hinten-links", en: "northwest / back-left" },
  north: { de: "Nord / hinten", en: "north / back" },
  northeast: { de: "Nordost / hinten-rechts", en: "northeast / back-right" },
  east: { de: "Ost / rechts", en: "east / right" },
  southeast: { de: "Südost / vorne-rechts", en: "southeast / front-right" },
});

const CONDITION_LABELS: LabelDictionary = Object.freeze({
  new: { de: "neu", en: "new" },
  maintained: { de: "gepflegt", en: "well maintained" },
  used: { de: "gebraucht", en: "used" },
  weathered: { de: "verwittert", en: "weathered" },
  damaged: { de: "beschädigt", en: "damaged" },
  overgrown: { de: "überwuchert", en: "overgrown" },
  repaired: { de: "repariert", en: "repaired" },
  abandoned: { de: "verlassen", en: "abandoned" },
  magical: { de: "magisch verändert", en: "magically altered" },
});

const OUTPUT_LABELS: LabelDictionary = Object.freeze({
  single: { de: "ein einzelnes freigestelltes Asset", en: "one isolated asset" },
  directional4: { de: "ein Richtungsset mit vier Ansichten", en: "a four-direction view set" },
  directional8: { de: "ein Richtungsset mit acht Ansichten", en: "an eight-direction view set" },
  assetSet: { de: "ein zusammengehöriges Asset-Set", en: "a coherent asset set" },
  spriteSheet: { de: "ein produktionsreifes Sprite-Sheet", en: "a production-ready sprite sheet" },
  tileset: { de: "ein produktionsreifes Tileset", en: "a production-ready tileset" },
  concept: { de: "ein Konzept- oder Referenzbild", en: "a concept or reference image" },
});

const DETAIL_LABELS: LabelDictionary = Object.freeze({
  normal: { de: "normales Spielasset", en: "standard gameplay asset" },
  important: { de: "wichtiges Spielasset", en: "important gameplay asset" },
  heroic: { de: "Hauptasset mit Showcase-Detailtiefe", en: "hero or showcase asset" },
});

const ANCHOR_LABELS: LabelDictionary = Object.freeze({
  automatic: {
    de: "automatischer Anker passend zum Asset-Typ",
    en: "automatic anchor appropriate for the asset type",
  },
  bottomCenter: { de: "Fußpunkt unten mittig", en: "bottom-center foot anchor" },
  footprintCenter: { de: "Mitte der Standfläche", en: "footprint-center anchor" },
  canvasCenter: { de: "exakte Canvas-Mitte", en: "exact canvas-center anchor" },
});

const safeLabel = (dictionary: LabelDictionary, key: string, lang: LegacyOutputLanguage): string =>
  dictionary[key]?.[lang] ?? String(key);

function requestedProfiles(state: LegacyV1State): LegacyStyleProfile[] {
  return state.profileOutputMode === "both"
    ? ["classic", "dark"]
    : [state.selectedProfile === "dark" ? "dark" : "classic"];
}

function requestedLanguages(state: LegacyV1State): LegacyOutputLanguage[] {
  return state.promptLanguage === "both"
    ? ["en", "de"]
    : [state.promptLanguage === "de" ? "de" : "en"];
}

function profileDirection(
  profile: LegacyStyleProfile,
  balance: LegacyStyleBalance,
  lang: LegacyOutputLanguage,
): string {
  const classic = {
    de: "klassische, geerdete mittelalterliche Fantasy mit handwerklich glaubwürdigen Formen, organischen Naturflächen, natürlicher Materialwirkung und klarer Abenteuerlesbarkeit",
    en: "classic grounded medieval fantasy with believable handcrafted forms, organic natural surfaces, clear material identity, and readable adventure-oriented design",
  };
  const dark = {
    de: "düstere, geerdete Fantasy mit gealterten Oberflächen, rauer Materialwirkung, schweren Formen, kontrollierter Bedrohlichkeit und gut lesbaren Kontrasten",
    en: "dark grounded fantasy with aged surfaces, rough material character, weighty forms, controlled menace, and readable value contrast",
  };

  const balanceText = {
    retro: {
      de: "Formen stärker vereinfachen und die Detailmenge bewusst reduzieren",
      en: "simplify shapes more strongly and deliberately reduce the amount of detail",
    },
    balanced: {
      de: "detailreiche, atmosphärische und organische Darstellung dominieren lassen; vereinfachte Großformen nur unterstützend für Spiellesbarkeit einsetzen",
      en: "let detailed, atmospheric, organic rendering dominate; use simplified large shapes only as a supporting layer for gameplay readability",
    },
    modern: {
      de: "moderne Materialtiefe, feinere Pixelcluster und mehr charakteristische Oberflächendetails verwenden, ohne die Spiellesbarkeit zu verlieren",
      en: "use modern material depth, finer pixel clusters, and more characteristic surface detail without sacrificing gameplay readability",
    },
  };

  return `${profile === "dark" ? dark[lang] : classic[lang]}; ${balanceText[balance]?.[lang] ?? balanceText.balanced[lang]}`;
}

function pixelDirection(mode: LegacyPixelDensity, lang: LegacyOutputLanguage): string {
  const entries = {
    classicHd: {
      de: "klassisch-hochauflösende Pixelart mit deutlich sichtbaren Pixelclustern, zurückhaltender Detaildichte und sauberer Retro-Lesbarkeit",
      en: "classic high-definition pixel art with clearly visible pixel clusters, restrained detail density, and clean retro readability",
    },
    modernHd: {
      de: "moderne hochauflösende Pixelart, nativ in der Zielauflösung gezeichnet, mit feinen absichtlichen Pixelclustern, detaillierten Materialien und klar sichtbarer Pixelstruktur",
      en: "modern high-resolution pixel art drawn natively at final resolution, using fine intentional pixel clusters, detailed materials, and a clearly visible pixel structure",
    },
    ultraHd: {
      de: "sehr fein aufgelöste moderne Pixelart mit hoher Detaildichte, kontrollierten Clustern und weiterhin eindeutig pixelbasierter Darstellung",
      en: "ultra-fine modern pixel art with high detail density, controlled clusters, and an unmistakably pixel-based appearance",
    },
  };
  return entries[mode]?.[lang] ?? entries.modernHd[lang];
}

function outlineDirection(mode: LegacyOutlineStyle, lang: LegacyOutputLanguage): string {
  const entries = {
    dark: {
      de: "klare dunkle Außenkonturen für starke Trennung",
      en: "clear dark outer outlines for strong separation",
    },
    softSelective: {
      de: "weiche selektive Konturen: nur an wichtigen Silhouettenkanten und Materialgrenzen stärker, an beleuchteten Kanten reduziert oder farbig angepasst",
      en: "soft selective outlines: stronger only on important silhouette edges and material boundaries, reduced or hue-shifted on lit edges",
    },
    minimal: {
      de: "sehr zurückhaltende Konturen mit Trennung hauptsächlich durch Farb- und Helligkeitswerte",
      en: "very restrained outlines, separating forms mainly through hue and value changes",
    },
  };
  return entries[mode]?.[lang] ?? entries.softSelective[lang];
}

function paletteDirection(
  profile: LegacyStyleProfile,
  mode: LegacyPaletteMode,
  lang: LegacyOutputLanguage,
): string {
  const entries = {
    natural: {
      de: "natürliche, leicht gedämpfte Farben mit klaren lokalen Materialfarben",
      en: "natural, slightly muted colors with clear local material hues",
    },
    vivid: {
      de: "kräftigere, lebendigere Farben mit kontrollierter Sättigung",
      en: "stronger, more vivid colors with controlled saturation",
    },
    desaturated: {
      de: "dunklere, stärker entsättigte Farben mit gut lesbarer Wertestruktur",
      en: "darker, more desaturated colors with a readable value structure",
    },
  };

  if (mode !== "byProfile") {
    return entries[mode]?.[lang] ?? entries.natural[lang];
  }

  return profile === "dark"
    ? lang === "de"
      ? "profilabhängig dunklere, rauere und leicht entsättigte Farben; keine zugelaufenen Schwarztöne"
      : "profile-specific darker, rougher, slightly desaturated colors; avoid crushed blacks"
    : lang === "de"
      ? "profilabhängig natürliche, etwas freundlichere und leicht gedämpfte Farben mit klaren Materialunterschieden"
      : "profile-specific natural, slightly more welcoming, lightly muted colors with clear material separation";
}

function colorBudgetDirection(value: LegacyColorBudget, lang: LegacyOutputLanguage): string {
  if (value === "unlimited") {
    return lang === "de"
      ? "keine harte Farbzahl, aber kontrollierte Farbfamilien"
      : "no hard color count, but controlled color families";
  }
  if (value === "adaptive") {
    return lang === "de"
      ? "adaptives, motivabhängig begrenztes Farbbudget"
      : "an adaptive subject-dependent color budget";
  }
  return lang === "de"
    ? `ungefähr bis zu ${value} bewusst gewählte Farben pro Asset oder Frame`
    : `approximately up to ${value} deliberately chosen colors per asset or frame`;
}

function cameraDirection(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  const perspective = {
    topdown: {
      de: "klassische fast senkrechte Top-down-Perspektive",
      en: "classic near-vertical top-down view",
    },
    threeQuarter: {
      de: "feste frontale 3/4-RPG-Draufsicht",
      en: "fixed frontal oblique top-down 3/4 RPG view",
    },
    isometric: { de: "feste isometrische Perspektive", en: "fixed isometric view" },
    side: { de: "feste Seitenansicht", en: "fixed side view" },
  }[state.perspectiveType] ?? {
    de: "feste frontale 3/4-RPG-Draufsicht",
    en: "fixed frontal oblique top-down 3/4 RPG view",
  };

  const projection =
    state.projectionType === "mildPerspective"
      ? { de: "mit leichter Perspektivprojektion", en: "with mild perspective projection" }
      : { de: "mit orthografischer Projektion", en: "with orthographic projection" };

  const direction = {
    southToNorth: {
      de: "Kamera exakt südlich des Motivs, gerade nach Norden ausgerichtet; Nord ist oben und Süd unten im Bild",
      en: "camera centered exactly south of the subject and facing straight north; north is screen-up and south is screen-down",
    },
    swToNe: {
      de: "Kamera von Südwest nach Nordost ausgerichtet",
      en: "camera aligned from southwest toward northeast",
    },
    seToNw: {
      de: "Kamera von Südost nach Nordwest ausgerichtet",
      en: "camera aligned from southeast toward northwest",
    },
  }[state.cameraDirection] ?? {
    de: "Kamera exakt südlich des Motivs und gerade nach Norden ausgerichtet",
    en: "camera centered exactly south of the subject and facing straight north",
  };

  const rules = [];
  if (state.lockAxes) {
    rules.push(lang === "de" ? "Weltachsen bildschirmparallel" : "world axes screen-aligned");
  }
  if (state.noPerspectiveScale) {
    rules.push(
      lang === "de" ? "keine Größenabnahme mit Entfernung" : "no distance-based scale reduction",
    );
  }
  if (state.noIsometricAxes) {
    rules.push(lang === "de" ? "keine isometrischen Diagonalachsen" : "no isometric diagonal axes");
  }
  if (state.cameraNeverRotates) {
    rules.push(
      lang === "de"
        ? "Kamera zwischen Assets und Richtungen niemals drehen"
        : "never rotate the camera between assets or directions",
    );
  }

  const base =
    lang === "de"
      ? `${perspective.de}, ${projection.de}, ungefähr ${state.cameraAngle}° Abwärtsneigung von der Horizontalen; ${direction.de}`
      : `${perspective.en}, ${projection.en}, pitched approximately ${state.cameraAngle}° downward from horizontal; ${direction.en}`;

  return rules.length ? `${base}; ${rules.join("; ")}` : base;
}

function resolveLighting(
  state: LegacyV1State,
  profile: LegacyStyleProfile,
  lang: LegacyOutputLanguage,
): string {
  if (state.lightingPolicy !== "adaptive") {
    const fixed = {
      neutralDay: {
        de: "neutrales Tageslicht mit klarer, unverfälschter Materialfarbe",
        en: "neutral daylight with clear, unshifted material colors",
      },
      warmInterior: {
        de: "warmes lokales Innenlicht mit kontrollierten weichen Schatten",
        en: "warm local interior light with controlled soft shadows",
      },
      gloomyDiffuse: {
        de: "düsteres diffuses Licht mit gedämpften Schatten und klarer Silhouettenlesbarkeit",
        en: "gloomy diffuse light with subdued shadows and clear silhouette readability",
      },
      neutralNight: {
        de: "neutrales niedrigintensives Nachtlicht ohne übertriebene Blaufärbung",
        en: "neutral low-intensity night light without an exaggerated blue cast",
      },
      coolNight: {
        de: "leicht kühles Nachtlicht mit kontrollierter Farbstimmung",
        en: "slightly cool night light with controlled color atmosphere",
      },
      custom: {
        de: state.lightingNotes || "eigene Lichtbeschreibung verwenden",
        en: state.lightingNotes || "use the custom lighting description",
      },
    };
    return fixed[state.lightingPolicy]?.[lang] ?? fixed.custom[lang];
  }

  const indoor = INDOOR_ENVIRONMENTS.has(state.environment);
  const darkMood = ["ominous", "hostile"].includes(state.mood);
  let resolved;

  if (state.timeOfDay === "interiorLit") {
    resolved = {
      de: "warmes Licht aus glaubwürdigen lokalen Lichtquellen im Gebäude, mit sanftem kontrolliertem Schattenfall",
      en: "warm light from believable local sources inside the building, with soft controlled shadow falloff",
    };
  } else if (state.timeOfDay === "interiorDark") {
    resolved = {
      de: "neutrales niedrigintensives Nacht- oder Restlicht im Innenraum; warme Akzente nur dort, wo eine sichtbare Lichtquelle existiert",
      en: "neutral low-intensity night or residual ambient light indoors; warm accents only where a visible light source exists",
    };
  } else if (darkMood) {
    resolved = {
      de: "düsteres diffuses Licht passend zur unheilvollen Stimmung, mit lesbaren Mitteltönen und ohne zugelaufene Schatten",
      en: "gloomy diffuse lighting appropriate to the ominous mood, preserving readable midtones and avoiding crushed shadows",
    };
  } else if (state.timeOfDay === "night") {
    resolved = indoor
      ? {
          de: "neutrales niedrigintensives Nachtlicht im Innenraum; keine pauschale blaue Farbfläche",
          en: "neutral low-intensity night light indoors; no blanket blue color wash",
        }
      : {
          de: "neutrales bis sehr leicht kühles Nachtlicht im Außenbereich, mit klaren lokalen Farben und kontrollierten Kontrasten",
          en: "neutral to very slightly cool outdoor night light, retaining local colors and controlled contrast",
        };
  } else if (state.timeOfDay === "dawn" || state.timeOfDay === "dusk") {
    resolved = {
      de: "natürliches flaches Übergangslicht mit begrenzter Wärme und weiterhin neutral lesbaren Materialien",
      en: "natural low-angle transitional light with restrained warmth and still-neutral material readability",
    };
  } else if (indoor) {
    resolved = {
      de: "warmes glaubwürdiges Innenlicht, sofern der Raum bewohnt oder beleuchtet ist; andernfalls neutrales diffuses Restlicht",
      en: "warm believable interior light when the room is inhabited or lit; otherwise neutral diffuse ambient light",
    };
  } else {
    resolved = {
      de: "neutrales Tageslicht im Außenbereich mit klaren Materialfarben und kontrollierten Schatten",
      en: "neutral outdoor daylight with clear material colors and controlled shadows",
    };
  }

  const profileAdjustment =
    profile === "dark"
      ? lang === "de"
        ? "Die düstere Wirkung über Werte, Materialzustand und Atmosphäre erzeugen, nicht durch vollständiges Abdunkeln."
        : "Create the darker tone through values, material condition, and atmosphere rather than globally darkening the asset."
      : lang === "de"
        ? "Die Beleuchtung klar, natürlich und abenteuerlich lesbar halten."
        : "Keep the lighting clear, natural, and adventure-readable.";

  return `${resolved[lang]} ${profileAdjustment}`;
}

function shadowDirection(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  const entries = {
    automatic: {
      de: "je nach Asset automatisch: Figuren und große Standobjekte dürfen einen sehr kleinen pixelgenauen Kontaktschatten erhalten; Items und Tiles standardmäßig ohne losgelösten Bodenschatten",
      en: "automatic by asset: characters and large grounded objects may use a very small pixel-accurate contact shadow; items and tiles default to no detached ground shadow",
    },
    none: { de: "kein sichtbarer Bodenschatten", en: "no visible ground shadow" },
    contact: {
      de: "ein sehr kleiner pixelgenauer Kontaktschatten direkt am Bodenanker",
      en: "one very small pixel-accurate contact shadow directly at the ground anchor",
    },
  };
  return entries[state.shadowMode]?.[lang] ?? entries.automatic[lang];
}

function backgroundDirection(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  if (state.backgroundMode === "scene") {
    return lang === "de"
      ? "passender szenischer Hintergrund, klar vom Hauptmotiv getrennt"
      : "a fitting scene background clearly separated from the main subject";
  }
  return lang === "de"
    ? `echter transparenter Alpha-Hintergrund mit mindestens ${state.alphaPadding} px Sicherheitsrand; kein Schachbrett, keine farbige Fläche und keine Hintergrundkulisse`
    : `true transparent alpha background with at least ${state.alphaPadding}px safety padding; no checkerboard, colored field, or scenery`;
}

function outputDirection(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  const base = safeLabel(OUTPUT_LABELS, state.outputMode, lang);
  if (state.outputMode === "single") {
    return lang === "de"
      ? `${base}; Motiv blickt nach ${safeLabel(FACING_LABELS, state.assetFacing, lang)}`
      : `${base}; subject faces ${safeLabel(FACING_LABELS, state.assetFacing, lang)}`;
  }
  if (state.outputMode === "directional4") {
    return lang === "de"
      ? `${base}; Reihenfolge links nach rechts: Süd/vorne, West/links, Nord/hinten, Ost/rechts`
      : `${base}; reading order left to right: south/front, west/left, north/back, east/right`;
  }
  if (state.outputMode === "directional8") {
    return lang === "de"
      ? `${base}; Lesereihenfolge: Süd, Südwest, West, Nordwest, Nord, Nordost, Ost, Südost`
      : `${base}; reading order: south, southwest, west, northwest, north, northeast, east, southeast`;
  }
  return base;
}

function scaleDirection(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  const tile = Number(state.tileSize) || 32;
  const height = Number(state.characterHeight) || 80;
  const widthTiles = Number(state.footprintWidthTiles) || 1;
  const depthTiles = Number(state.footprintDepthTiles) || 1;
  const frame = resolveFrameSize(state);
  const layout = resolveLayout(state);
  const canvasWidth = frame * layout.columns;
  const canvasHeight = frame * layout.rows;
  const isCharacter = CHARACTER_ASSET_TYPES.has(state.assetType);

  if (lang === "de") {
    const parts = [
      `${tile} × ${tile} px Tile-Raster`,
      `${widthTiles} × ${depthTiles} Tiles Standfläche`,
      `${frame} × ${frame} px pro Frame`,
    ];
    if (isCharacter) {
      parts.push(`Ziel-Figurenhöhe ${height} px mit höchstens 1 px Abweichung zwischen Richtungen`);
    } else {
      parts.push(`Figurenreferenz ${height} px zur konsistenten Welt-Skalierung`);
    }
    if (layout.columns > 1 || layout.rows > 1) {
      parts.push(
        `Gesamt-Canvas ${canvasWidth} × ${canvasHeight} px bei ${layout.columns} × ${layout.rows} Frames`,
      );
    }
    return parts.join("; ");
  }

  const parts = [
    `${tile} × ${tile}px tile grid`,
    `${widthTiles} × ${depthTiles} tile footprint`,
    `${frame} × ${frame}px per frame`,
  ];
  if (isCharacter) {
    parts.push(
      `target character height ${height}px with no more than 1px variance between directions`,
    );
  } else {
    parts.push(`${height}px character reference for consistent world scale`);
  }
  if (layout.columns > 1 || layout.rows > 1) {
    parts.push(
      `total canvas ${canvasWidth} × ${canvasHeight}px using a ${layout.columns} × ${layout.rows} frame layout`,
    );
  }
  return parts.join("; ");
}

function qualityRules(state: LegacyV1State, lang: LegacyOutputLanguage): string {
  const rules = [];
  if (state.gameReadable) {
    rules.push(
      lang === "de" ? "Spiellesbarkeit hat Vorrang" : "gameplay readability takes priority",
    );
  }
  if (state.cleanSilhouette) {
    rules.push(lang === "de" ? "Silhouette sofort lesbar" : "silhouette immediately readable");
  }
  if (state.preserveProportions) {
    rules.push(
      lang === "de"
        ? "identische Proportionen in allen Ansichten"
        : "identical proportions across all views",
    );
  }
  if (state.separateForms) {
    rules.push(
      lang === "de"
        ? "Körperteile, Materialien und Ausrüstung klar getrennt"
        : "body parts, materials, and equipment clearly separated",
    );
  }
  if (state.productionReady) {
    rules.push(
      lang === "de"
        ? "produktionsreif und direkt weiterverwendbar"
        : "production-ready and directly reusable",
    );
  }
  if (state.avoidOverdetail) {
    rules.push(
      lang === "de"
        ? "keine unnötige Dekoration oder visuelles Rauschen"
        : "no unnecessary decoration or visual noise",
    );
  }
  if (state.nativeResolution) {
    rules.push(
      lang === "de" ? "nativ in der Zielauflösung zeichnen" : "draw natively at target resolution",
    );
  }
  if (state.nearestNeighbor) {
    rules.push(
      lang === "de"
        ? "bei Skalierung ausschließlich Nearest Neighbor"
        : "use nearest-neighbor only for scaling",
    );
  }
  if (state.pixelPerfectEdges) {
    rules.push(
      lang === "de"
        ? "pixelgenaue Kanten ohne Anti-Aliasing"
        : "pixel-perfect edges without anti-aliasing",
    );
  }
  return rules.join("; ");
}

function mainPrompt(
  state: LegacyV1State,
  profile: LegacyStyleProfile,
  lang: LegacyOutputLanguage,
): string {
  const project = String(state.projectName || "").trim();
  const subject = String(state.subjectDescription || "").trim();
  const extras = String(state.extraDetails || "").trim();
  const materials = String(state.materials || "").trim();
  const customRules = String(state.customRules || "").trim();
  const lightingNotes = String(state.lightingNotes || "").trim();
  const projectText = project
    ? `“${project}”`
    : lang === "de"
      ? "dieses Spielprojekt"
      : "this game project";

  if (lang === "de") {
    const sections = [
      `AUFGABE\nErzeuge für ${projectText} ${outputDirection(state, lang)} als ${safeLabel(ASSET_LABELS, state.assetType, lang)}. Das Ergebnis ist ${safeLabel(DETAIL_LABELS, state.detailLevel, lang)}.`,
      `MOTIV\n${subject || "Motiv gemäß der gewählten Asset-Kategorie gestalten."}\nZustand: ${safeLabel(CONDITION_LABELS, state.condition, lang)}.\nMaterialien: ${materials || "Materialien passend zum Motiv klar unterscheiden."}${extras ? `\nZusatzdetails: ${extras}` : ""}`,
      `ART-DIRECTION · ${LEGACY_PROFILE_LABELS[profile].de.toUpperCase()}\n${profileDirection(profile, state.styleBalance, lang)}. Verwende ${pixelDirection(state.pixelDensity, lang)}. Farbregel: ${paletteDirection(profile, state.paletteMode, lang)}; ${colorBudgetDirection(state.colorBudget, lang)}. Konturen: ${outlineDirection(state.outlineStyle, lang)}.`,
      `KAMERA-SPERRE\n${cameraDirection(state, lang)}. Bei Richtungssets bleibt die Kamera vollständig unverändert; ausschließlich das Motiv rotiert um seinen festen Bodenanker.`,
      `SETTING UND LICHT\nUmgebung: ${safeLabel(ENVIRONMENT_LABELS, state.environment, lang)}. Zustand: ${safeLabel(TIME_LABELS, state.timeOfDay, lang)}. Stimmung: ${safeLabel(MOOD_LABELS, state.mood, lang)}. Licht: ${resolveLighting(state, profile, lang)}${lightingNotes ? `\nProjekt-Lichtregel: ${lightingNotes}` : ""}`,
      `KOMPOSITION UND AUSGABE\n${scaleDirection(state, lang)}. Hintergrund: ${backgroundDirection(state, lang)}. Schatten: ${shadowDirection(state, lang)}. Anker: ${safeLabel(ANCHOR_LABELS, state.anchorMode, lang)}. Alle Ansichten müssen denselben Maßstab, dieselbe Baseline, identische Proportionen, dieselbe Lichtseite und dieselbe Materiallogik verwenden.`,
      `QUALITÄTSREGELN\n${qualityRules(state, lang)}.${customRules ? `\nWeitere verbindliche Regeln: ${customRules}` : ""}${state.noBrandRefs ? "\nKeine direkten Namen, Logos, Figurenentwürfe oder Stilkopien bestehender Spiele, Marken oder Künstler verwenden." : ""}`,
    ];
    return sections.join("\n\n");
  }

  const sections = [
    `TASK\nCreate ${outputDirection(state, lang)} for ${projectText} as a ${safeLabel(ASSET_LABELS, state.assetType, lang)}. Treat it as an ${safeLabel(DETAIL_LABELS, state.detailLevel, lang)}.`,
    `SUBJECT\n${subject || "Design the subject according to the selected asset category."}\nCondition: ${safeLabel(CONDITION_LABELS, state.condition, lang)}.\nMaterials: ${materials || "Clearly distinguish materials appropriate to the subject."}${extras ? `\nAdditional details: ${extras}` : ""}`,
    `ART DIRECTION · ${LEGACY_PROFILE_LABELS[profile].en.toUpperCase()}\n${profileDirection(profile, state.styleBalance, lang)}. Use ${pixelDirection(state.pixelDensity, lang)}. Color rule: ${paletteDirection(profile, state.paletteMode, lang)}; ${colorBudgetDirection(state.colorBudget, lang)}. Outline treatment: ${outlineDirection(state.outlineStyle, lang)}.`,
    `CAMERA LOCK\n${cameraDirection(state, lang)}. For directional sets, keep the camera completely unchanged and rotate only the subject around its fixed ground anchor.`,
    `SETTING AND LIGHT\nEnvironment: ${safeLabel(ENVIRONMENT_LABELS, state.environment, lang)}. Time or room state: ${safeLabel(TIME_LABELS, state.timeOfDay, lang)}. Mood: ${safeLabel(MOOD_LABELS, state.mood, lang)}. Lighting: ${resolveLighting(state, profile, lang)}${lightingNotes ? `\nProject lighting policy: ${lightingNotes}` : ""}`,
    `COMPOSITION AND OUTPUT\n${scaleDirection(state, lang)}. Background: ${backgroundDirection(state, lang)}. Shadow: ${shadowDirection(state, lang)}. Anchor: ${safeLabel(ANCHOR_LABELS, state.anchorMode, lang)}. Every view must use the same scale, baseline, proportions, light side, and material language.`,
    `QUALITY RULES\n${qualityRules(state, lang)}.${customRules ? `\nAdditional binding rules: ${customRules}` : ""}${state.noBrandRefs ? "\nDo not use direct names, logos, character designs, or style copies from existing games, brands, or artists." : ""}`,
  ];
  return sections.join("\n\n");
}

function negativePrompt(
  state: LegacyV1State,
  profile: LegacyStyleProfile,
  lang: LegacyOutputLanguage,
): string {
  const cameraTerms =
    state.perspectiveType === "threeQuarter"
      ? lang === "de"
        ? "isometrische Ansicht, diagonal gedrehte Kamera, reine Seitenansicht, streng senkrechte Vogelperspektive, wechselnder Kamerawinkel, Kamera-Rollwinkel, Fluchtpunkte, perspektivische Größenabnahme"
        : "isometric view, diagonally rotated camera, pure side view, strict vertical bird's-eye view, changing camera angle, camera roll, vanishing points, distance-based scale reduction"
      : lang === "de"
        ? "falscher Kamerawinkel, wechselnde Projektion, inkonsistente Achsen, Kamera-Rollwinkel, Fisheye-Verzerrung"
        : "wrong camera angle, changing projection, inconsistent axes, camera roll, fisheye distortion";

  const pixelTerms =
    lang === "de"
      ? "3D-Render, Vektorgrafik, Fotorealismus, glatte Digitalmalerei, Airbrush, künstlicher Pixel-Filter, hochskalierte Low-Resolution-Grafik, unscharfe Pixel, Anti-Aliasing, Subpixel-Kanten, verschmierte Cluster, zufälliges Dithering, verlaufende Texturen"
      : "3D render, vector art, photorealism, smooth digital painting, airbrush, fake pixel filter, upscaled low-resolution art, blurry pixels, anti-aliasing, subpixel edges, smeared clusters, random dithering, bleeding textures";

  const compositionTerms =
    lang === "de"
      ? "abgeschnittenes Motiv, fehlende Teile, schwebendes Asset, uneinheitliche Baseline, falsche Standfläche, uneinheitlicher Maßstab, veränderte Proportionen, unlesbare Silhouette, verschmolzene Materialien, visuelles Rauschen, unnötige Ornamente, unbestellte Requisiten, Text, Logo, Wasserzeichen, Rahmen"
      : "cropped subject, missing parts, floating asset, inconsistent baseline, wrong footprint, inconsistent scale, changed proportions, unreadable silhouette, merged materials, visual noise, unnecessary ornaments, unrequested props, text, logo, watermark, frame";

  const transparencyTerms =
    state.backgroundMode === "transparent"
      ? lang === "de"
        ? "Hintergrundszene, Horizont, Himmel, Landschaft, dekorative Bodenplatte, farbige Hintergrundfläche, Alpha-Schachbrett als Bildinhalt, deckender Hintergrund"
        : "background scene, horizon, sky, landscape, decorative ground plate, colored backdrop, alpha checkerboard drawn into the image, opaque background"
      : "";

  const outlineTerms =
    state.outlineStyle === "softSelective"
      ? lang === "de"
        ? "gleichmäßig dicke schwarze Kontur um jede Innen- und Außenkante"
        : "uniform thick black outline around every interior and exterior edge"
      : "";

  const directionTerms = OUTPUT_MODE_DIRECTIONS[state.outputMode]
    ? lang === "de"
      ? "fehlende Richtung, doppelte Richtung, falsche Richtungsreihenfolge, gespiegelte statt neu gezeichnete Ansicht, wechselnde Kleidung oder Ausrüstung, wechselnde Körperhöhe, wechselnder Bodenanker, wechselnde Lichtseite, zusätzliche Animationsphasen"
      : "missing direction, duplicate direction, wrong direction order, mirrored view instead of a newly drawn view, changing clothing or equipment, changing body height, changing ground anchor, changing light side, extra animation phases"
    : "";

  const shadowTerms =
    state.shadowMode === "none"
      ? lang === "de"
        ? "Bodenschatten, Schlagschatten außerhalb des Assets"
        : "ground shadow, cast shadow outside the asset"
      : lang === "de"
        ? "großer weicher Schlagschatten, vom Asset gelöster Schatten"
        : "large soft cast shadow, detached shadow";

  const characterTerms = CHARACTER_ASSET_TYPES.has(state.assetType)
    ? lang === "de"
      ? "zusätzliche Gliedmaßen, fehlende Gliedmaßen, inkonsistente Hände, inkonsistentes Gesicht, anatomisch wechselnde Richtungen"
      : "extra limbs, missing limbs, inconsistent hands, inconsistent face, anatomically changing directions"
    : "";

  const rightsTerms = state.noBrandRefs
    ? lang === "de"
      ? "direkte Spielnamen, Markennamen, Künstlernamen, bekannte Figurenkopien, Logos, geschützte Embleme, Stilimitat eines einzelnen bestehenden Werks"
      : "direct game names, brand names, artist names, recognizable character copies, logos, protected emblems, imitation of one specific existing work"
    : "";

  const profileTerms =
    profile === "dark"
      ? lang === "de"
        ? "vollständig schwarze Schatten, unlesbar dunkle Gesamtfläche, monochrome Schlammtöne"
        : "fully black shadows, unreadably dark overall image, monochrome muddy colors"
      : lang === "de"
        ? "grell kindliche Bonbonfarben, übermäßig niedlicher Chibi-Look, plastikartige Oberflächen"
        : "harsh candy colors, excessively cute chibi treatment, plastic-looking surfaces";

  const groups = [
    cameraTerms,
    pixelTerms,
    compositionTerms,
    transparencyTerms,
    shadowTerms,
    outlineTerms,
    directionTerms,
    characterTerms,
    rightsTerms,
    profileTerms,
  ].filter(Boolean);

  if (lang === "de") {
    return groups.map((group, index) => `${index + 1}. ${group}`).join("\n");
  }
  return groups.map((group, index) => `${index + 1}. ${group}`).join("\n");
}

function technicalSpecification(
  state: LegacyV1State,
  profile: LegacyStyleProfile,
  lang: LegacyOutputLanguage,
): string {
  const frame = resolveFrameSize(state);
  const layout = resolveLayout(state);
  const canvasWidth = frame * layout.columns;
  const canvasHeight = frame * layout.rows;
  const directionCount = OUTPUT_MODE_DIRECTIONS[state.outputMode] ?? 1;
  const isCharacter = CHARACTER_ASSET_TYPES.has(state.assetType);

  const values = {
    tile: Number(state.tileSize) || 32,
    height: Number(state.characterHeight) || 80,
    widthTiles: Number(state.footprintWidthTiles) || 1,
    depthTiles: Number(state.footprintDepthTiles) || 1,
    padding: Number(state.alphaPadding) || 0,
  };

  if (lang === "de") {
    const lines = [
      `PROFIL: ${LEGACY_PROFILE_LABELS[profile].de}`,
      `ASSET-TYP: ${safeLabel(ASSET_LABELS, state.assetType, lang)}`,
      `AUSGABE: ${safeLabel(OUTPUT_LABELS, state.outputMode, lang)}`,
      `PIXELSPRACHE: ${pixelDirection(state.pixelDensity, lang)}`,
      `KAMERA: ${cameraDirection(state, lang)}`,
      `TILE-RASTER: ${values.tile} × ${values.tile} px`,
      `WELT-STANDFLÄCHE: ${values.widthTiles} × ${values.depthTiles} Tiles`,
      `FRAME: ${frame} × ${frame} px`,
      `SHEET: ${layout.columns} × ${layout.rows} Frames; Gesamtgröße ${canvasWidth} × ${canvasHeight} px`,
      `RICHTUNGEN: ${directionCount === 8 ? "S, SW, W, NW, N, NE, E, SE" : directionCount === 4 ? "S, W, N, E" : safeLabel(FACING_LABELS, state.assetFacing, lang)}`,
      isCharacter
        ? `FIGURENHÖHE: Ziel ${values.height} px; maximal 1 px Abweichung zwischen Richtungen; hohe Accessoires gesondert berücksichtigen`
        : `SKALENREFERENZ: Standardfigur ${values.height} px hoch`,
      `ANKER: ${safeLabel(ANCHOR_LABELS, state.anchorMode, lang)}; identische Koordinate in jedem Frame`,
      `HINTERGRUND: ${state.backgroundMode === "transparent" ? `echtes Alpha mit mindestens ${values.padding} px transparentem Rand` : "szenischer Hintergrund"}`,
      `SCHATTEN: ${shadowDirection(state, lang)}`,
      `FARBE: ${paletteDirection(profile, state.paletteMode, lang)}; ${colorBudgetDirection(state.colorBudget, lang)}`,
      `KONTUREN: ${outlineDirection(state.outlineStyle, lang)}`,
      `LICHT: ${resolveLighting(state, profile, lang)}`,
      `SKALIERUNG: ${state.nativeResolution ? "nativ in Zielauflösung" : "Skalierung erlaubt"}; ${state.nearestNeighbor ? "nur Nearest Neighbor" : "Skalierungsfilter nicht festgelegt"}`,
      `KANTEN: ${state.pixelPerfectEdges ? "keine Kantenglättung und keine halbtransparenten Randpixel" : "Kantenglättung nicht ausdrücklich gesperrt"}`,
      `KONSISTENZ: Kamera, Maßstab, Baseline, Lichtseite, Proportionen, Palette und Materiallogik bleiben für die gesamte Asset-Bibliothek fest.`,
    ];
    return lines.map((line) => `- ${line}`).join("\n");
  }

  const lines = [
    `PROFILE: ${LEGACY_PROFILE_LABELS[profile].en}`,
    `ASSET TYPE: ${safeLabel(ASSET_LABELS, state.assetType, lang)}`,
    `OUTPUT: ${safeLabel(OUTPUT_LABELS, state.outputMode, lang)}`,
    `PIXEL LANGUAGE: ${pixelDirection(state.pixelDensity, lang)}`,
    `CAMERA: ${cameraDirection(state, lang)}`,
    `TILE GRID: ${values.tile} × ${values.tile}px`,
    `WORLD FOOTPRINT: ${values.widthTiles} × ${values.depthTiles} tiles`,
    `FRAME: ${frame} × ${frame}px`,
    `SHEET: ${layout.columns} × ${layout.rows} frames; total size ${canvasWidth} × ${canvasHeight}px`,
    `DIRECTIONS: ${directionCount === 8 ? "S, SW, W, NW, N, NE, E, SE" : directionCount === 4 ? "S, W, N, E" : safeLabel(FACING_LABELS, state.assetFacing, lang)}`,
    isCharacter
      ? `CHARACTER HEIGHT: target ${values.height}px; maximum 1px variance between directions; account for tall accessories separately`
      : `SCALE REFERENCE: standard character height ${values.height}px`,
    `ANCHOR: ${safeLabel(ANCHOR_LABELS, state.anchorMode, lang)}; identical coordinate in every frame`,
    `BACKGROUND: ${state.backgroundMode === "transparent" ? `true alpha with at least ${values.padding}px transparent padding` : "scene background"}`,
    `SHADOW: ${shadowDirection(state, lang)}`,
    `COLOR: ${paletteDirection(profile, state.paletteMode, lang)}; ${colorBudgetDirection(state.colorBudget, lang)}`,
    `OUTLINES: ${outlineDirection(state.outlineStyle, lang)}`,
    `LIGHT: ${resolveLighting(state, profile, lang)}`,
    `SCALING: ${state.nativeResolution ? "native target resolution" : "scaling allowed"}; ${state.nearestNeighbor ? "nearest-neighbor only" : "scaling filter not fixed"}`,
    `EDGES: ${state.pixelPerfectEdges ? "no anti-aliasing and no semi-transparent edge pixels" : "anti-aliasing not explicitly locked"}`,
    `CONSISTENCY: camera, scale, baseline, light side, proportions, palette, and material language remain fixed across the complete asset library.`,
  ];
  return lines.map((line) => `- ${line}`).join("\n");
}

export function buildLegacyV1ProjectOutputs(input: LegacyV1StateInput = {}): LegacyPromptOutput[] {
  const state = mergeState(input);
  const outputs: LegacyPromptOutput[] = [];

  for (const profile of requestedProfiles(state)) {
    for (const language of requestedLanguages(state)) {
      const main = mainPrompt(state, profile, language);
      const negative = negativePrompt(state, profile, language);
      const technical = technicalSpecification(state, profile, language);
      const headings =
        language === "de"
          ? ["HAUPTPROMPT", "NEGATIVPROMPT", "TECHNISCHE SPEZIFIKATION"]
          : ["MAIN PROMPT", "NEGATIVE PROMPT", "TECHNICAL SPECIFICATION"];
      const combined = `${headings[0]}\n${main}\n\n${headings[1]}\n${negative}\n\n${headings[2]}\n${technical}`;

      outputs.push({
        id: `${profile}-${language}`,
        profile,
        profileLabel: LEGACY_PROFILE_LABELS[profile][language],
        language,
        languageLabel: LEGACY_LANGUAGE_LABELS[language],
        main,
        negative,
        technical,
        combined,
      });
    }
  }

  return outputs;
}
