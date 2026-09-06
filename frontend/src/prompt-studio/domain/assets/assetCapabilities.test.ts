import { describe, expect, it } from "vitest";
import {
  ASSET_CAPABILITY_IDS,
  ASSET_CATEGORY_CATALOG,
  ASSET_CATEGORY_IDS,
  getAllowedDirectionCounts,
  requiresCharacterScale,
  resolveCapabilities,
  supportsAnimation,
  supportsDirections,
  type AssetSelection,
} from "./index";

describe("Asset-Capability-System", () => {
  it("ordnet einem NPC Bewegung, Richtungen, Animation und Figurenmaßstab zu", () => {
    const selection: AssetSelection = { category: "character", subtype: "npc" };
    const capabilities = resolveCapabilities(selection.category, selection.subtype);

    expect(capabilities).toMatchObject({
      movable: true,
      directional: true,
      animated: true,
      scaledCharacter: true,
      transparent: true,
    });
    expect(getAllowedDirectionCounts(selection.category, selection.subtype)).toEqual([4, 8]);
    expect(requiresCharacterScale(selection.category, selection.subtype)).toBe(true);
  });

  it("bietet einem Wagen Richtungen und optionale Animation an", () => {
    expect(supportsDirections("movingObject", "cart")).toBe(true);
    expect(supportsAnimation("movingObject", "cart")).toBe(true);
    expect(resolveCapabilities("movingObject", "cart").footprint).toBe(true);
    expect(getAllowedDirectionCounts("movingObject", "cart")).toEqual([4, 8]);
  });

  it("trennt beim pulsierenden schwebenden Kristall Animation von Richtungen", () => {
    const capabilities = resolveCapabilities("movingObject", "floatingCrystal");

    expect(capabilities.movable).toBe(true);
    expect(capabilities.animated).toBe(true);
    expect(capabilities.directional).toBe(false);
    expect(getAllowedDirectionCounts("movingObject", "floatingCrystal")).toEqual([]);
  });

  it("behandelt eine öffnende Tür als animiert, aber nicht beweglich oder directional", () => {
    const capabilities = resolveCapabilities("staticObject", "door");

    expect(capabilities.movable).toBe(false);
    expect(capabilities.directional).toBe(false);
    expect(capabilities.animated).toBe(true);
    expect(getAllowedDirectionCounts("staticObject", "door")).toEqual([]);
  });

  it("erlaubt einem Baum Windanimation ohne Richtungsset", () => {
    expect(supportsAnimation("nature", "tree")).toBe(true);
    expect(supportsDirections("nature", "tree")).toBe(false);
    expect(requiresCharacterScale("nature", "tree")).toBe(false);
  });

  it("macht Holz kachelbar, aber weder animiert noch directional", () => {
    const capabilities = resolveCapabilities("texture", "wood");

    expect(capabilities.tileable).toBe(true);
    expect(capabilities.animated).toBe(false);
    expect(capabilities.directional).toBe(false);
    expect(getAllowedDirectionCounts("texture", "wood")).toEqual([]);
  });

  it("stellt vollständige unveränderliche Pflichtkataloge bereit", () => {
    expect(ASSET_CATEGORY_IDS).toHaveLength(9);
    expect(ASSET_CAPABILITY_IDS).toHaveLength(11);
    expect(Object.isFrozen(ASSET_CATEGORY_IDS)).toBe(true);
    expect(Object.isFrozen(ASSET_CAPABILITY_IDS)).toBe(true);
    expect(Object.isFrozen(resolveCapabilities("character", "npc"))).toBe(true);

    for (const category of ASSET_CATEGORY_IDS) {
      for (const subtype of ASSET_CATEGORY_CATALOG[category].subtypes) {
        expect(Object.keys(resolveCapabilities(category, subtype))).toEqual(ASSET_CAPABILITY_IDS);
      }
    }
  });
});
