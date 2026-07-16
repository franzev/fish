// Mirrors the shared chat-media catalogs and sticker assets into FishKit.
// SwiftPM cannot reference files outside the package, so iOS carries synced
// copies gated by --check (same staging as generated tokens).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "apps/ios/FishKit/Sources/PersonalChat/Resources/ChatMedia");
const entries = [
  ["packages/core/src/chat-media/emoji-groups.json", "emoji-groups.json"],
  ["packages/core/src/chat-media/sticker-catalog.json", "sticker-catalog.json"],
  ...readdirSync(join(root, "apps/web/public/stickers/aquatic"))
    .filter((name) => name.endsWith(".webp"))
    .sort()
    .map((name) => [`apps/web/public/stickers/aquatic/${name}`, `stickers/aquatic/${name}`]),
];

const check = process.argv.includes("--check");
if (check) {
  const stale = entries.filter(([source, copy]) => {
    const target = join(destination, copy);
    return !existsSync(target)
      || !readFileSync(join(root, source)).equals(readFileSync(target));
  });
  const expected = new Set(entries.map(([, copy]) => basename(copy)));
  const stickerDir = join(destination, "stickers/aquatic");
  const extras = existsSync(stickerDir)
    ? readdirSync(stickerDir).filter((name) => !expected.has(name))
    : [];
  if (stale.length > 0 || extras.length > 0) {
    for (const [source, copy] of stale) {
      console.error(`[ios-chat-media] stale or missing: ${copy} (from ${source})`);
    }
    for (const extra of extras) {
      console.error(`[ios-chat-media] extra bundled sticker: ${extra}`);
    }
    console.error("[ios-chat-media] run: pnpm ios:chat-media");
    process.exit(1);
  }
  console.log(`[ios-chat-media] ${entries.length} bundled chat-media files are up to date`);
} else {
  rmSync(destination, { recursive: true, force: true });
  for (const [source, copy] of entries) {
    const target = join(destination, copy);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(root, source), target);
  }
  console.log(`[ios-chat-media] synced ${entries.length} files into FishKit`);
}
