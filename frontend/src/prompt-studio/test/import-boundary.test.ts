import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const promptRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function sourceFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.(?:ts|tsx|css)$/u.test(entry.name) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("prompt studio integration boundary", () => {
  it("does not import the PixelForge application or animation studio", () => {
    const forbiddenImport =
      /(?:from\s+|import\s*)["'][^"']*(?:animation-studio|animation-project|animation-editor|StudioSwitcher|\/main|styles\/globals\.css)[^"']*["']/u;
    const violations = sourceFiles(promptRoot).flatMap((path) => {
      const match = readFileSync(path, "utf8").match(forbiddenImport);
      return match ? [`${path.slice(promptRoot.length + 1)}: ${match[0]}`] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps prompt barrels free from animation schemas", () => {
    const schemasBarrel = readFileSync(join(promptRoot, "schemas", "index.ts"), "utf8");
    expect(schemasBarrel).not.toMatch(
      /from\s+["'][^"']*(?:animationProject|spriteSheetMetadata)[^"']*["']/u,
    );
  });
});
