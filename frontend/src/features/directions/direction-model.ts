import type { Direction } from "../../domain/common";
import type { DirectionDefinition, DirectionMode } from "../../domain/motion";

export const DIRECTION_ORDER = [
  "n",
  "ne",
  "e",
  "se",
  "s",
  "sw",
  "w",
  "nw",
] as const satisfies readonly Direction[];

export const DIRECTION_LABELS: Record<Direction, string> = {
  n: "N · Back",
  ne: "NE · Back right",
  e: "E · Right",
  se: "SE · Front right",
  s: "S · Front",
  sw: "SW · Front left",
  w: "W · Left",
  nw: "NW · Back left",
};

export function horizontalMirror(direction: Direction): Direction {
  const mirrors: Record<Direction, Direction> = {
    n: "n",
    ne: "nw",
    e: "w",
    se: "sw",
    s: "s",
    sw: "se",
    w: "e",
    nw: "ne",
  };
  return mirrors[direction];
}

export function withDirectionMode(
  definitions: readonly DirectionDefinition[],
  direction: Direction,
  mode: DirectionMode,
): DirectionDefinition[] {
  if (mode === "mirrored" && horizontalMirror(direction) === direction) {
    throw new Error(`${direction.toUpperCase()} cannot be derived by horizontal mirroring`);
  }
  const mirrorSource = horizontalMirror(direction);
  return DIRECTION_ORDER.map((name) => {
    const current = definitions.find((definition) => definition.direction === name) ?? {
      direction: name,
      mode: "missing" as const,
      source: null,
    };
    if (
      mode === "mirrored" &&
      name === mirrorSource &&
      current.mode === "mirrored" &&
      current.source === direction
    ) {
      return { direction: name, mode: "explicit", source: null };
    }
    if (name !== direction) return current;
    return {
      direction,
      mode,
      source: mode === "mirrored" ? mirrorSource : null,
    };
  });
}

export function directionAvailable(
  definitions: readonly DirectionDefinition[],
  definition: DirectionDefinition,
): boolean {
  if (definition.mode === "explicit") return true;
  if (definition.mode === "missing" || !definition.source) return false;
  return (
    definitions.find((candidate) => candidate.direction === definition.source)?.mode === "explicit"
  );
}

export function directionOrigin(definition: DirectionDefinition): string {
  if (definition.mode === "explicit") return "Editable source";
  if (definition.mode === "missing") return "Missing · release blocked";
  return `Mirrored from ${(definition.source ?? "?").toUpperCase()}`;
}
