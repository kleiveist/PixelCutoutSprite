import { describe, expect, it } from "vitest";
import { resolveCapabilities, type AssetSelection } from "../assets";
import {
  createCompatibilityKey,
  createDefaultBaseProfileValues,
  resolveProfile,
  type ResolvedProfile,
} from "../profiles";
import { parseAssetProfile, parseBaseProfile, type BaseProfileValues } from "../../schemas";
import { buildPromptModules, buildPromptPackages, PROMPT_MODULE_IDS } from "./index";

const TIMESTAMP = "2026-09-03T09:00:00.000Z";

interface ResolvedFixtureInput {
  readonly selection: AssetSelection;
  readonly answers?: unknown;
  readonly name?: string;
  readonly values?: Partial<BaseProfileValues>;
}

function createResolvedFixture(input: ResolvedFixtureInput): ResolvedProfile {
  const defaults = createDefaultBaseProfileValues();
  const values: BaseProfileValues = {
    ...defaults,
    ...input.values,
    lightingDefaults: input.values?.lightingDefaults ?? defaults.lightingDefaults,
  };
  const baseProfile = parseBaseProfile({
    schemaVersion: 2,
    kind: "baseProfile",
    id: "base_prompt_test",
    name: "Prompt engine test base",
    iconId: "world-grid",
    values,
    locks: {},
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const assetProfile = parseAssetProfile({
    schemaVersion: 2,
    kind: "assetProfile",
    id: "asset_prompt_test",
    name: input.name ?? "Prompt engine test asset",
    baseProfileId: baseProfile.id,
    compatibilityKey: createCompatibilityKey(values, input.selection),
    category: input.selection.category,
    subtype: input.selection.subtype,
    iconId: "asset-generic",
    badgeIconIds: [],
    capabilities: resolveCapabilities(input.selection.category, input.selection.subtype),
    overrides: {},
    answers: input.answers ?? {},
    tags: [],
    favorite: false,
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  });
  const result = resolveProfile({ baseProfile, assetProfile });
  if (result.status !== "resolved") {
    throw new Error(`Fixture did not resolve: ${JSON.stringify(result.conflicts)}`);
  }
  return result.profile;
}

function combinedEnglish(profile: ResolvedProfile): string {
  const packageResult = buildPromptPackages(profile, { languages: ["en"] })[0];
  if (packageResult === undefined) throw new Error("Expected an English prompt package.");
  return packageResult.combined;
}

describe("Prompt Engine 2.0", () => {
  it("builds the twelve modules and four deterministic outputs for a directional NPC", () => {
    const profile = createResolvedFixture({
      selection: { category: "character", subtype: "npc" },
      name: "Village blacksmith",
      answers: {
        subjectDescription: "A seasoned village blacksmith",
        role: "blacksmith",
        bodyBuild: "sturdy",
        materials: "leather apron, forged iron tools",
        directionCount: 8,
        animationActions: [
          { action: "walk", frames: 5 },
          { action: "talk", frames: 4 },
        ],
        variantCount: 2,
      },
    });
    const modules = buildPromptModules({
      profile,
      language: "en",
      styleProfile: "classic",
    });
    const packages = buildPromptPackages(profile, { languages: ["en"] });
    const classic = packages[0];
    if (classic === undefined) throw new Error("Expected a classic prompt package.");

    expect(modules.map(({ id }) => id)).toEqual(PROMPT_MODULE_IDS);
    expect(packages.map(({ id, styleProfile, language }) => ({ id, styleProfile, language })))
      .toMatchInlineSnapshot(`
        [
          {
            "id": "asset_prompt_test:classic:en",
            "language": "en",
            "styleProfile": "classic",
          },
          {
            "id": "asset_prompt_test:dark:en",
            "language": "en",
            "styleProfile": "dark",
          },
        ]
      `);
    expect(classic.main).toContain("A seasoned village blacksmith");
    expect(classic.main).toContain("leather apron, forged iron tools");
    expect(classic.main).toContain("8-direction set");
    expect(classic.main).toContain("keep the world light fixed");
    expect(classic.technical).toContain("Character height: 80 px");
    expect(classic.technical).toContain("Directions: 8 (S, SW, W, NW, N, NE, E, SE)");
    expect(classic.technical).toContain("Direction layout: 4 × 2 views");
    expect(classic.technical).toContain("Frame: 128 × 128 px");
    expect(classic.technical).toContain("Direction canvas: 512 × 256 px");
    expect(classic.technical).toContain("walk (5 frames)");
    expect(classic.technical).toContain("Production frame count: 72");
    expect(classic.negative).toContain("changing camera angle");
    expect(classic.combined).toBe(
      `MAIN PROMPT\n${classic.main}\n\nNEGATIVE PROMPT\n${classic.negative}\n\nTECHNICAL SPECIFICATION\n${classic.technical}`,
    );
    expect(Object.isFrozen(modules)).toBe(true);
    expect(Object.isFrozen(packages)).toBe(true);
    expect(Object.isFrozen(classic)).toBe(true);
    expect(buildPromptPackages(profile, { languages: ["en"] })).toEqual(packages);
  });

  it("uses only flat material and tiling rules for a seamless wood texture", () => {
    const profile = createResolvedFixture({
      selection: { category: "texture", subtype: "wood" },
      name: "Weathered oak floor",
      answers: {
        materialType: "wood",
        usage: "floor",
        seamless: true,
        orientation: "grainAligned",
        structure: "coarse",
        condition: "old",
        surface: "planked",
        moisture: "dry",
        lighting: "neutralEven",
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("Material: wood");
    expect(output).toContain("seamlessly tileable");
    expect(output).toContain("Native pixel grid: 32 × 32 px tile unit");
    expect(output).toContain("Surface mapping: flat, edge-aligned material sample");
    expect(output).not.toMatch(/\bDirections?:|direction set|directional view|Camera:/iu);
    expect(output).not.toContain("Character height");
    expect(output).not.toContain("ANIMATION\n");
  });

  it("keeps a winter tree animated without inventing a direction set", () => {
    const profile = createResolvedFixture({
      selection: { category: "nature", subtype: "conifer" },
      name: "Snow-covered old conifer",
      answers: {
        plantType: "tree",
        species: "old mountain conifer",
        climate: "snow",
        season: "winter",
        age: "ancient",
        crownDensity: "dense",
        snowCover: "heavy",
        footprint: { widthTiles: 2, depthTiles: 2 },
        grounding: "snowy",
        animationType: "wind",
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("Climate: snow climate");
    expect(output).toContain("Season: winter");
    expect(output).toContain("Snow cover: heavy");
    expect(output).toContain("wind loop");
    expect(output).toContain("Footprint: 2 × 2 tiles");
    expect(output).not.toMatch(/\bDirections?:|direction set|directional view/iu);
  });

  it("builds architectural scale, material, roof, footprint, and camera facts without directions", () => {
    const profile = createResolvedFixture({
      selection: { category: "building", subtype: "house" },
      name: "Village timber house",
      answers: {
        buildingType: "residential",
        purpose: "family dwelling and bakery",
        planShape: "rectangular",
        size: "medium",
        heightPixels: 192,
        floors: 2,
        primaryMaterial: "timberFrame",
        secondaryMaterial: "plaster",
        roofShape: "gable",
        roofMaterial: "woodShingle",
        facadeStyle: "timberFrame",
        environment: "village",
        occupancy: "inhabited",
        mappingMode: "tileAligned",
        collisionMode: "walkableEntrance",
        footprint: { widthTiles: 3, depthTiles: 2 },
        lighting: "warmInterior",
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("family dwelling and bakery");
    expect(output).toContain("Primary material: timber frame");
    expect(output).toContain("Roof shape: gable");
    expect(output).toContain("Footprint: 3 × 2 tiles");
    expect(output).toContain("Building height: 192 px");
    expect(output).toContain("Camera: south to north, 60° down from horizontal");
    expect(output).not.toMatch(/\bDirections?:|direction set|directional view/iu);
    expect(output).not.toContain("Character height");
  });

  it("keeps movement, directions, animation frames, anchor, and footprint coherent", () => {
    const profile = createResolvedFixture({
      selection: { category: "movingObject", subtype: "cart" },
      name: "Supply cart",
      answers: {
        objectClass: "cart",
        purpose: "carry village supplies",
        movementType: "roll",
        footprint: { widthTiles: 2, depthTiles: 1 },
        anchorMode: "footprintCenter",
        directionCount: 4,
        animationSequences: [
          { type: "idle", frames: 2 },
          { type: "move", frames: 6 },
        ],
        mechanism: "wheels",
        material: "wood",
        condition: "used",
        shadowMode: "motionAdjusted",
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("Movement: rolling");
    expect(output).toContain("Mechanism: wheels");
    expect(output).toContain("4-direction set");
    expect(output).toContain("Directions: 4 (S, W, N, E)");
    expect(output).toContain("Direction layout: 4 × 1 views");
    expect(output).toContain("Direction canvas: 512 × 128 px");
    expect(output).toContain("Production frame count: 32");
    expect(output).toContain("movement (6 frames)");
    expect(output).toContain("Anchor: footprint center");
    expect(output).toContain("Footprint: 2 × 1 tiles");
  });

  it("keeps artwork free from tile, camera, character-scale, animation, and direction rules", () => {
    const profile = createResolvedFixture({
      selection: { category: "artwork", subtype: "promoArtwork" },
      name: "Winter market key art",
      answers: {
        purpose: "presentation",
        motif: "scene",
        sceneDescription: "A busy winter market at dusk",
        composition: "group",
        compositionDetails: "market stalls frame the central gathering",
        format: "landscape",
        background: "complete",
        backgroundDetails: "snowy rooftops and distant lanterns",
        focus: "story",
        lightingDrama: "warm",
        lightingDetails: "warm lantern pools against cool dusk",
        detailLevel: "showcase",
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("A busy winter market at dusk");
    expect(output).toContain("Format: landscape");
    expect(output).toContain("Background: fully developed");
    expect(output).toContain("Free artwork composition on an unconstrained canvas");
    expect(output).not.toMatch(
      /\btiles?\b|sprite|\bcamera\b|character height|\bDirections?:|direction set|directional view/iu,
    );
    expect(output).not.toContain("ANIMATION\n");
  });

  it("emits all nine categories and ignores out-of-category data even at a typed trust boundary", () => {
    const selections: readonly AssetSelection[] = [
      { category: "character", subtype: "npc" },
      { category: "movingObject", subtype: "cart" },
      { category: "staticObject", subtype: "barrel" },
      { category: "texture", subtype: "wood" },
      { category: "nature", subtype: "tree" },
      { category: "building", subtype: "house" },
      { category: "tileset", subtype: "groundTile" },
      { category: "item", subtype: "weapon" },
      { category: "artwork", subtype: "scene" },
    ];

    for (const selection of selections) {
      const profile = createResolvedFixture({ selection });
      const packages = buildPromptPackages(profile, { languages: ["en"] });
      expect(packages).toHaveLength(2);
      expect(packages[0]?.main.length).toBeGreaterThan(0);
      expect(packages[0]?.negative.length).toBeGreaterThan(0);
      expect(packages[0]?.technical.length).toBeGreaterThan(0);
    }

    const texture = createResolvedFixture({
      selection: { category: "texture", subtype: "wood" },
      answers: { subjectDescription: "clean material" },
    });
    const contaminated = {
      ...texture,
      categoryData: {
        ...texture.categoryData,
        answers: {
          ...texture.categoryData.answers,
          role: "THIS MUST BE IGNORED",
          directionCount: 8,
        },
      },
    } as unknown as ResolvedProfile;
    expect(combinedEnglish(contaminated)).not.toContain("THIS MUST BE IGNORED");
    expect(combinedEnglish(contaminated)).not.toMatch(
      /\bDirections?:|direction set|directional view/iu,
    );
  });

  it("creates canonical bilingual style packages without duplicates", () => {
    const profile = createResolvedFixture({
      selection: { category: "staticObject", subtype: "barrel" },
    });
    const packages = buildPromptPackages(profile, {
      languages: ["de", "en", "de"],
    });

    expect(packages.map(({ styleProfile, language }) => `${styleProfile}:${language}`)).toEqual([
      "classic:en",
      "classic:de",
      "dark:en",
      "dark:de",
    ]);
    expect(packages[1]?.combined).toContain("HAUPTPROMPT");
    expect(packages[1]?.combined).toContain("NEGATIVPROMPT");
    expect(packages[1]?.combined).toContain("TECHNISCHE SPEZIFIKATION");
  });

  it("reuses the pure Tileset atlas metrics in the technical output", () => {
    const profile = createResolvedFixture({
      selection: { category: "tileset", subtype: "groundTile" },
      answers: {
        tilesetType: "ground",
        atlasLayout: "fixedColumns",
        atlasTileCount: 10,
        atlasColumns: 4,
        atlasGutterPixels: 2,
        atlasMarginPixels: 1,
      },
    });
    const output = combinedEnglish(profile);

    expect(output).toContain("Atlas grid: 4 × 3 cells");
    expect(output).toContain("Atlas canvas: 136 × 102 px");
    expect(output).toContain("Atlas slots: 10 occupied, 2 empty");
    expect(output).toContain("Atlas spacing: 2 px gutter, 1 px margin");
  });
});
