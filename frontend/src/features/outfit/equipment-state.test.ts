import { describe, expect, it } from "vitest";

import type { OutfitAssetOption } from "../../api/outfit-client";
import type { Direction, EquipmentPart } from "../../domain";
import {
  createEquipmentFromInventory,
  equipmentParts,
  equipmentStateLabel,
  setEquipmentMotionKey,
  setEquipmentTrackEnabled,
  updateEquipmentPart,
} from "./equipment-state";

const directionOrder: Direction[] = ["n", "ne", "e", "se", "s", "sw", "w", "nw"];

function option(slot: string, direction: Direction, index: number): OutfitAssetOption {
  return {
    asset: {
      asset_id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      revision: 1,
      slot_id: slot,
    },
    name: `${slot} ${direction}`,
    asset_kind: "armour",
    direction,
    variant: "base",
    assignable: true,
    sprite_mirroring_allowed: false,
    pivot_px: [1, 2],
    image_size_px: [4, 4],
    source_file: `.area/assets/${slot}-${direction}/source.png`,
  };
}

describe("equipment editor state", () => {
  it("builds stable multi-part equipment with exact directional images", () => {
    let nextId = 0;
    const options = [
      ...directionOrder.map((direction, index) => option("torso_upper", direction, index + 1)),
      ...directionOrder.map((direction, index) => option("torso_lower", direction, index + 20)),
    ];
    const equipment = createEquipmentFromInventory(
      "Segmented cuirass",
      options,
      () => `10000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
    );
    const parts = equipmentParts(equipment);
    expect(parts).toHaveLength(2);
    expect(parts.map((part) => part.anchor_slot)).toEqual(["torso_lower", "torso_upper"]);
    expect(parts.every((part) => part.fit_by_direction.length === 8)).toBe(true);
    expect(parts[0].id).not.toBe(parts[1].id);
    expect(parts[0].fit_by_direction.map((fit) => fit.direction)).toEqual(directionOrder);
    const changed = updateEquipmentPart([equipment], equipment.id, parts[1].id, (part) => ({
      ...part,
      follow_mode: "root",
      own_motion_enabled: true,
    }));
    expect(changed[0].follow_mode).toBe("slot");
    expect(changed[0].additional_parts[0].follow_mode).toBe("root");
    expect(changed[0].additional_parts[0]).not.toHaveProperty("primary");
  });

  it("retains own-motion keys while visibility and motion activation change independently", () => {
    const equipment = createEquipmentFromInventory(
      "Charm",
      [option("hand_l", "s", 90)],
      () => "10000000-0000-4000-8000-000000000090",
    );
    let values = [equipment];
    values = updateEquipmentPart(values, equipment.id, equipment.id, (part) => ({
      ...setEquipmentMotionKey(setEquipmentTrackEnabled(part, "s", 1, true), "s", 1, {
        offset_px: [3, 1],
        rotation_deg: 12,
      }),
      own_motion_enabled: true,
    }));
    values = updateEquipmentPart(values, equipment.id, equipment.id, (part) => ({
      ...part,
      enabled: false,
      own_motion_enabled: false,
      follow_mode: "root",
    }));
    const part = equipmentParts(values[0])[0] as EquipmentPart;
    expect(equipmentStateLabel(part)).toBe("Hidden · values retained");
    expect(part.follow_mode).toBe("root");
    expect(part.own_motion_tracks[0].keys[0].transform).toEqual({
      offset_px: [3, 1],
      rotation_deg: 12,
    });
  });

  it("rejects ambiguous same-slot direction images instead of guessing", () => {
    expect(() =>
      createEquipmentFromInventory("Cape", [
        option("torso_upper", "s", 1),
        option("torso_upper", "s", 2),
      ]),
    ).toThrow(/only one torso_upper image for S variant base/);
  });

  it("keeps named sprite variants additive and rejects nonassignable images", () => {
    const base = option("head", "s", 101);
    const open = { ...option("head", "s", 102), variant: "open" };
    const equipment = createEquipmentFromInventory(
      "Visor",
      [base, open],
      () => "10000000-0000-4000-8000-000000000101",
    );
    expect(equipment.fit_by_direction[0].asset).toEqual(base.asset);
    expect(equipment.fit_by_direction[0].variant_fittings).toEqual([
      { variant: "open", asset: open.asset, pivot_px: open.pivot_px },
    ]);
    expect(() =>
      createEquipmentFromInventory("Archived", [{ ...base, assignable: false }]),
    ).toThrow(/cannot be newly assigned/);
  });
});
