// Enforce the FISH iOS visual contract and one-way package dependencies.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve("apps/ios/FishKit/Sources");
const violations = [];

const RULES = [
  {
    name: "raw color construction (use Palette tokens)",
    pattern: /Color\(red:|UIColor\(red:|#colorLiteral|Color\(hue:|Color\(white:/,
    allow: (file) => file.includes(`${path.sep}Generated${path.sep}`),
  },
  {
    name: "hex color literal (use Palette tokens)",
    pattern: /"#[0-9a-fA-F]{3,8}"/,
    allow: () => false,
  },
  {
    name: "direct font construction (use Typography / textStyle)",
    pattern: /Font\.custom\(|\.font\(\.system/,
    allow: (file) => file.endsWith("Typography.swift"),
  },
  {
    name: "shadow (FISH uses no shadows)",
    pattern: /\.shadow\(/,
    allow: () => false,
  },
  {
    name: "system material (FISH draws its own chrome)",
    pattern: /\.(?:ultraThin|thin|regular|thick|ultraThick)Material\b/,
    allow: () => false,
  },
];

const FORBIDDEN_IMPORTS = {
  DesignSystem: ["UIComponents", "PersonalChat", "TestSupport"],
  UIComponents: ["PersonalChat", "TestSupport"],
  PersonalChat: ["TestSupport"],
};

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) walk(fullPath);
    else if (fullPath.endsWith(".swift")) check(fullPath);
  }
}

function check(file) {
  const lines = readFileSync(file, "utf8").split("\n");
  for (const rule of RULES) {
    if (rule.allow(file)) continue;
    lines.forEach((line, index) => {
      if (rule.pattern.test(line)) {
        report(file, index + 1, rule.name);
      }
    });
  }

  const relative = path.relative(ROOT, file);
  const moduleName = relative.split(path.sep)[0];
  for (const forbiddenImport of FORBIDDEN_IMPORTS[moduleName] ?? []) {
    lines.forEach((line, index) => {
      if (line.trim() === `import ${forbiddenImport}`) {
        report(
          file,
          index + 1,
          `${moduleName} must not import ${forbiddenImport}`,
        );
      }
    });
  }
}

function report(file, line, message) {
  violations.push(
    `${path.relative(process.cwd(), file)}:${line} — ${message}`,
  );
}

walk(ROOT);
if (violations.length > 0) {
  console.error(
    "[ios-guard] policy violations:\n" +
      violations.map((violation) => `  ${violation}`).join("\n"),
  );
  process.exit(1);
}

console.log(
  "[ios-guard] token policy and package dependency direction verified",
);
