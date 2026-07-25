#!/usr/bin/env node
// Enforces the native Android/iOS component parity contract.
//
//   node scripts/verify-native-parity.mjs           verify the registry against the tree
//   node scripts/verify-native-parity.mjs --scan    print the components found on disk
//
// The registry lives at design/parity/native-components.json and is the single
// source of truth for which UI component exists on each platform, what it is
// called, which props it takes, and which preview cases cover it.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const REGISTRY = join(ROOT, "design/parity/native-components.json");

const ANDROID_ROOTS = [
  "apps/android/feature",
  "apps/android/core/designsystem",
  "apps/android/core/ui",
];
const IOS_ROOTS = ["apps/ios/FishKit/Sources"];

// Parameters that exist for platform reasons and so never participate in prop
// comparison. See docs/native-parity-refactor-plan.md §8.
//
//   modifier                    Compose mandates it as the first optional param
//   requestedFocus              SwiftUI @Binding accessibility focus
//   attachmentCommands,         SwiftUI view-scoped services; Compose hoists the
//   imageLoader, fileDownloader equivalents to the ViewModel instead
//   restoreFocus,               Compose focus plumbing; SwiftUI uses the
//   onFocusChanged              @AccessibilityFocusState property wrapper
//   loader, commands,           Injected dependencies, not data. FishKit hands
//   downloader, loadThumbnail,  them to the view; Compose resolves the same
//   thumbnailLoader,            collaborators in the ViewModel and passes the
//   gifProvider, mediaEngine    resulting data or callbacks down.
const EXEMPT_PROPS = new Set([
  "modifier",
  "requestedFocus",
  "attachmentCommands",
  "imageLoader",
  "fileDownloader",
  "restoreFocus",
  "onFocusChanged",
  "loader",
  "commands",
  "downloader",
  "loadThumbnail",
  "thumbnailLoader",
  "gifProvider",
  "mediaEngine",
]);

// Names that mean the same thing but follow each platform's control
// conventions: SwiftUI buttons take `action:`, Compose takes `onClick`.
// Compared as equal rather than exempted, because the parameter exists on both.
const PROP_ALIASES = new Map([["action", "onClick"]]);
const canonicalProp = (p) => PROP_ALIASES.get(p) ?? p;

function walk(dir, ext, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "build" || entry === ".build" || entry === "Generated") continue;
      walk(full, ext, out);
    } else if (entry.endsWith(ext)) {
      out.push(full);
    }
  }
  return out;
}

/** Returns the index just past the parenthesis group starting at `open`. */
function matchParen(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits a parameter list on top-level commas and returns the parameter names. */
function paramNames(list, nameOf) {
  const parts = [];
  let depth = 0;
  let current = "";
  let prev = "";
  for (const ch of list) {
    // `>` closes a generic, but the one in `->` closes nothing.
    if (ch === "(" || ch === "<" || ch === "[") depth += 1;
    else if (ch === ")" || ch === "]" || (ch === ">" && prev !== "-")) depth -= 1;
    prev = ch;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts.map(nameOf).filter(Boolean);
}

function androidComponents(file) {
  const text = readFileSync(file, "utf8");
  const found = [];
  const re = /@Composable\s+(?:@[\w.]+(?:\([^)]*\))?\s+)*(private|internal|public)?\s*fun\s+([A-Z]\w*)\s*\(/g;
  let m;
  while ((m = re.exec(text))) {
    const open = text.indexOf("(", m.index + m[0].length - 1);
    const close = matchParen(text, open);
    if (close === -1) continue;
    // A composable that emits UI returns Unit: no `: Type` between `)` and `{`.
    const after = text.slice(close + 1, close + 40).trimStart();
    if (after.startsWith(":")) continue;
    found.push({
      symbol: m[2],
      visibility: m[1] ?? "public",
      props: paramNames(text.slice(open + 1, close), (p) => {
        const name = p.trim().replace(/^(?:@\w+\s+)*(?:vararg\s+)?/, "").split(":")[0].trim();
        return /^\w+$/.test(name) ? name : null;
      }),
      line: text.slice(0, m.index).split("\n").length,
    });
  }
  return found;
}

function iosComponents(file) {
  const text = readFileSync(file, "utf8");
  const found = [];
  const re = /^(public |internal |private |fileprivate )?struct\s+(\w+)\s*:\s*([^{]+)\{/gm;
  let m;
  while ((m = re.exec(text))) {
    if (!/\bView\b/.test(m[3])) continue;
    found.push({
      symbol: m[2],
      visibility: (m[1] ?? "internal").trim(),
      props: iosProps(text, m.index),
      line: text.slice(0, m.index).split("\n").length,
    });
  }
  return found;
}

/** Prefers an explicit init's argument labels; falls back to stored properties. */
function iosProps(text, structStart) {
  const body = text.slice(structStart, nextStructStart(text, structStart));
  const init = body.match(/(?:public |internal )?init\s*\(/);
  if (init) {
    const open = body.indexOf("(", init.index);
    const close = matchParen(body, open);
    if (close !== -1) {
      return paramNames(body.slice(open + 1, close), (p) => {
        const label = p.trim().split(":")[0].trim().split(/\s+/)[0];
        return /^\w+$/.test(label) && label !== "_" ? label : null;
      });
    }
  }
  // No explicit init: memberwise. Stored properties only — `body` and other
  // computed properties (trailing `{`) are not part of the component's props.
  const props = [];
  const re = /^\s{4}(?:public |private |internal )?(?:let|var)\s+(\w+)\s*:([^\n]*)$/gm;
  let m;
  while ((m = re.exec(body))) {
    if (m[1] === "body" || m[2].trimEnd().endsWith("{")) continue;
    props.push(m[1]);
  }
  return props;
}

function nextStructStart(text, from) {
  const re = /^(?:public |internal |private |fileprivate )?(?:struct|final class|class|enum|extension)\s+\w+/gm;
  re.lastIndex = from + 1;
  const m = re.exec(text);
  return m ? m.index : text.length;
}

function scan() {
  const android = new Map();
  for (const root of ANDROID_ROOTS) {
    for (const file of walk(join(ROOT, root), ".kt")) {
      if (!file.includes("/src/main/")) continue;
      const components = androidComponents(file);
      if (components.length) android.set(relative(ROOT, file), components);
    }
  }
  const ios = new Map();
  for (const root of IOS_ROOTS) {
    for (const file of walk(join(ROOT, root), ".swift")) {
      const components = iosComponents(file);
      if (components.length) ios.set(relative(ROOT, file), components);
    }
  }
  return { android, ios };
}

/**
 * Preview cases declared in Compose screenshot tests, with the components each
 * one renders. A case is attributed to every registry component whose symbol
 * appears in the preview function body.
 */
function androidPreviewCases() {
  const cases = new Map();
  for (const root of ANDROID_ROOTS) {
    for (const file of walk(join(ROOT, root), ".kt")) {
      if (!file.includes("/src/screenshotTest/")) continue;
      const text = readFileSync(file, "utf8");
      // Android previews render composite frames (`ScreenshotFrame(model=…)`)
      // rather than naming components directly, so inline the bodies of local
      // helpers one level deep to see which components a case actually covers.
      // Brace-match each helper body: a non-greedy `\n}` stops at the first
      // nested brace and then desynchronises, silently skipping later helpers.
      const helpers = new Map();
      for (const m of text.matchAll(/^(?:private\s+)?fun\s+(\w+)\s*\(/gm)) {
        const open = text.indexOf("{", m.index);
        if (open === -1) continue;
        let depth = 0;
        let end = open;
        for (; end < text.length; end += 1) {
          if (text[end] === "{") depth += 1;
          else if (text[end] === "}" && --depth === 0) break;
        }
        helpers.set(m[1], text.slice(m.index, end + 1));
      }
      const expand = (body) =>
        body +
        [...body.matchAll(/\b([A-Z]\w+)\s*\(/g)]
          .map((c) => helpers.get(c[1]) ?? "")
          .join("\n");
      for (const m of text.matchAll(/@Preview\s*\(([\s\S]*?)\)\s*\n@Composable\s*\n(?:\w+\s+)*fun\s+(\w+)\s*\(\s*\)\s*\{([\s\S]*?)\n\}/g)) {
        const name = m[1].match(/name\s*=\s*"([^"]+)"/);
        cases.set(name ? name[1] : m[2], { file: relative(ROOT, file), body: expand(m[3]) });
      }
    }
  }
  return cases;
}

/**
 * Snapshot cases declared in the Swift test targets, with the enclosing test
 * function body so cases can be attributed to the components they render.
 */
function iosPreviewCases() {
  const cases = new Map();
  for (const file of walk(join(ROOT, "apps/ios/FishKit/Tests"), ".swift")) {
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(/func\s+(\w+)\s*\([^)]*\)[^{]*\{([\s\S]*?)\n {4}\}/g)) {
      for (const n of m[2].matchAll(/named:\s*"([^"\\]+)"/g)) {
        cases.set(n[1], { file: relative(ROOT, file), body: m[2] });
      }
    }
  }
  return cases;
}

/** Per-component preview coverage on each platform. */
function previewCoverage(registry) {
  const android = androidPreviewCases();
  const ios = iosPreviewCases();
  const rows = [];
  for (const entry of registry.components) {
    const hit = (cases, side) =>
      side
        ? [...cases]
            // A case rendering `XContent` covers `X`: this codebase splits a
            // route wrapper from the content composable it hosts.
            .filter(([, v]) => new RegExp(`\\b${side.symbol}(?:Content)?\\b`).test(v.body))
            .map(([name]) => name)
        : [];
    rows.push({
      name: entry.name,
      android: hit(android, entry.android),
      ios: hit(ios, entry.ios),
      paired: Boolean(entry.android && entry.ios),
    });
  }
  return rows;
}

function verify() {
  if (!existsSync(REGISTRY)) {
    console.error(`Missing registry: ${relative(ROOT, REGISTRY)}`);
    return 1;
  }
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
  const { android, ios } = scan();
  const errors = [];

  const claimed = { android: new Set(), ios: new Set() };

  for (const entry of registry.components) {
    for (const platform of ["android", "ios"]) {
      const side = entry[platform];
      if (!side) continue;
      const found = platform === "android" ? android : ios;

      // 1 — the declared file exists.
      if (!existsSync(join(ROOT, side.file))) {
        errors.push(`${entry.name}: ${platform} file missing — ${side.file}`);
        continue;
      }
      const components = found.get(side.file) ?? [];

      // 2 — the declared symbol is actually declared there.
      const match = components.find((c) => c.symbol === side.symbol);
      if (!match) {
        errors.push(`${entry.name}: ${platform} symbol ${side.symbol} not declared in ${side.file}`);
        continue;
      }
      claimed[platform].add(`${side.file}#${side.symbol}`);

      // 3 — one public component per file. Overloads of one name are one
      // component, so count distinct symbols rather than declarations.
      const publicOnes = [
        ...new Set(
          components
            .filter((c) => c.visibility !== "private" && c.visibility !== "fileprivate")
            .map((c) => c.symbol),
        ),
      ];
      if (publicOnes.length > 1) {
        errors.push(
          `${side.file}: declares ${publicOnes.length} components (${publicOnes.join(", ")}) — one per file`,
        );
      }

      // 7 — public surface must be declared.
      if (match.visibility === "public" && side.visibility !== "public") {
        errors.push(`${entry.name}: ${platform} ${side.symbol} is public but registry says ${side.visibility}`);
      }
    }

    // 5 — props must match when the entry claims they are aligned.
    if (entry.propsAligned && entry.android && entry.ios) {
      const a = (android.get(entry.android.file) ?? []).find((c) => c.symbol === entry.android.symbol);
      const i = (ios.get(entry.ios.file) ?? []).find((c) => c.symbol === entry.ios.symbol);
      if (a && i) {
        const clean = (props) => props.filter((p) => !EXEMPT_PROPS.has(p)).map(canonicalProp);
        const av = clean(a.props);
        const iv = clean(i.props);
        if (av.join(",") !== iv.join(",")) {
          errors.push(`${entry.name}: propsAligned but android [${av}] != ios [${iv}]`);
        }
      }
    }
  }

  // 6 — preview cases must match when the entry claims they are aligned.
  const androidCases = androidPreviewCases();
  const iosCases = iosPreviewCases();
  for (const entry of registry.components) {
    if (!entry.previewsAligned) continue;
    for (const name of entry.previews ?? []) {
      if (!androidCases.has(name)) errors.push(`${entry.name}: preview case "${name}" missing on android`);
      if (!iosCases.has(name)) errors.push(`${entry.name}: preview case "${name}" missing on ios`);
    }
  }

  // 8 — a paired component must either have aligned props or say why not.
  // Without this an unconverged component is indistinguishable from one nobody
  // has looked at yet.
  const BREAKS = new Set(["state-bundling", "platform-idiom", "feature-gap"]);
  for (const entry of registry.components) {
    if (!entry.android || !entry.ios) continue;
    if (entry.propsAligned) {
      if (entry.propsBreak) {
        errors.push(`${entry.name}: propsAligned yet still carries propsBreak "${entry.propsBreak}"`);
      }
      continue;
    }
    if (!entry.propsBreak) {
      errors.push(`${entry.name}: props differ with no propsBreak recorded — classify it`);
    } else if (!BREAKS.has(entry.propsBreak)) {
      errors.push(`${entry.name}: unknown propsBreak "${entry.propsBreak}"`);
    }
  }

  // 4 — every component on disk is accounted for.
  for (const [platform, found] of [["android", android], ["ios", ios]]) {
    for (const [file, components] of found) {
      for (const component of components) {
        if (component.visibility === "private" || component.visibility === "fileprivate") continue;
        if (!claimed[platform].has(`${file}#${component.symbol}`)) {
          errors.push(`${platform}: ${component.symbol} (${file}:${component.line}) has no registry entry`);
        }
      }
    }
  }

  const unique = [...new Set(errors)].sort();
  if (unique.length) {
    console.error(`Native parity: ${unique.length} problem(s)\n`);
    for (const error of unique) console.error(`  ${error}`);
    return 1;
  }
  console.log(`Native parity: OK (${registry.components.length} components)`);
  return 0;
}

if (process.argv.includes("--previews")) {
  const registry = JSON.parse(readFileSync(REGISTRY, "utf8"));
  const rows = previewCoverage(registry);
  const both = rows.filter((r) => r.paired);
  const covered = both.filter((r) => r.android.length && r.ios.length);
  const neither = both.filter((r) => !r.android.length && !r.ios.length);
  const oneSided = both.filter((r) => Boolean(r.android.length) !== Boolean(r.ios.length));
  console.log(`Preview coverage across ${both.length} paired components\n`);
  console.log(`  both platforms: ${covered.length}`);
  console.log(`  one platform:   ${oneSided.length}`);
  console.log(`  neither:        ${neither.length}\n`);
  if (oneSided.length) {
    console.log("Covered on one platform only:");
    for (const r of oneSided) {
      console.log(`  ${r.name.padEnd(34)} android:${r.android.length} ios:${r.ios.length}`);
    }
  }
  if (neither.length) {
    console.log(`\nNo image coverage on either platform:\n  ${neither.map((r) => r.name).join(", ")}`);
  }
  process.exit(0);
}

if (process.argv.includes("--scan")) {
  const { android, ios } = scan();
  const dump = (label, map) => {
    console.log(`\n=== ${label} (${[...map.values()].flat().length} components in ${map.size} files) ===`);
    for (const [file, components] of [...map].sort()) {
      console.log(`${components.length > 1 ? "!" : " "} ${file}`);
      for (const c of components) console.log(`      ${c.visibility} ${c.symbol}(${c.props.join(", ")})`);
    }
  };
  dump("android", android);
  dump("ios", ios);
  process.exit(0);
}

process.exit(verify());
