import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(process.cwd(), "../..");
const migration = readFileSync(
  join(repositoryRoot, "supabase/migrations/0039_friend_call_chat.sql"),
  "utf8"
);
const profileMigration = readFileSync(
  join(repositoryRoot, "supabase/migrations/0040_friend_profile_visibility.sql"),
  "utf8"
);
const hardeningMigrationPath = join(
  repositoryRoot,
  "supabase/migrations/0042_direct_conversation_security.sql"
);

describe("friend call chat boundary", () => {
  it("provisions a direct conversation for every accepted friendship", () => {
    expect(migration).toContain("ensure_friend_conversation_trigger");
    expect(migration).toContain("from public.friendships friendship");
    expect(migration).toContain("conversations_client_coach_unique");
  });

  it("keeps friend conversations behind active relationship checks", () => {
    expect(migration).toContain("private.are_friends");
    expect(migration).toContain("private.is_blocked_pair");
    expect(migration).toContain("private.is_user_conversation_member");
  });

  it("replaces whole-row friend profile access with a safe direct-chat projection", () => {
    expect(profileMigration).toContain('create policy "friends read each other"');
    expect(existsSync(hardeningMigrationPath)).toBe(true);

    const hardeningMigration = readFileSync(hardeningMigrationPath, "utf8");
    expect(hardeningMigration).toContain(
      'drop policy if exists "friends read each other" on public.profiles'
    );
    expect(hardeningMigration).toContain(
      "create or replace function public.list_direct_conversation_previews()"
    );
    expect(hardeningMigration).not.toMatch(/\bemail\b/i);
  });

  it("excludes direct attention after the relationship stops granting membership", () => {
    expect(existsSync(hardeningMigrationPath)).toBe(true);

    const hardeningMigration = readFileSync(hardeningMigrationPath, "utf8");
    expect(hardeningMigration).toContain(
      "and private.is_conversation_member(conversation.id)"
    );
  });
});
