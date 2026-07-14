import { readFileSync } from "node:fs";
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

  it("lets direct chat hydrate the accepted friend's safe profile", () => {
    expect(profileMigration).toContain('create policy "friends read each other"');
    expect(profileMigration).toContain("private.are_friends");
    expect(profileMigration).toContain("private.is_blocked_pair");
  });
});
