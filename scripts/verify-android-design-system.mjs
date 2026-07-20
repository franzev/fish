#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "design/tokens/fish.tokens.json");
const generatedPath = path.join(
  root,
  "apps/android/core/designsystem/src/main/kotlin/space/fishhub/android/core/designsystem/tokens/GeneratedTokens.kt",
);
const cssPath = path.join(root, "apps/web/app/globals.css");
const tokens = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const css = fs.readFileSync(cssPath, "utf8");

const beforeGeneration = fs.readFileSync(generatedPath, "utf8");
execFileSync(process.execPath, [path.join(root, "scripts/generate-android-design-tokens.mjs")], {
  stdio: "ignore",
});
assert.equal(
  fs.readFileSync(generatedPath, "utf8"),
  beforeGeneration,
  "Generated Android tokens are stale. Run pnpm android:tokens.",
);

const cssColorNames = {
  background: "bg",
  surface: "surface",
  surfaceAlt: "surface-2",
  interactiveHover: "chat-hover",
  interactiveActive: "chat-active",
  avatar: "avatar",
  selected: "surface-3",
  border: "border",
  borderStrong: "border-strong",
  divider: "divider",
  primary: "primary",
  primaryPressed: "primary-press",
  onPrimary: "on-primary",
  foreground: "foreground",
  body: "body",
  muted: "muted",
  notice: "notice",
  error: "error",
  warning: "warning",
  success: "success",
  presenceOnline: "presence-online",
  presenceIdle: "presence-idle",
  presenceAway: "presence-away",
  presenceBusy: "presence-busy",
  presenceOffline: "presence-offline",
  scrim: "scrim",
};

for (const [tokenName, cssName] of Object.entries(cssColorNames)) {
  const match = css.match(
    new RegExp(`--color-${cssName}:\\s*light-dark\\(oklch\\(([^)]*)\\),\\s*oklch\\(([^)]*)\\)\\)`),
  );
  assert.ok(match, `Missing web color token --color-${cssName}`);
  assert.deepEqual(parseOklch(match[1]), tokens.color[tokenName].light, `${tokenName} light differs from web`);
  assert.deepEqual(parseOklch(match[2]), tokens.color[tokenName].dark, `${tokenName} dark differs from web`);
}

const textPairs = [
  ["foreground", "background"],
  ["body", "background"],
  ["muted", "background"],
  ["onPrimary", "primary"],
  ["notice", "surface"],
  ["error", "surface"],
  ["warning", "surface"],
  ["success", "surface"],
];
for (const theme of ["light", "dark"]) {
  for (const [foreground, background] of textPairs) {
    const contrast = contrastRatio(tokens.color[foreground][theme], tokens.color[background][theme]);
    assert.ok(contrast >= 4.5, `${theme} ${foreground}/${background} contrast ${contrast.toFixed(2)} is below 4.5:1`);
  }
  const boundaryContrast = contrastRatio(tokens.color.border[theme], tokens.color.surface[theme]);
  assert.ok(boundaryContrast >= 3, `${theme} border/surface contrast is below 3:1`);
  for (const name of ["presenceOnline", "presenceIdle", "presenceAway", "presenceBusy", "presenceOffline"]) {
    const contrast = contrastRatio(tokens.color[name][theme], tokens.color.surface[theme]);
    assert.ok(contrast >= 3, `${theme} ${name}/surface contrast ${contrast.toFixed(2)} is below 3:1`);
  }
}

assert.equal(tokens.sizeDp.touchTarget, 48, "Android touch targets must remain at least 48dp");
assert.equal(tokens.sizeDp.primaryControl, 56, "Primary controls must remain 56dp");
assert.ok(
  tokens.sizeDp.presenceIndicatorSmall >= 12 && tokens.sizeDp.presenceIndicatorSmall <= 20,
  "The small presence indicator must remain legible without competing with the avatar",
);

const guardedRoots = [
  "apps/android/core/designsystem/src/main/kotlin/space/fishhub/android/core/designsystem/component",
  "apps/android/feature/chat/src/main",
  "apps/android/feature/presence/src/main",
  "apps/android/feature/settings/src/main",
];
for (const relativeRoot of guardedRoots) {
  for (const file of walk(path.join(root, relativeRoot)).filter((value) => value.endsWith(".kt"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.equal(
      /\b\d+(?:\.\d+)?\.(?:dp|sp)\b/.test(source),
      false,
      `${path.relative(root, file)} contains a raw dp/sp value`,
    );
    assert.equal(
      /Color\s*\(\s*0x|Color\.(?:Black|White|Red|Green|Blue|Gray)/.test(source),
      false,
      `${path.relative(root, file)} contains a raw color`,
    );
  }
}

const importGuards = [
  {
    root: "apps/android/feature/chat/src/main/kotlin/space/fishhub/android/feature/chat/state",
    forbidden: [
      /^import androidx\.compose/m,
      /^import android\./m,
      /^import .*supabase/m,
      /^import androidx\.room/m,
    ],
    label: "pure chat state",
  },
  {
    root: "apps/android/data/chat/src/main/kotlin/space/fishhub/android/data/chat/model",
    forbidden: [/^import androidx\.compose/m, /^import .*supabase/m, /^import androidx\.room/m],
    label: "chat data model",
  },
  {
    root: "apps/android/feature/chat/src/main",
    forbidden: [/^import io\.github\.jan\.supabase/m, /^import androidx\.room/m],
    label: "chat feature",
  },
  {
    root: "apps/android/feature/presence/src/main",
    forbidden: [
      /^import io\.github\.jan\.supabase/m,
      /^import androidx\.room/m,
      /^import com\.fish\.android\.data\.presence\.remote/m,
      /^import io\.livekit/m,
    ],
    label: "provider-neutral presence feature",
  },
  {
    root: "apps/android/feature/settings/src/main",
    forbidden: [
      /^import android\./m,
      /^import .*supabase/m,
      /^import androidx\.room/m,
      /^import space\.fishhub\.android\.data\./m,
      /^import space\.fishhub\.android\.feature\./m,
    ],
    label: "provider-neutral settings feature",
  },
];
for (const guard of importGuards) {
  for (const file of walk(path.join(root, guard.root)).filter((value) => value.endsWith(".kt"))) {
    const source = fs.readFileSync(file, "utf8");
    for (const forbidden of guard.forbidden) {
      assert.equal(
        forbidden.test(source),
        false,
        `${path.relative(root, file)} violates the ${guard.label} module boundary`,
      );
    }
  }
}

console.log("Android design-system verification passed.");

function parseOklch(value) {
  const [channels, alpha = "1"] = value.trim().split(/\s*\/\s*/);
  const [lightness, chroma, hue] = channels.trim().split(/\s+/).map(Number);
  return [lightness, chroma, hue, Number(alpha)];
}

function contrastRatio(foreground, background) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance([lightness, chroma, hue]) {
  const radians = hue * Math.PI / 180;
  const a = chroma * Math.cos(radians);
  const b = chroma * Math.sin(radians);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const red = clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const green = clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const blue = clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value) {
  return Math.min(1, Math.max(0, value));
}

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const value = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(value);
    else yield value;
  }
}
