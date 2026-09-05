import { describe, expect, it } from "vitest";

import type { OutfitDraft, OutfitFitting, ProfileRevision } from "../../domain";
import {
  approveAssetFallback,
  createOutfitHistory,
  fittingFor,
  missingRequiredSlots,
  outfitHistoryReducer,
  removeFallbacksUsingSource,
  replaceFitting,
  replaceLocalOverride,
} from "./outfit-state";

const fitting: OutfitFitting = {
  slot_id: "hand_l",
  direction: "s",
  asset: {
    asset_id: "55555555-5555-4555-8555-555555555555",
    revision: 1,
    slot_id: "hand_l",
  },
  pivot_px: [2, 1],
  variant_fittings: [],
  transform: { offset_px: [0, 0], rotation_deg: 0 },
  visible: true,
  layer_delta: 0,
};

function draft(): OutfitDraft {
  return {
    schema_version: 1,
    kind: "outfit_draft",
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    revision: 4,
    area_id: "22222222-2222-4222-8222-222222222222",
    template_ref: { id: "44444444-4444-4444-8444-444444444444", revision: 1 },
    profile_ref: { id: "33333333-3333-4333-8333-333333333333", revision: 1 },
    character_id: null,
    appearance_id: null,
    base_character_revision: null,
    base_character_sha256: null,
    base_appearance_revision: null,
    base_appearance_sha256: null,
    base_binding_ref: null,
    base_binding_sha256: null,
    status: "in_progress",
    selected_assets: [],
    asset_fallback_approvals: [],
    fittings: [],
    local_overrides: [],
    equipment: [],
    created_at: "2026-09-05T09:00:00Z",
    updated_at: "2026-09-05T09:00:00Z",
  };
}

describe("outfit editor history", () => {
  it("keeps fitting commands undoable and preserves history across successful saves", () => {
    let state = createOutfitHistory(draft());
    const edits = replaceFitting(state.present, fitting);
    state = outfitHistoryReducer(state, { type: "edit", edits });
    expect(state.saveState).toBe("dirty");
    expect(state.present.fittings).toHaveLength(1);

    state = outfitHistoryReducer(state, { type: "save_started" });
    const savingSequence = state.savingSequence!;
    state = outfitHistoryReducer(state, {
      type: "save_succeeded",
      revision: 5,
      savingSequence,
    });
    expect(state.saveState).toBe("saved");
    expect(state.past).toHaveLength(1);

    state = outfitHistoryReducer(state, { type: "undo" });
    expect(state.present.fittings).toHaveLength(0);
    expect(state.saveState).toBe("dirty");
    state = outfitHistoryReducer(state, { type: "redo" });
    expect(state.present.fittings).toEqual([fitting]);
  });

  it("does not mark newer in-memory edits saved when an older autosave completes", () => {
    let state = createOutfitHistory(draft());
    state = outfitHistoryReducer(state, {
      type: "edit",
      edits: replaceFitting(state.present, fitting),
    });
    state = outfitHistoryReducer(state, { type: "save_started" });
    const savingSequence = state.savingSequence!;
    state = outfitHistoryReducer(state, {
      type: "edit",
      edits: replaceLocalOverride(state.present, "hand_l", "s", {
        offset_px: [3, 2],
        rotation_deg: 4,
      }),
    });
    state = outfitHistoryReducer(state, {
      type: "save_succeeded",
      revision: 5,
      savingSequence,
    });
    expect(state.persistedRevision).toBe(5);
    expect(state.saveState).toBe("dirty");
    expect(state.present.local_overrides[0].transform.offset_px).toEqual([3, 2]);
  });

  it("retains current edits and exposes a retryable failure or conflict", () => {
    let state = createOutfitHistory(draft());
    state = outfitHistoryReducer(state, {
      type: "edit",
      edits: replaceFitting(state.present, fitting),
    });
    state = outfitHistoryReducer(state, { type: "save_started" });
    state = outfitHistoryReducer(state, {
      type: "save_failed",
      message: "document changed since it was loaded",
      conflict: true,
    });
    expect(state.saveState).toBe("conflict");
    expect(state.present.fittings).toEqual([fitting]);
    expect(state.savingSequence).toBeNull();
  });
});

describe("outfit completeness", () => {
  it("reports every missing required direction but ignores optional slots", () => {
    const profile = {
      slots: [
        { id: "hand_l", optional: false },
        { id: "hair", optional: true },
      ],
    } as ProfileRevision;
    const missing = missingRequiredSlots(profile, {
      fittings: [fitting],
      asset_fallback_approvals: [],
      local_overrides: [],
      equipment: [],
    });
    expect(missing).toEqual([
      {
        slot_id: "hand_l",
        missing_directions: ["n", "ne", "e", "se", "sw", "w", "nw"],
        missing_variants: [],
      },
    ]);
  });
});

describe("sprite-variant mirror approvals", () => {
  it("keeps target geometry while materializing and revoking a source variant", () => {
    const source: OutfitFitting = {
      ...fitting,
      direction: "e",
      asset: {
        asset_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        revision: 1,
        slot_id: "hand_l",
      },
      pivot_px: [2, 1],
    };
    const target: OutfitFitting = {
      ...fitting,
      direction: "w",
      asset: {
        asset_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        revision: 1,
        slot_id: "hand_l",
      },
      transform: { offset_px: [7, 3], rotation_deg: 5 },
    };
    const approved = approveAssetFallback(
      {
        fittings: [source, target],
        asset_fallback_approvals: [],
        local_overrides: [],
        equipment: [],
      },
      {
        slot_id: "hand_l",
        target_direction: "w",
        source_direction: "e",
        variant: "open",
      },
      6,
    );
    const materialized = fittingFor(approved, "hand_l", "w")!;
    expect(materialized.asset).toEqual(target.asset);
    expect(materialized.transform).toEqual(target.transform);
    expect(materialized.variant_fittings).toEqual([
      { variant: "open", asset: source.asset, pivot_px: [4, 1] },
    ]);

    const revoked = removeFallbacksUsingSource(approved, "hand_l", "e", "open");
    expect(revoked.asset_fallback_approvals).toEqual([]);
    expect(fittingFor(revoked, "hand_l", "w")).toEqual(target);
  });
});
