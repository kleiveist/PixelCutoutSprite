import { describe, expect, it } from "vitest";

import {
  DEFAULT_EXPORT_PROFILE,
  estimateExport,
  parseExportProfile,
  resolveExportGeometry,
  serializeExportProfile,
  toProfileSnapshot,
  validateExportProfile,
} from "./export-model";

describe("export profiles", () => {
  it("roundtrips every stored field and maps exact native limits", () => {
    const profile = {
      ...DEFAULT_EXPORT_PROFILE,
      directions: [...DEFAULT_EXPORT_PROFILE.directions],
      paddingPx: 2,
      extrudeEdges: true,
      individualFrames: true,
      clippingPolicy: "warn" as const,
      rootMotionMode: "external" as const,
      jumpMode: "baked" as const,
    };
    expect(parseExportProfile(serializeExportProfile(profile))).toEqual(profile);
    expect(toProfileSnapshot(profile)).toEqual({
      name: "Portable PNG + JSON",
      directions: ["n", "ne", "e", "se", "s", "sw", "w", "nw"],
      max_page_size_px: [2048, 2048],
      max_pages: 64,
      memory_budget_bytes: 268435456,
      padding_px: 2,
      extrude_edges: true,
      individual_frames: true,
      include_shadow: true,
      normalize_geometry: false,
      clipping_policy: "warn",
      allow_incomplete_test: false,
    });
  });

  it("rejects missing, unknown, mistyped, and semantically invalid stored fields", () => {
    const valid = JSON.parse(serializeExportProfile(DEFAULT_EXPORT_PROFILE)) as {
      profile: Record<string, unknown>;
    };
    const cases = [
      { ...valid, extra: true },
      { ...valid, profile: { ...valid.profile, extra: true } },
      { ...valid, profile: { ...valid.profile, includeShadow: "yes" } },
      { ...valid, profile: { ...valid.profile, clippingPolicy: "crop" } },
      { ...valid, profile: { ...valid.profile, rootMotionMode: "automatic" } },
      { ...valid, profile: { ...valid.profile, name: "Bad\u0000name" } },
      { ...valid, profile: { ...valid.profile, directions: ["n", "n"] } },
      {
        ...valid,
        profile: Object.fromEntries(
          Object.entries(valid.profile).filter(([field]) => field !== "jumpMode"),
        ),
      },
    ];
    for (const candidate of cases)
      expect(() => parseExportProfile(JSON.stringify(candidate))).toThrow();
  });

  it("normalizes differing frame sizes around one shared ground origin without scaling", () => {
    const geometry = resolveExportGeometry(
      [
        { frameSizePx: [10, 10], groundOriginPx: [5, 8] },
        { frameSizePx: [8, 12], groundOriginPx: [3, 10] },
      ],
      true,
    );
    expect(geometry).toEqual({
      frameSizePx: [10, 12],
      groundOriginPx: [5, 10],
      normalized: true,
      mismatched: true,
    });
  });

  it("matches tight native atlas pages instead of charging every page at its maximum", () => {
    const sparse = {
      ...DEFAULT_EXPORT_PROFILE,
      maxPageSizePx: 4096 as const,
      memoryBudgetMiB: 64,
    };
    const estimate = estimateExport(sparse, { frameSizePx: [1, 1], framesPerDirection: 1 });
    expect(estimate).toMatchObject({
      renderedFrames: 8,
      atlasPages: 1,
      decodedBytes: 64,
      fits: true,
    });

    expect(
      validateExportProfile(
        { ...DEFAULT_EXPORT_PROFILE, extrudeEdges: true, paddingPx: 0 },
        [128, 128],
      ),
    ).toContain("Edge extrusion requires positive padding.");
  });
});
