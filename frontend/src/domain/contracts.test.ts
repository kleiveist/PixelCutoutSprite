import {
  ContractError,
  assertContractHeader,
  canChangeOutfitStatus,
  canChangeTemplateStatus,
  isDirection,
  isPortableRelativePath,
  isUuid,
  type AnimationBinding,
  type Appearance,
  type MotionTemplate,
} from ".";
import { describe, expect, it } from "vitest";

describe("versioned domain DTO contracts", () => {
  it("recognizes v1 headers and rejects a future schema explicitly", () => {
    expect(() => assertContractHeader({ schema_version: 1, kind: "area" }, "area")).not.toThrow();
    expect(() => assertContractHeader({ schema_version: 2, kind: "area" }, "area")).toThrowError(
      expect.objectContaining<Partial<ContractError>>({
        code: "future_version",
        path: "$.schema_version",
      }),
    );
    expect(() => assertContractHeader({ schema_version: 1, kind: "project" }, "area")).toThrowError(
      expect.objectContaining<Partial<ContractError>>({ code: "invalid_header", path: "$.kind" }),
    );
  });

  it("keeps UUID, direction, and portable path rules aligned with Rust", () => {
    expect(isUuid("88888888-8888-4888-8888-888888888888")).toBe(true);
    expect(isUuid(42)).toBe(false);
    expect(isDirection("nw")).toBe(true);
    expect(isDirection("north")).toBe(false);
    expect(isPortableRelativePath("assets/body.png")).toBe(true);
    for (const path of ["../body.png", "/tmp/body.png", "C:/body.png", "a\\body.png"]) {
      expect(isPortableRelativePath(path)).toBe(false);
    }
  });

  it("models release coexistence and one-way assignment", () => {
    expect(canChangeTemplateStatus("active", "archived")).toBe(true);
    expect(canChangeTemplateStatus("archived", "active")).toBe(true);
    expect(canChangeOutfitStatus("in_progress", "assigned")).toBe(true);
    expect(canChangeOutfitStatus("assigned", "in_progress")).toBe(false);
  });

  it("keeps template, appearance, and binding identities distinct", () => {
    const template = { id: "44444444-4444-4444-8444-444444444444" } as MotionTemplate;
    const appearance = { id: "77777777-7777-4777-8777-777777777777" } as Appearance;
    const binding = {
      id: "88888888-8888-4888-8888-888888888888",
      template_ref: { id: template.id, revision: 1 },
      appearance_id: appearance.id,
    } as AnimationBinding;
    expect(new Set([template.id, appearance.id, binding.id]).size).toBe(3);
    expect(binding.template_ref.id).toBe(template.id);
    expect(binding.appearance_id).toBe(appearance.id);
  });
});
