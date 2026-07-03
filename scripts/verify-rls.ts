// Scripted RLS/escalation boundary check (DB-03, DB-04) — review MEDIUM: a service-role
// Studio session silently bypasses RLS and proves nothing about the real boundary. Every
// assertion here logs in with the PUBLISHABLE (anon) key via signInWithPassword(), so RLS
// is genuinely in force for every query. Exits non-zero on any failure — a real gate, not
// advisory.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !publishableKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Run `supabase start`, then copy apps/web/.env.example to apps/web/.env.local and fill it from `supabase status`.",
  );
  process.exit(1);
}

// Same fixed dev credentials seeded by scripts/seed.ts (D-10). Run `pnpm seed` first.
const coach = { email: "coach@fish.dev", password: "fish-coach-dev" };
const client1 = { email: "client1@fish.dev", password: "fish-client-dev" };

let failures = 0;

function report(label: string, ok: boolean, detail?: string): void {
  const line = `${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`;
  console.log(line);
  if (!ok) failures += 1;
}

/** Anon-key client per seeded user — this session IS subject to RLS, unlike the admin key. */
async function signInAs(email: string, password: string) {
  const supabase = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`signInWithPassword(${email}) failed: ${error.message}`);
  return supabase;
}

/** Any 42P17 (recursion) anywhere is a hard failure regardless of which assertion hit it. */
function checkNoRecursion(label: string, error: { code?: string; message: string } | null): void {
  if (error?.code === "42P17") {
    report(`${label}: no recursion error`, false, `42P17 — ${error.message}`);
  }
}

async function checkClientBoundary(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data, error } = await supabase.from("profiles").select("*");
  checkNoRecursion("DB-03 client boundary", error);
  if (error) {
    report("DB-03 client boundary: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  const onlyOwnRow = rows.length === 1;
  report("DB-03 client boundary: sees exactly one row (own)", onlyOwnRow, `got ${rows.length} rows`);
  const otherEmails = ["client2@fish.dev", "client3@fish.dev", "coach@fish.dev"];
  const leaked = rows.some((row) => otherEmails.includes((row as { display_name?: string }).display_name ?? ""));
  report("DB-03 client boundary: no other accounts visible", !leaked);
}

async function checkCoachBoundary(): Promise<void> {
  const supabase = await signInAs(coach.email, coach.password);
  const { data, error } = await supabase.from("profiles").select("*");
  checkNoRecursion("DB-03 coach boundary", error);
  if (error) {
    report("DB-03 coach boundary: select succeeds", false, error.message);
    return;
  }
  const rows = data ?? [];
  // Own row + 3 assigned clients = 4.
  report("DB-03 coach boundary: sees own row plus 3 assigned clients", rows.length === 4, `got ${rows.length} rows`);
  const roles = rows.map((row) => (row as { role?: string }).role);
  const coachCount = roles.filter((role) => role === "coach").length;
  const clientCount = roles.filter((role) => role === "client").length;
  report("DB-03 coach boundary: exactly one coach row, three client rows", coachCount === 1 && clientCount === 3, `coach=${coachCount} client=${clientCount}`);
}

async function checkEscalationRejected(): Promise<void> {
  const supabase = await signInAs(client1.email, client1.password);
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    report("DB-04 escalation: resolve own user id", false, userError?.message);
    return;
  }
  const ownId = userData.user.id;

  const { error: escalationError } = await supabase.from("profiles").update({ role: "coach" }).eq("id", ownId);
  checkNoRecursion("DB-04 escalation attempt", escalationError);
  report("DB-04 escalation: self-promotion to coach is rejected", !!escalationError, escalationError ? escalationError.message : "update succeeded (should have failed)");

  const { error: safeUpdateError } = await supabase
    .from("profiles")
    .update({ display_name: "Alex Rivera" })
    .eq("id", ownId);
  checkNoRecursion("DB-04 safe-field update", safeUpdateError);
  report("DB-04 safe-field update (display_name) succeeds", !safeUpdateError, safeUpdateError?.message);
}

async function main(): Promise<void> {
  await checkClientBoundary();
  await checkCoachBoundary();
  await checkEscalationRejected();

  console.log(`\n${failures === 0 ? "All assertions passed." : `${failures} assertion(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
