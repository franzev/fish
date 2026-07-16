import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(
  await readFile(join(root, "packages/core/src/chat-media/sticker-catalog.json"), "utf8"),
);
const emojiCatalog = JSON.parse(
  await readFile(join(root, "packages/core/src/chat-media/emoji-groups.json"), "utf8"),
);
const emojiSource = JSON.parse(
  await readFile(
    join(
      root,
      "node_modules/.pnpm/unicode-emoji-json@0.9.0/node_modules/unicode-emoji-json/data-by-group.json",
    ),
    "utf8",
  ),
);

function idsIn(source) {
  return [...new Set(source.match(/aquatic-[a-z-]+/g) ?? [])].sort();
}

const catalogIds = catalog.map((sticker) => sticker.id).sort();
const sources = [
  ["core contract", "packages/core/src/chat.ts"],
  ["send-message allowlist", "supabase/functions/send-message/index.ts"],
  ["latest database constraint", "supabase/migrations/0033_chat_sticker_batch_2.sql"],
];

for (const [label, path] of sources) {
  const ids = idsIn(await readFile(join(root, path), "utf8"));
  if (JSON.stringify(ids) !== JSON.stringify(catalogIds)) {
    throw new Error(`${label} sticker ids do not match the shared catalog.`);
  }
}

const assetDirectory = join(root, "apps/web/public/stickers/aquatic");
const assetNames = (await readdir(assetDirectory)).filter((name) => name.endsWith(".webp")).sort();
const catalogNames = catalog.map((sticker) => basename(sticker.src)).sort();
if (JSON.stringify(assetNames) !== JSON.stringify(catalogNames)) {
  throw new Error("Sticker assets do not match the shared catalog.");
}

// iOS bundles synced copies (SwiftPM cannot reference files outside the package).
const iosMedia = join(root, "apps/ios/FishKit/Sources/PersonalChat/Resources/ChatMedia");
for (const copy of ["sticker-catalog.json", "emoji-groups.json"]) {
  const canonical = await readFile(join(root, "packages/core/src/chat-media", copy), "utf8");
  if (canonical !== (await readFile(join(iosMedia, copy), "utf8"))) {
    throw new Error(`iOS bundled ${copy} is stale. Run: pnpm ios:chat-media`);
  }
}
const iosAssetNames = (await readdir(join(iosMedia, "stickers/aquatic")))
  .filter((name) => name.endsWith(".webp")).sort();
if (JSON.stringify(iosAssetNames) !== JSON.stringify(catalogNames)) {
  throw new Error("iOS bundled sticker assets do not match the shared catalog. Run: pnpm ios:chat-media");
}

if (JSON.stringify(emojiCatalog) !== JSON.stringify(emojiSource)) {
  throw new Error("Emoji catalog is stale. Regenerate it from unicode-emoji-json 0.9.0.");
}

console.log(`Verified ${catalogIds.length} stickers and ${emojiCatalog.length} emoji groups.`);
