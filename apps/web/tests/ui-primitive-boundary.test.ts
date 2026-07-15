import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceRoots = ["app", "components", "features"];

function filesBelow(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? filesBelow(path) : [path];
  });
}

const productionComponents = sourceRoots
  .flatMap((directory) => filesBelow(join(root, directory)))
  .filter((file) => file.endsWith(".tsx"))
  .filter((file) => !/\.(?:test|stories)\.tsx$/.test(file));

function offenders(
  pattern: RegExp,
  allowed: (relativePath: string) => boolean = () => false
) {
  return productionComponents.flatMap((file) => {
    const path = relative(root, file);
    if (allowed(path)) return [];
    return pattern.test(readFileSync(file, "utf8")) ? [path] : [];
  });
}

describe("shared UI primitive boundaries", () => {
  it("keeps icon-only visual logic inside IconButton and IconTabStrip", () => {
    expect(
      offenders(/icon-button-glyph/, (path) =>
        [
          "components/ui/button/button.tsx",
          "components/ui/icon-tab-strip/icon-tab-strip.tsx",
        ].includes(path)
      )
    ).toEqual([]);
    expect(
      offenders(/controlSize\s*=\s*["']square["']/, (path) =>
        path === "components/ui/icon-button/icon-button.tsx"
      )
    ).toEqual([]);
    expect(
      offenders(/\bbuttonVariants\s*\(/, (path) =>
        path === "components/ui/button/button.tsx"
      )
    ).toEqual([]);
    expect(
      offenders(/TooltipIconButton/, (path) =>
        path === "components/ui/tooltip-icon-button/tooltip-icon-button.tsx"
      )
    ).toEqual([]);
  });

  it("keeps Base UI menu styling behind ActionMenu", () => {
    expect(
      offenders(/@base-ui\/react\/menu/, (path) =>
        path === "components/ui/action-menu/action-menu.tsx"
      )
    ).toEqual([]);
  });

  it("rejects heavy side-stripe callouts", () => {
    expect(offenders(/\bborder-(?:l|r)-(?:[2-9]|\[)/)).toEqual([]);
  });
});
