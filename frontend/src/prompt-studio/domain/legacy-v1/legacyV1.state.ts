import { LEGACY_V1_DEFAULT_STATE } from "./legacyV1.defaults";
import type { LegacyV1State, LegacyV1StateInput } from "./legacyV1.types";

function typedKeys<T extends object>(value: T): Array<keyof T> {
  return Object.keys(value) as Array<keyof T>;
}

export function mergeLegacyV1State(input: LegacyV1StateInput = {}): LegacyV1State {
  const merged: LegacyV1State = { ...LEGACY_V1_DEFAULT_STATE };

  for (const key of typedKeys(LEGACY_V1_DEFAULT_STATE)) {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      Object.assign(merged, { [key]: input[key] });
    }
  }

  return merged;
}
