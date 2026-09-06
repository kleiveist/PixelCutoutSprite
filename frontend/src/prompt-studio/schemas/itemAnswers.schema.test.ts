import { describe, expect, it } from "vitest";
import { resolveCapabilities } from "../domain/assets";
import { AssetCategoryDataSchema, CategoryProfileSchema, ItemAnswersSchema } from "./index";

const completeAnswers = {
  itemClass: "armor",
  purpose: "wearable",
  presentation: "equipped",
  wearPosition: "body",
  iconSize: 48,
  size: "medium",
  subjectDescription: "A compact engraved shoulder guard.",
  primaryMaterial: "metal",
  secondaryMaterial: "leather",
  materialDetails: "Hammered steel plates over dark leather straps.",
  condition: "worn",
  functionDetails: "Protects the shoulder while leaving the arm mobile.",
  significance: "ceremonial",
  meaningDetails: "A small crest identifies the city watch.",
  silhouette: "One raised plate and two visible fastening straps.",
  readability: "silhouetteFirst",
  glowMode: "none",
  shadowMode: "contact",
  variantCount: 3,
  extraDetails: "Keep the crest legible at inventory scale.",
} as const;

describe("ItemAnswersSchema", () => {
  it("parses a complete equipment answer set as readonly canonical data", () => {
    const answers = ItemAnswersSchema.parse(completeAnswers);
    const data = AssetCategoryDataSchema.parse({
      category: "item",
      subtype: "armorPiece",
      answers: completeAnswers,
    });

    expect(data.answers).toEqual(answers);
    expect(answers).toEqual(completeAnswers);
    expect(Object.isFrozen(answers)).toBe(true);
  });

  it("keeps the previous Schema-V2 Item contract readable without defaults", () => {
    const legacyAnswers = {
      purpose: "usable",
      presentation: "icon",
      iconSize: 32,
      subjectDescription: "A red healing potion.",
      extraDetails: "Single centered object.",
    } as const;

    expect(ItemAnswersSchema.parse(legacyAnswers)).toEqual(legacyAnswers);
    expect(ItemAnswersSchema.parse({})).toEqual({});
    expect(ItemAnswersSchema.parse(legacyAnswers)).not.toHaveProperty("itemClass");
  });

  it("keeps an explicitly stored Item class consistent with its subtype", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "item",
        subtype: "armorPiece",
        answers: { itemClass: "armor" },
      }).success,
    ).toBe(true);

    const mismatch = AssetCategoryDataSchema.safeParse({
      category: "item",
      subtype: "armorPiece",
      answers: { itemClass: "weapon" },
    });
    expect(mismatch.success).toBe(false);
    if (mismatch.success) throw new Error("Contradicting Item classes must fail.");
    expect(mismatch.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["answers", "itemClass"],
      }),
    );

    expect(
      CategoryProfileSchema.safeParse({
        schemaVersion: 2,
        kind: "categoryProfile",
        id: "category_item_armor",
        name: "Armor defaults",
        baseProfileId: "base_item_world",
        category: "item",
        subtype: "armorPiece",
        iconId: "item-armor",
        capabilities: resolveCapabilities("item", "armorPiece"),
        overrides: {},
        defaults: { itemClass: "weapon" },
        tags: [],
        createdAt: "2026-09-03T10:00:00.000Z",
        updatedAt: "2026-09-03T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("binds equipped fields to wearable subtypes and admits no directions", () => {
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "item",
        subtype: "clothing",
        answers: { purpose: "wearable", presentation: "equipped", wearPosition: "body" },
      }).success,
    ).toBe(true);
    expect(
      AssetCategoryDataSchema.safeParse({
        category: "item",
        subtype: "questItem",
        answers: { wearPosition: "body" },
      }).success,
    ).toBe(false);
    expect(ItemAnswersSchema.safeParse({ directionCount: 8 }).success).toBe(false);
  });

  it("validates numeric bounds and rejects duplicated technical fields", () => {
    expect(ItemAnswersSchema.safeParse({ iconSize: 7 }).success).toBe(false);
    expect(ItemAnswersSchema.safeParse({ iconSize: 513 }).success).toBe(false);
    expect(ItemAnswersSchema.safeParse({ variantCount: 0 }).success).toBe(false);
    expect(ItemAnswersSchema.safeParse({ variantCount: 13 }).success).toBe(false);
    expect(
      ItemAnswersSchema.safeParse({
        tileSize: 32,
        backgroundMode: "transparent",
        pixelDensity: "modernHd",
      }).success,
    ).toBe(false);
  });
});
