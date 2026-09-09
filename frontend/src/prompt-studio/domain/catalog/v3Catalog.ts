import {
  ASSET_CATEGORY_IDS,
  ASSET_SUBTYPES,
  type AssetCategory,
  type AssetSelection,
  type AssetSubtypeByCategory,
} from "../assets";

export const V3_CATALOG_VERSION = "v3.0" as const;

export const CATEGORY_FOLDERS = Object.freeze({
  character: "Charakter",
  movingObject: "Bewegliches-Objekt",
  staticObject: "Statisches-Objekt",
  texture: "Textur",
  nature: "Natur",
  building: "Gebaeude",
  tileset: "Tileset",
  item: "Item",
  artwork: "Artwork",
} satisfies Record<AssetCategory, string>);

const REQUIRED_SUBTYPE_FOLDERS = Object.freeze({
  npc: "NPC",
  hero: "Held",
  boss: "Boss",
  cart: "Wagen",
  boat: "Boot",
  mechanicalConstruct: "Mechanik",
  crate: "Kiste",
  well: "Brunnen",
  altar: "Altar",
  wood: "Holz",
  stone: "Stein",
  snow: "Schnee",
  tree: "Baum",
  mushroom: "Pilz",
  root: "Wurzel",
  house: "Haus",
  tower: "Turm",
  temple: "Tempel",
  groundTile: "Boden",
  wallTile: "Wand",
  autotile: "Autotile",
  sword: "Schwert",
  potion: "Trank",
  tool: "Werkzeug",
  concept: "Konzept",
  scene: "Szene",
  promoArtwork: "Promo",
} satisfies Record<string, string>);

export const REQUIRED_V3_SUBTYPES = Object.freeze({
  character: ["npc", "hero", "boss"],
  movingObject: ["cart", "boat", "mechanicalConstruct"],
  staticObject: ["crate", "well", "altar"],
  texture: ["wood", "stone", "snow"],
  nature: ["tree", "mushroom", "root"],
  building: ["house", "tower", "temple"],
  tileset: ["groundTile", "wallTile", "autotile"],
  item: ["sword", "potion", "tool"],
  artwork: ["concept", "scene", "promoArtwork"],
} as const satisfies {
  readonly [Category in AssetCategory]: readonly AssetSubtypeByCategory[Category][];
});

/**
 * Narrows the intentionally loose subtype field at the persisted V3 boundary.
 * Keeping this check in one place prevents callers from manufacturing an
 * impossible category/subtype pair with a type assertion.
 */
export function parseAssetSelection(category: AssetCategory, subtype: string): AssetSelection {
  const fail = (): never => {
    throw new Error(`Subtype ${subtype} does not belong to ${category}.`);
  };
  switch (category) {
    case "character":
      if (!(ASSET_SUBTYPES.character as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["character"] };
    case "movingObject":
      if (!(ASSET_SUBTYPES.movingObject as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["movingObject"] };
    case "staticObject":
      if (!(ASSET_SUBTYPES.staticObject as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["staticObject"] };
    case "texture":
      if (!(ASSET_SUBTYPES.texture as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["texture"] };
    case "nature":
      if (!(ASSET_SUBTYPES.nature as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["nature"] };
    case "building":
      if (!(ASSET_SUBTYPES.building as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["building"] };
    case "tileset":
      if (!(ASSET_SUBTYPES.tileset as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["tileset"] };
    case "item":
      if (!(ASSET_SUBTYPES.item as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["item"] };
    case "artwork":
      if (!(ASSET_SUBTYPES.artwork as readonly string[]).includes(subtype)) return fail();
      return { category, subtype: subtype as AssetSubtypeByCategory["artwork"] };
  }
}

export function subtypeFolder(category: AssetCategory, subtype: string): string {
  if (!(ASSET_SUBTYPES[category] as readonly string[]).includes(subtype)) {
    throw new Error(`Subtype ${String(subtype)} does not belong to ${category}.`);
  }
  return REQUIRED_SUBTYPE_FOLDERS[subtype as keyof typeof REQUIRED_SUBTYPE_FOLDERS] ?? subtype;
}

export function validateProfileFolderName(value: string): string {
  const normalized = value.normalize("NFC").trim();
  const stem = normalized.split(".")[0]?.toLocaleUpperCase("en-US") ?? "";
  const reserved = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem);
  if (
    normalized.length === 0 ||
    normalized.length > 120 ||
    /[<>:"/\\|?*\0]/.test(normalized) ||
    normalized.endsWith(".") ||
    normalized.endsWith(" ") ||
    reserved
  ) {
    throw new Error("Der Profilname ist als portabler Ordnername nicht zulässig.");
  }
  return normalized;
}

export function reserveProfileFolderName(
  requestedName: string,
  profileId: string,
  occupiedNames: readonly string[],
): string {
  const requested = validateProfileFolderName(requestedName);
  const occupied = new Set(
    occupiedNames.map((name) => name.normalize("NFC").toLocaleLowerCase("en-US")),
  );
  if (!occupied.has(requested.toLocaleLowerCase("en-US"))) return requested;
  const suffix = profileId.replace(/[^a-z0-9]/g, "").slice(0, 8) || "profile";
  const available = `${requested.slice(0, Math.max(1, 118 - suffix.length))}--${suffix}`;
  if (occupied.has(available.toLocaleLowerCase("en-US"))) {
    throw new Error("Der Profilname kollidiert auch mit seinem stabilen ID-Suffix.");
  }
  return available;
}

export function profileDirectory(
  category: AssetCategory,
  subtype: string,
  folderName: string,
): string {
  return [
    ".PixelPrompt",
    CATEGORY_FOLDERS[category],
    subtypeFolder(category, subtype),
    validateProfileFolderName(folderName),
  ].join("/");
}

export function profileDocumentPath(
  category: AssetCategory,
  subtype: string,
  folderName: string,
): string {
  const directory = profileDirectory(category, subtype, folderName);
  return `${directory}/${validateProfileFolderName(folderName)}-profile.json`;
}

export const V3_TYPE_CATALOG = Object.freeze(
  ASSET_CATEGORY_IDS.map((category) => ({
    id: category,
    folder: CATEGORY_FOLDERS[category],
    subtypes: ASSET_SUBTYPES[category],
    requiredSubtypes: REQUIRED_V3_SUBTYPES[category],
  })),
);
