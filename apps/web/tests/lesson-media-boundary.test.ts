import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repositoryRoot = join(process.cwd(), "../..");

describe("scheduled lesson media boundary", () => {
  it("keeps setup checks private, scoped, short-lived, and booking-authorized", () => {
    const source = readFileSync(
      join(repositoryRoot, "supabase/functions/call-command/index.ts"),
      "utf8"
    );
    expect(source).toContain('action: z.literal("checkMedia")');
    expect(source).toContain('"authorize_lesson_media_check"');
    expect(source).toContain("canSubscribe: false");
    expect(source).toContain('ttl: "2m"');
    expect(source).not.toMatch(/checkMedia[\s\S]{0,800}insert\([^)]*calls/);

    const migration = readFileSync(
      join(repositoryRoot, "supabase/migrations/0038_lesson_calls.sql"),
      "utf8"
    );
    expect(migration).toContain("private.lesson_media_check_attempts");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain(") >= 10 then");
  });

  it("authorizes real calls through the booking and environment join window", () => {
    const migration = readFileSync(
      join(repositoryRoot, "supabase/migrations/0041_multiple_lesson_bookings.sql"),
      "utf8"
    );
    const command = readFileSync(
      join(repositoryRoot, "supabase/functions/call-command/index.ts"),
      "utf8"
    );
    expect(migration).toContain("v_user_id not in (v_slot.coach_id, v_slot.booked_by_client_id)");
    expect(migration).toContain("p_join_window_minutes smallint");
    expect(migration).toContain("make_interval(mins => p_join_window_minutes)");
    expect(migration).toContain("now() >= v_slot.ends_at");
    expect(migration).toContain("public.initiate_call(");
    expect(command).toContain('Deno.env.get("LESSON_JOIN_WINDOW_MINUTES")');
    expect(command).toContain("p_join_window_minutes: configuredJoinWindowMinutes");
  });
});
