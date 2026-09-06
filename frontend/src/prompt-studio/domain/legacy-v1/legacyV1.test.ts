import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import autosaveFixture from "../../test/fixtures/legacy-v1/autosave-directional-character.json";
import defaultOutputSignatures from "../../test/fixtures/legacy-v1/default-output-signatures.json";
import presetsFixture from "../../test/fixtures/legacy-v1/presets-storage.json";
import scenarioOutputSignatures from "../../test/fixtures/legacy-v1/scenario-output-signatures.json";
import {
  buildLegacyV1ProjectOutputs,
  getLegacyV1ResolvedMetrics,
  LEGACY_V1_DEFAULT_STATE,
  mergeLegacyV1State,
  validateLegacyV1State,
} from "./index";

const PROMPT_FIELDS = ["main", "negative", "technical", "combined"] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeOutputs(outputs: ReturnType<typeof buildLegacyV1ProjectOutputs>) {
  return outputs.map((output) => ({
    id: output.id,
    profile: output.profile,
    language: output.language,
    lengths: Object.fromEntries(PROMPT_FIELDS.map((field) => [field, output[field].length])),
    sha256: Object.fromEntries(PROMPT_FIELDS.map((field) => [field, sha256(output[field])])),
  }));
}

describe("Legacy-V1-Domainport", () => {
  it("reproduziert Standardmetriken und Promptsignaturen bytegenau", () => {
    const outputs = buildLegacyV1ProjectOutputs(LEGACY_V1_DEFAULT_STATE);

    expect(getLegacyV1ResolvedMetrics(LEGACY_V1_DEFAULT_STATE)).toEqual(
      defaultOutputSignatures.metrics,
    );
    expect(summarizeOutputs(outputs)).toEqual(defaultOutputSignatures.outputs);
  });

  it("reproduziert das Directional-Character-Autosave aus der V1-Baseline", () => {
    const state = mergeLegacyV1State(autosaveFixture.state);

    expect({
      metrics: getLegacyV1ResolvedMetrics(state),
      outputs: summarizeOutputs(buildLegacyV1ProjectOutputs(state)),
    }).toEqual(scenarioOutputSignatures.directionalCharacter);
  });

  it("behält den historischen 4×2-Layoutvertrag des Gebäude-Presets bei", () => {
    const preset = presetsFixture[0];

    expect(preset).toBeDefined();
    if (preset === undefined) throw new Error("V1-Preset-Fixture fehlt.");

    const state = mergeLegacyV1State(preset.state);
    expect({
      metrics: getLegacyV1ResolvedMetrics(state),
      outputs: summarizeOutputs(buildLegacyV1ProjectOutputs(state)),
    }).toEqual(scenarioOutputSignatures.singleBuilding);
  });

  it("portiert Validierung und Whitelist-Merge ohne unbekannte Importfelder", () => {
    const invalidState = {
      ...LEGACY_V1_DEFAULT_STATE,
      outputMode: "directional8",
      sheetLayout: "2x2",
    } as const;
    const validation = validateLegacyV1State(invalidState);

    expect(validation).toEqual({
      valid: false,
      errors: ["Das gewählte Sheet-Layout bietet nur 4 Frames, benötigt werden 8."],
      warnings: ["Für acht Richtungen ist 4×2, 8×1 oder 2×4 technisch eindeutiger."],
    });

    const merged = mergeLegacyV1State({ projectName: "Test", unknownField: "ignored" });
    expect(merged.projectName).toBe("Test");
    expect(merged).not.toHaveProperty("unknownField");
  });
});
