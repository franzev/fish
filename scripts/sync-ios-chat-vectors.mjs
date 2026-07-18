// SwiftPM cannot reference package resources outside FishKit, so keep the
// portable chat-state fixtures byte-identical behind an explicit drift gate.
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "apps/ios/FishKit/Sources/TestSupport/Resources");
const entries = [
  ["packages/core/src/chat-state/fixtures/chat-state-vectors.json", "chat-state-vectors.json"],
  ["packages/core/src/chat-state/fixtures/chat-media-merge-vectors.json", "chat-media-merge-vectors.json"],
];

if (process.argv.includes("--check")) {
  const stale = entries.filter(([source, copy]) => {
    const target = join(destination, copy);
    return !existsSync(target)
      || !readFileSync(join(root, source)).equals(readFileSync(target));
  });
  if (stale.length > 0) {
    for (const [source, copy] of stale) {
      console.error(`[ios-chat-vectors] stale or missing: ${copy} (from ${source})`);
    }
    console.error("[ios-chat-vectors] run: pnpm ios:chat-vectors");
    process.exit(1);
  }
  console.log(`[ios-chat-vectors] ${entries.length} fixture files are up to date`);
} else {
  mkdirSync(destination, { recursive: true });
  for (const [source, copy] of entries) {
    cpSync(join(root, source), join(destination, copy));
  }
  console.log(`[ios-chat-vectors] synced ${entries.length} files into FishKit`);
}
