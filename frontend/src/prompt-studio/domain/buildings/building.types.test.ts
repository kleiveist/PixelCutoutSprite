import { describe, expect, it } from "vitest";
import { ASSET_SUBTYPES } from "../assets";
import {
  BUILDING_ANIMATION_TYPE_IDS,
  BUILDING_COLLISION_MODE_IDS,
  BUILDING_CONDITION_IDS,
  BUILDING_DOOR_STATE_IDS,
  BUILDING_DOOR_TYPE_IDS,
  BUILDING_ENVIRONMENT_IDS,
  BUILDING_FACADE_STYLE_IDS,
  BUILDING_LIGHTING_IDS,
  BUILDING_MAPPING_MODE_IDS,
  BUILDING_MATERIAL_IDS,
  BUILDING_OCCUPANCY_IDS,
  BUILDING_PLAN_SHAPE_IDS,
  BUILDING_ROOF_CONDITION_IDS,
  BUILDING_ROOF_MATERIAL_IDS,
  BUILDING_ROOF_PITCH_IDS,
  BUILDING_ROOF_SHAPE_IDS,
  BUILDING_SIZE_IDS,
  BUILDING_TYPE_BY_SUBTYPE,
  BUILDING_TYPE_IDS,
  BUILDING_WINDOW_LIGHTING_IDS,
  BUILDING_WINDOW_SHAPE_IDS,
  getDefaultBuildingType,
} from "./index";

const expectedTypes = {
  house: "residential",
  hut: "residential",
  shop: "commercial",
  workshop: "workshop",
  inn: "hospitality",
  tower: "tower",
  gate: "gate",
  temple: "sacred",
  ruin: "ruin",
  fortification: "fortification",
  dungeonModule: "dungeonModule",
} as const;

describe("building domain catalogs", () => {
  it("maps every building subtype to one deterministic building type", () => {
    expect(Object.keys(BUILDING_TYPE_BY_SUBTYPE)).toEqual(ASSET_SUBTYPES.building);
    expect(BUILDING_TYPE_BY_SUBTYPE).toEqual(expectedTypes);

    for (const subtype of ASSET_SUBTYPES.building) {
      expect(getDefaultBuildingType(subtype)).toBe(expectedTypes[subtype]);
    }
  });

  it("publishes stable readonly catalogs for every architecture question", () => {
    expect(BUILDING_TYPE_IDS).toEqual([
      "residential",
      "commercial",
      "workshop",
      "hospitality",
      "tower",
      "gate",
      "sacred",
      "ruin",
      "fortification",
      "dungeonModule",
    ]);
    expect(BUILDING_SIZE_IDS).toEqual(["compact", "small", "medium", "large", "monumental"]);
    expect(BUILDING_PLAN_SHAPE_IDS).toContain("modular");
    expect(BUILDING_MATERIAL_IDS).toEqual([
      "wood",
      "stone",
      "clay",
      "brick",
      "plaster",
      "metal",
      "timberFrame",
      "mixed",
      "custom",
    ]);
    expect(BUILDING_ROOF_SHAPE_IDS).toContain("collapsed");
    expect(BUILDING_ROOF_PITCH_IDS).toEqual(["low", "medium", "steep", "variable"]);
    expect(BUILDING_ROOF_MATERIAL_IDS).toContain("thatch");
    expect(BUILDING_ROOF_CONDITION_IDS).toContain("overgrown");
    expect(BUILDING_FACADE_STYLE_IDS).toContain("timberFrame");
    expect(BUILDING_DOOR_TYPE_IDS).toContain("portcullis");
    expect(BUILDING_DOOR_STATE_IDS).toEqual(["open", "closed", "ajar", "blocked", "broken"]);
    expect(BUILDING_WINDOW_SHAPE_IDS).toContain("narrowSlit");
    expect(BUILDING_WINDOW_LIGHTING_IDS).toContain("warmLit");
    expect(BUILDING_CONDITION_IDS).toEqual([
      "maintained",
      "used",
      "weathered",
      "damaged",
      "abandoned",
      "overgrown",
    ]);
    expect(BUILDING_OCCUPANCY_IDS).toEqual(["inhabited", "active", "vacant", "abandoned"]);
    expect(BUILDING_ENVIRONMENT_IDS).toContain("village");
    expect(BUILDING_MAPPING_MODE_IDS).toEqual([
      "freestanding",
      "mapIntegrated",
      "tileAligned",
      "modularSet",
    ]);
    expect(BUILDING_COLLISION_MODE_IDS).toContain("walkableInterior");
    expect(BUILDING_LIGHTING_IDS).toContain("warmInterior");
    expect(BUILDING_ANIMATION_TYPE_IDS).toEqual(["openClose", "custom"]);

    const catalogs = [
      BUILDING_TYPE_IDS,
      BUILDING_SIZE_IDS,
      BUILDING_PLAN_SHAPE_IDS,
      BUILDING_MATERIAL_IDS,
      BUILDING_ROOF_SHAPE_IDS,
      BUILDING_ROOF_PITCH_IDS,
      BUILDING_ROOF_MATERIAL_IDS,
      BUILDING_ROOF_CONDITION_IDS,
      BUILDING_FACADE_STYLE_IDS,
      BUILDING_DOOR_TYPE_IDS,
      BUILDING_DOOR_STATE_IDS,
      BUILDING_WINDOW_SHAPE_IDS,
      BUILDING_WINDOW_LIGHTING_IDS,
      BUILDING_CONDITION_IDS,
      BUILDING_OCCUPANCY_IDS,
      BUILDING_ENVIRONMENT_IDS,
      BUILDING_MAPPING_MODE_IDS,
      BUILDING_COLLISION_MODE_IDS,
      BUILDING_LIGHTING_IDS,
      BUILDING_ANIMATION_TYPE_IDS,
      BUILDING_TYPE_BY_SUBTYPE,
    ];
    expect(catalogs.every(Object.isFrozen)).toBe(true);
  });
});
