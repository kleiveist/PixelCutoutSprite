import type {
  ClippingPolicy,
  Direction,
  ExportFormat,
  ExportJumpMode,
  ExportProfileSnapshot,
  ExportRootMotionMode,
  PixelPoint,
  PixelSize,
} from "../../domain";
import type { StoredNpcExportProfile } from "../../api/export-client";

export const EXPORT_DIRECTIONS = ["n", "ne", "e", "se", "s", "sw", "w", "nw"] as const;
export const PAGE_SIZES = [512, 1024, 2048, 4096] as const;

const PROFILE_KEYS = [
  "id",
  "name",
  "format",
  "includeGodotScene",
  "directions",
  "maxPageSizePx",
  "maxPages",
  "memoryBudgetMiB",
  "paddingPx",
  "extrudeEdges",
  "individualFrames",
  "includeShadow",
  "normalizeGeometry",
  "clippingPolicy",
  "allowIncompleteTest",
  "rootMotionMode",
  "jumpMode",
] as const;

export interface ExportProfile {
  id: string;
  name: string;
  format: ExportFormat;
  includeGodotScene: boolean;
  directions: Direction[];
  maxPageSizePx: (typeof PAGE_SIZES)[number];
  maxPages: number;
  memoryBudgetMiB: number;
  paddingPx: number;
  extrudeEdges: boolean;
  individualFrames: boolean;
  includeShadow: boolean;
  normalizeGeometry: boolean;
  clippingPolicy: ClippingPolicy;
  allowIncompleteTest: boolean;
  rootMotionMode: ExportRootMotionMode;
  jumpMode: ExportJumpMode;
}

export interface ExportEstimateInput {
  frameSizePx: PixelSize;
  framesPerDirection: number;
}

export interface ExportEstimate {
  renderedFrames: number;
  atlasPages: number;
  decodedBytes: number;
  fits: boolean;
}

export interface ExportGeometry {
  frameSizePx: PixelSize;
  groundOriginPx: PixelPoint;
  normalized: boolean;
  mismatched: boolean;
}

export interface ExportGeometryInput {
  frameSizePx: PixelSize;
  groundOriginPx: PixelPoint;
}

export const DEFAULT_EXPORT_PROFILE: ExportProfile = {
  id: "portable-png-json",
  name: "Portable PNG + JSON",
  format: "png_json",
  includeGodotScene: true,
  directions: [...EXPORT_DIRECTIONS],
  maxPageSizePx: 2048,
  maxPages: 64,
  memoryBudgetMiB: 256,
  paddingPx: 0,
  extrudeEdges: false,
  individualFrames: false,
  includeShadow: true,
  normalizeGeometry: false,
  clippingPolicy: "block",
  allowIncompleteTest: false,
  rootMotionMode: "baked",
  jumpMode: "external",
};

export function cloneExportProfile(profile: ExportProfile): ExportProfile {
  return { ...profile, directions: [...profile.directions] };
}

export function validateExportProfile(profile: ExportProfile, frameSizePx?: PixelSize): string[] {
  const issues: string[] = [];
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(profile.id))
    issues.push("Profile ID must use 1–64 lowercase letters, numbers, or hyphens.");
  if (
    profile.name.trim() !== profile.name ||
    [...profile.name].length < 1 ||
    [...profile.name].length > 120
  )
    issues.push("Profile name must contain 1–120 characters without outer whitespace.");
  if (/\p{Cc}/u.test(profile.name))
    issues.push("Profile name must not contain control characters.");
  if (profile.format !== "png_json" && profile.format !== "godot_package")
    issues.push("Format must be PNG/JSON or a Godot package.");
  const canonical = EXPORT_DIRECTIONS.filter((direction) => profile.directions.includes(direction));
  if (
    profile.directions.length === 0 ||
    canonical.length !== profile.directions.length ||
    canonical.some((direction, index) => direction !== profile.directions[index])
  )
    issues.push("Directions must be unique and use the canonical N through NW order.");
  if (profile.directions.length !== EXPORT_DIRECTIONS.length && !profile.allowIncompleteTest)
    issues.push("A direction subset requires an explicitly marked incomplete test export.");
  if (profile.format === "godot_package" && profile.directions.length !== EXPORT_DIRECTIONS.length)
    issues.push("Godot packages require all eight directions.");
  if (!PAGE_SIZES.includes(profile.maxPageSizePx))
    issues.push("Atlas page size must be one of the supported desktop limits.");
  if (!Number.isInteger(profile.paddingPx) || profile.paddingPx < 0 || profile.paddingPx > 64)
    issues.push("Padding must be an integer from 0 through 64 pixels.");
  if (profile.extrudeEdges && profile.paddingPx === 0)
    issues.push("Edge extrusion requires positive padding.");
  if (
    frameSizePx &&
    (frameSizePx.some((axis) => !Number.isInteger(axis) || axis < 1 || axis > 1024) ||
      frameSizePx.some((axis) => axis + profile.paddingPx * 2 > profile.maxPageSizePx))
  )
    issues.push(
      frameSizePx.some((axis) => !Number.isInteger(axis) || axis < 1 || axis > 1024)
        ? "Frame axes must be within 1–1024 pixels."
        : "The fixed frame plus padding does not fit on the selected atlas page.",
    );
  if (!Number.isInteger(profile.maxPages) || profile.maxPages < 1 || profile.maxPages > 1024)
    issues.push("Maximum pages must be within 1–1024.");
  if (
    !Number.isInteger(profile.memoryBudgetMiB) ||
    profile.memoryBudgetMiB < 1 ||
    profile.memoryBudgetMiB > 4096
  )
    issues.push("Memory budget must be within 1–4096 MiB.");
  if (profile.clippingPolicy !== "block" && profile.clippingPolicy !== "warn")
    issues.push("Clipping policy must block or warn.");
  if (profile.rootMotionMode !== "baked" && profile.rootMotionMode !== "external")
    issues.push("Root motion mode must be baked or external.");
  if (profile.jumpMode !== "baked" && profile.jumpMode !== "external")
    issues.push("Jump mode must be baked or external.");
  for (const [label, value] of [
    ["Edge extrusion", profile.extrudeEdges],
    ["Individual frames", profile.individualFrames],
    ["Shadow", profile.includeShadow],
    ["Geometry normalization", profile.normalizeGeometry],
    ["Incomplete-test", profile.allowIncompleteTest],
    ["Godot scene", profile.includeGodotScene],
  ] as const) {
    if (typeof value !== "boolean") issues.push(`${label} must be a boolean.`);
  }
  return issues;
}

export function resolveExportGeometry(
  inputs: readonly ExportGeometryInput[],
  normalize: boolean,
): ExportGeometry {
  if (inputs.length === 0)
    return { frameSizePx: [1, 1], groundOriginPx: [0, 0], normalized: false, mismatched: false };
  const first = inputs[0];
  const mismatched = inputs.some(
    (input) =>
      input.frameSizePx[0] !== first.frameSizePx[0] ||
      input.frameSizePx[1] !== first.frameSizePx[1] ||
      input.groundOriginPx[0] !== first.groundOriginPx[0] ||
      input.groundOriginPx[1] !== first.groundOriginPx[1],
  );
  if (!mismatched || !normalize)
    return {
      frameSizePx: first.frameSizePx,
      groundOriginPx: first.groundOriginPx,
      normalized: false,
      mismatched,
    };

  const minX = Math.min(...inputs.map((input) => -input.groundOriginPx[0]));
  const minY = Math.min(...inputs.map((input) => -input.groundOriginPx[1]));
  const maxX = Math.max(...inputs.map((input) => input.frameSizePx[0] - input.groundOriginPx[0]));
  const maxY = Math.max(...inputs.map((input) => input.frameSizePx[1] - input.groundOriginPx[1]));
  return {
    frameSizePx: [maxX - minX, maxY - minY],
    groundOriginPx: [-minX, -minY],
    normalized: true,
    mismatched: true,
  };
}

export function estimateExport(profile: ExportProfile, input: ExportEstimateInput): ExportEstimate {
  const renderedFrames = input.framesPerDirection * profile.directions.length;
  const cellWidth = input.frameSizePx[0] + profile.paddingPx * 2;
  const cellHeight = input.frameSizePx[1] + profile.paddingPx * 2;
  const columns = Math.floor(profile.maxPageSizePx / cellWidth);
  const rows = Math.floor(profile.maxPageSizePx / cellHeight);
  const capacity = columns * rows;
  const atlasPages = capacity > 0 ? Math.ceil(renderedFrames / capacity) : Number.POSITIVE_INFINITY;
  let pageBytes = 0;
  let remaining = renderedFrames;
  while (remaining > 0 && capacity > 0) {
    const count = Math.min(remaining, capacity);
    const usedRows = Math.ceil(count / columns);
    const usedColumns = Math.min(count, columns);
    pageBytes += usedColumns * cellWidth * usedRows * cellHeight * 4;
    remaining -= count;
  }
  const frameBytes = input.frameSizePx[0] * input.frameSizePx[1] * 4 * renderedFrames;
  const decodedBytes = capacity > 0 ? frameBytes + pageBytes : Number.POSITIVE_INFINITY;
  return {
    renderedFrames,
    atlasPages,
    decodedBytes,
    fits:
      renderedFrames > 0 &&
      Number.isFinite(decodedBytes) &&
      atlasPages <= profile.maxPages &&
      decodedBytes <= profile.memoryBudgetMiB * 1024 * 1024,
  };
}

export function toProfileSnapshot(profile: ExportProfile): ExportProfileSnapshot {
  return {
    name: profile.name,
    directions: [...profile.directions],
    max_page_size_px: [profile.maxPageSizePx, profile.maxPageSizePx],
    max_pages: profile.maxPages,
    memory_budget_bytes: profile.memoryBudgetMiB * 1024 * 1024,
    padding_px: profile.paddingPx,
    extrude_edges: profile.extrudeEdges,
    individual_frames: profile.individualFrames,
    include_shadow: profile.includeShadow,
    normalize_geometry: profile.normalizeGeometry,
    clipping_policy: profile.clippingPolicy,
    allow_incomplete_test: profile.allowIncompleteTest,
  };
}

export function fromStoredExportProfile(stored: StoredNpcExportProfile): ExportProfile {
  const size = stored.profile.max_page_size_px;
  const memoryBudgetMiB = stored.profile.memory_budget_bytes / 1024 / 1024;
  if (
    !Number.isInteger(stored.revision) ||
    stored.revision < 1 ||
    size[0] !== size[1] ||
    !PAGE_SIZES.includes(size[0] as ExportProfile["maxPageSizePx"]) ||
    !Number.isInteger(memoryBudgetMiB)
  )
    throw new Error("Stored export profile uses values unsupported by this desktop version.");
  const profile: ExportProfile = {
    id: stored.id,
    name: stored.profile.name,
    format: stored.format,
    includeGodotScene: stored.include_godot_scene,
    directions: [...stored.profile.directions],
    maxPageSizePx: size[0] as ExportProfile["maxPageSizePx"],
    maxPages: stored.profile.max_pages,
    memoryBudgetMiB,
    paddingPx: stored.profile.padding_px,
    extrudeEdges: stored.profile.extrude_edges,
    individualFrames: stored.profile.individual_frames,
    includeShadow: stored.profile.include_shadow,
    normalizeGeometry: stored.profile.normalize_geometry,
    clippingPolicy: stored.profile.clipping_policy,
    allowIncompleteTest: stored.profile.allow_incomplete_test,
    rootMotionMode: stored.root_motion_mode,
    jumpMode: stored.jump_mode,
  };
  const issues = validateExportProfile(profile);
  if (issues.length > 0) throw new Error(`Stored export profile is invalid: ${issues.join(" ")}`);
  return profile;
}

export function serializeExportProfile(profile: ExportProfile): string {
  const issues = validateExportProfile(profile);
  if (issues.length > 0) throw new Error(`Export profile is invalid: ${issues.join(" ")}`);
  return JSON.stringify({ schema_version: 1, kind: "export_profile", profile });
}

export function parseExportProfile(source: string): ExportProfile {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value)) throw new Error("Export profile document must be an object.");
  assertExactKeys(value, ["schema_version", "kind", "profile"], "Export profile document");
  if (value.schema_version !== 1 || value.kind !== "export_profile")
    throw new Error("Unsupported export profile document.");
  const raw = value.profile;
  if (!isRecord(raw)) throw new Error("Export profile payload is missing.");
  assertExactKeys(raw, PROFILE_KEYS, "Export profile");
  const candidate: ExportProfile = {
    id: requireString(raw.id, "id"),
    name: requireString(raw.name, "name"),
    format: requireEnum(raw.format, ["png_json", "godot_package"], "format"),
    includeGodotScene: requireBoolean(raw.includeGodotScene, "includeGodotScene"),
    directions: requireDirections(raw.directions),
    maxPageSizePx: requireNumber(
      raw.maxPageSizePx,
      "maxPageSizePx",
    ) as ExportProfile["maxPageSizePx"],
    maxPages: requireNumber(raw.maxPages, "maxPages"),
    memoryBudgetMiB: requireNumber(raw.memoryBudgetMiB, "memoryBudgetMiB"),
    paddingPx: requireNumber(raw.paddingPx, "paddingPx"),
    extrudeEdges: requireBoolean(raw.extrudeEdges, "extrudeEdges"),
    individualFrames: requireBoolean(raw.individualFrames, "individualFrames"),
    includeShadow: requireBoolean(raw.includeShadow, "includeShadow"),
    normalizeGeometry: requireBoolean(raw.normalizeGeometry, "normalizeGeometry"),
    clippingPolicy: requireEnum(raw.clippingPolicy, ["block", "warn"], "clippingPolicy"),
    allowIncompleteTest: requireBoolean(raw.allowIncompleteTest, "allowIncompleteTest"),
    rootMotionMode: requireEnum(raw.rootMotionMode, ["baked", "external"], "rootMotionMode"),
    jumpMode: requireEnum(raw.jumpMode, ["baked", "external"], "jumpMode"),
  };
  const issues = validateExportProfile(candidate);
  if (issues.length > 0) throw new Error(`Export profile is invalid: ${issues.join(" ")}`);
  return cloneExportProfile(candidate);
}

function requireDirections(value: unknown): Direction[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error("Export profile field `directions` is invalid.");
  return [...value] as Direction[];
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Export profile field \`${field}\` is invalid.`);
  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`Export profile field \`${field}\` is invalid.`);
  return value;
}

function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`Export profile field \`${field}\` is invalid.`);
  return value;
}

function requireEnum<const T extends string>(
  value: unknown,
  choices: readonly T[],
  field: string,
): T {
  if (typeof value !== "string" || !choices.includes(value as T))
    throw new Error(`Export profile field \`${field}\` is invalid.`);
  return value as T;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length || actual.some((key, index) => key !== canonical[index]))
    throw new Error(`${label} has missing or unknown fields.`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
