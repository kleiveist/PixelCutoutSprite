import {
  RESERVED_ADMIN_DIRECTORY,
  SCHEMA_VERSION,
  type Direction,
  type DocumentKind,
} from "./common";
import type { OutfitDraftStatus } from "./assets";
import type { CharacterStatus } from "./characters";
import type { TemplateStatus } from "./motion";

const DIRECTIONS = new Set<Direction>(["n", "ne", "e", "se", "s", "sw", "w", "nw"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const WINDOWS_PREFIX = /^[a-zA-Z]:[/\\]/;

export class ContractError extends Error {
  constructor(
    readonly code: "invalid_header" | "future_version" | "invalid_value",
    readonly path: string,
    message: string,
  ) {
    super(message);
    this.name = "ContractError";
  }
}

export function assertContractHeader(value: unknown, expectedKind: DocumentKind): void {
  if (!isRecord(value)) {
    throw new ContractError("invalid_header", "$", "document must be an object");
  }
  if (typeof value.schema_version !== "number" || !Number.isInteger(value.schema_version)) {
    throw new ContractError("invalid_header", "$.schema_version", "must be an integer");
  }
  if (value.schema_version > SCHEMA_VERSION) {
    throw new ContractError("future_version", "$.schema_version", "newer schema is read-only");
  }
  if (value.schema_version !== SCHEMA_VERSION || value.kind !== expectedKind) {
    throw new ContractError("invalid_header", "$.kind", `expected ${expectedKind} schema v1`);
  }
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" && UUID_PATTERN.test(value) && !/^0+$/.test(value.replaceAll("-", ""))
  );
}

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && DIRECTIONS.has(value as Direction);
}

export function isPortableRelativePath(value: string): boolean {
  const segments = value.split("/");
  return (
    value.length > 0 &&
    value.length <= 512 &&
    !value.startsWith("/") &&
    !value.startsWith("//") &&
    !WINDOWS_PREFIX.test(value) &&
    !value.includes("\\") &&
    segments.every(
      (segment) =>
        segment.length > 0 &&
        segment !== "." &&
        segment !== ".." &&
        segment.toLocaleLowerCase("en-US") !== RESERVED_ADMIN_DIRECTORY,
    )
  );
}

export function canChangeTemplateStatus(from: TemplateStatus, to: TemplateStatus): boolean {
  return (
    from === to ||
    (from === "active" && to === "archived") ||
    (from === "archived" && to === "active")
  );
}

export function canChangeOutfitStatus(from: OutfitDraftStatus, to: OutfitDraftStatus): boolean {
  return from === to || (from === "in_progress" && to === "assigned");
}

export function canChangeCharacterStatus(from: CharacterStatus, to: CharacterStatus): boolean {
  return (
    from === to ||
    (from === "draft" && (to === "reviewed" || to === "archived")) ||
    (from === "reviewed" && (to === "draft" || to === "archived")) ||
    (from === "archived" && to === "draft")
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
