import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chatStickerIds } from "@fish/core/chat";
import { aquaticStickers } from "@/features/chat/components/sticker-picker/sticker-catalog";
import { describe, expect, it } from "vitest";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(testDirectory, "../../..");
const stickerDirectory = join(repositoryRoot, "apps/web/public/stickers/aquatic");

function stickerIdsIn(source: string): string[] {
  return [...new Set(source.match(/aquatic-[a-z-]+/g) ?? [])].sort();
}

describe("sticker catalog boundaries", () => {
  const contractIds = [...chatStickerIds].sort();

  it("keeps the UI, Edge Function, and database allowlists in sync", () => {
    const edgeFunction = readFileSync(
      join(repositoryRoot, "supabase/functions/send-message/index.ts"),
      "utf8"
    );
    const migration = readFileSync(
      join(repositoryRoot, "supabase/migrations/0030_chat_stickers.sql"),
      "utf8"
    );

    expect(aquaticStickers.map((sticker) => sticker.id).sort()).toEqual(contractIds);
    expect(stickerIdsIn(edgeFunction)).toEqual(contractIds);
    expect(stickerIdsIn(migration)).toEqual(contractIds);
  });

  it("has exactly one distinct bundled asset for every catalog entry", () => {
    const assetNames = readdirSync(stickerDirectory)
      .filter((name) => name.endsWith(".webp"))
      .sort();
    const catalogNames = aquaticStickers
      .map((sticker) => sticker.src.split("/").at(-1))
      .sort();
    const hashes = assetNames.map((name) =>
      createHash("sha256")
        .update(readFileSync(join(stickerDirectory, name)))
        .digest("hex")
    );

    expect(assetNames).toEqual(catalogNames);
    expect(new Set(hashes).size).toBe(assetNames.length);
  });
});
