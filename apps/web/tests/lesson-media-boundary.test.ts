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

  it("authorizes real calls through the booking and server-side join window", () => {
    const source = readFileSync(
      join(repositoryRoot, "supabase/migrations/0038_lesson_calls.sql"),
      "utf8"
    );
    expect(source).toContain("references public.lesson_slots (id)");
    expect(source).toContain("v_user_id not in (v_slot.coach_id, v_slot.booked_by_client_id)");
    expect(source).toContain("v_slot.starts_at - interval '10 minutes'");
    expect(source).toContain("now() >= v_slot.ends_at");
    expect(source).toContain("public.initiate_call(");
  });
});
