import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const destination = join(root, "packages/core/src/chat-media/emoji-groups.json");
const source = join(
  root,
  "node_modules/.pnpm/unicode-emoji-json@0.9.0/node_modules/unicode-emoji-json/data-by-group.json",
);
const groups = JSON.parse(await readFile(source, "utf8"));

await mkdir(dirname(destination), { recursive: true });
await writeFile(destination, `${JSON.stringify(groups, null, 2)}\n`);
console.log(`Generated ${groups.length} emoji groups.`);
