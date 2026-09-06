import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  NATURE_AGE_IDS,
  NATURE_ANIMATION_TYPE_IDS,
  NATURE_CLIMATE_IDS,
  NATURE_CROWN_DENSITY_IDS,
  NATURE_CROWN_SHAPE_IDS,
  NATURE_GROUNDING_IDS,
  NATURE_MOSS_COVERAGE_IDS,
  NATURE_MUSHROOM_GROWTH_IDS,
  NATURE_PLANT_TYPE_BY_SUBTYPE,
  NATURE_PLANT_TYPE_IDS,
  NATURE_ROOT_VISIBILITY_IDS,
  NATURE_SEASON_IDS,
  NATURE_SILHOUETTE_IDS,
  NATURE_SNOW_COVER_IDS,
  NATURE_TRUNK_SHAPE_IDS,
  NATURE_TRUNK_THICKNESS_IDS,
  NATURE_VINE_GROWTH_IDS,
  getDefaultNaturePlantType,
  natureSubtypeHasCrown,
  natureSubtypeHasRoots,
  natureSubtypeHasTrunk,
  type NatureSubtype,
} from "./index";

const expectedPlantTypes = {
  tree: "tree",
  deciduousTree: "tree",
  conifer: "tree",
  witheredTree: "tree",
  magicTree: "tree",
  bush: "bush",
  grassTuft: "grass",
  mushroom: "mushroom",
  root: "root",
  treeStump: "treeStump",
  vine: "vine",
} as const;

describe("nature domain catalogs", () => {
  it("maps every nature subtype to one deterministic plant type", () => {
    expect(Object.keys(NATURE_PLANT_TYPE_BY_SUBTYPE)).toEqual(ASSET_SUBTYPES.nature);
    expect(NATURE_PLANT_TYPE_BY_SUBTYPE).toEqual(expectedPlantTypes);

    for (const subtype of ASSET_SUBTYPES.nature) {
      expect(getDefaultNaturePlantType(subtype)).toBe(expectedPlantTypes[subtype]);
    }
  });

  it("publishes stable readonly catalogs for every nature question", () => {
    expect(NATURE_PLANT_TYPE_IDS).toEqual([
      "tree",
      "bush",
      "grass",
      "mushroom",
      "root",
      "treeStump",
      "vine",
    ]);
    expect(NATURE_CLIMATE_IDS).toEqual([
      "temperate",
      "mountain",
      "snow",
      "swamp",
      "dry",
      "dark",
      "magical",
    ]);
    expect(NATURE_SEASON_IDS).toEqual(["spring", "summer", "autumn", "winter", "timeless"]);
    expect(NATURE_AGE_IDS).toEqual(["young", "mature", "ancient", "dead"]);
    expect(NATURE_SILHOUETTE_IDS).toEqual([
      "broad",
      "narrow",
      "asymmetric",
      "gnarled",
      "upright",
      "spreading",
      "compact",
    ]);
    expect(NATURE_TRUNK_THICKNESS_IDS).toEqual(["thin", "medium", "thick", "massive"]);
    expect(NATURE_TRUNK_SHAPE_IDS).toEqual([
      "straight",
      "tapered",
      "twisted",
      "gnarled",
      "split",
      "hollow",
    ]);
    expect(NATURE_CROWN_SHAPE_IDS).toEqual([
      "round",
      "tall",
      "tiered",
      "spreading",
      "conical",
      "irregular",
      "damaged",
      "bare",
    ]);
    expect(NATURE_CROWN_DENSITY_IDS).toEqual(["sparse", "loose", "medium", "dense", "bare"]);
    expect(NATURE_ROOT_VISIBILITY_IDS).toEqual([
      "hidden",
      "visible",
      "spreading",
      "rockWrapping",
      "exposed",
    ]);
    expect(NATURE_MOSS_COVERAGE_IDS).toEqual(["none", "light", "moderate", "heavy"]);
    expect(NATURE_MUSHROOM_GROWTH_IDS).toEqual(["none", "few", "clustered", "abundant"]);
    expect(NATURE_SNOW_COVER_IDS).toEqual(["none", "dusting", "partial", "covered", "heavy"]);
    expect(NATURE_VINE_GROWTH_IDS).toEqual(["none", "light", "draped", "entangled"]);
    expect(NATURE_GROUNDING_IDS).toEqual([
      "natural",
      "soilPatch",
      "grassPatch",
      "rocky",
      "snowy",
      "swampy",
      "freestanding",
    ]);
    expect(NATURE_ANIMATION_TYPE_IDS).toEqual(["wind", "magic", "custom"]);

    const catalogs = [
      NATURE_PLANT_TYPE_IDS,
      NATURE_CLIMATE_IDS,
      NATURE_SEASON_IDS,
      NATURE_AGE_IDS,
      NATURE_SILHOUETTE_IDS,
      NATURE_TRUNK_THICKNESS_IDS,
      NATURE_TRUNK_SHAPE_IDS,
      NATURE_CROWN_SHAPE_IDS,
      NATURE_CROWN_DENSITY_IDS,
      NATURE_ROOT_VISIBILITY_IDS,
      NATURE_MOSS_COVERAGE_IDS,
      NATURE_MUSHROOM_GROWTH_IDS,
      NATURE_SNOW_COVER_IDS,
      NATURE_VINE_GROWTH_IDS,
      NATURE_GROUNDING_IDS,
      NATURE_ANIMATION_TYPE_IDS,
      NATURE_PLANT_TYPE_BY_SUBTYPE,
    ];
    expect(catalogs.every(Object.isFrozen)).toBe(true);
  });
});

describe("nature anatomy relevance", () => {
  const anatomyBySubtype: Readonly<
    Record<NatureSubtype, Readonly<{ trunk: boolean; crown: boolean; roots: boolean }>>
  > = {
    tree: { trunk: true, crown: true, roots: true },
    deciduousTree: { trunk: true, crown: true, roots: true },
    conifer: { trunk: true, crown: true, roots: true },
    witheredTree: { trunk: true, crown: true, roots: true },
    magicTree: { trunk: true, crown: true, roots: true },
    bush: { trunk: false, crown: true, roots: true },
    grassTuft: { trunk: false, crown: false, roots: false },
    mushroom: { trunk: false, crown: false, roots: false },
    root: { trunk: false, crown: false, roots: true },
    treeStump: { trunk: true, crown: false, roots: true },
    vine: { trunk: false, crown: false, roots: false },
  };

  it.each(ASSET_SUBTYPES.nature)("reports anatomy support for %s", (subtype) => {
    expect(natureSubtypeHasTrunk(subtype)).toBe(anatomyBySubtype[subtype].trunk);
    expect(natureSubtypeHasCrown(subtype)).toBe(anatomyBySubtype[subtype].crown);
    expect(natureSubtypeHasRoots(subtype)).toBe(anatomyBySubtype[subtype].roots);
  });
});
