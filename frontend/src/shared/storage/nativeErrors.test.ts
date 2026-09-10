import { describe, expect, it } from "vitest";
import { classifyNativeError } from "./nativeErrors";

describe("native error classification", () => {
  it("classifies string and structured optimistic-write conflicts", () => {
    expect(classifyNativeError("document changed since it was loaded").kind).toBe("conflict");
    expect(
      classifyNativeError({ code: "write_conflict", message: "revision 2 is current" }),
    ).toEqual({
      code: "write_conflict",
      kind: "conflict",
      message: "revision 2 is current",
    });
  });

  it("separates recovery, migration, and read-only failures", () => {
    expect(classifyNativeError("transaction needs explicit recovery").kind).toBe(
      "recovery_required",
    );
    expect(classifyNativeError({ code: "migration_required", message: "upgrade first" }).kind).toBe(
      "migration_required",
    );
    expect(classifyNativeError("vault is read-only").kind).toBe("read_only");
  });
});
