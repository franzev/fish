// Authenticated push-device contract checks. This exercises the SQL RPCs with
// real user sessions, including standard/VoIP coexistence and takeover guards.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  throw new Error("Missing local Supabase environment; run supabase start first.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function signIn(email: string, password: string) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

let failures = 0;
function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function main() {
  const first = await signIn("client1@fish.dev", "fish-client-dev");
  const second = await signIn("client2@fish.dev", "fish-client-dev");
  const installationId = crypto.randomUUID();
  const standardToken = "standard-token-" + crypto.randomUUID();
  const rotatedToken = "rotated-token-" + crypto.randomUUID();
  const voipToken = "voip-token-" + crypto.randomUUID();

  const registerStandard = (client: typeof first, token: string) =>
    client.rpc("register_push_device", {
      p_installation_id: installationId,
      p_provider_installation_id: token,
      p_platform: "ios",
      p_app_version: "1.0",
    });
  const registerVoip = (client: typeof first, token: string) =>
    client.rpc("register_voip_push_device", {
      p_installation_id: installationId,
      p_provider_installation_id: token,
      p_app_version: "1.0",
    });

  let result = await registerStandard(first, standardToken);
  report("standard APNs registration succeeds", !result.error, result.error?.message);
  result = await registerVoip(first, voipToken);
  report("VoIP registration coexists with standard APNs", !result.error, result.error?.message);

  const { data: rows, error: rowsError } = await admin.from("push_devices")
    .select("push_kind, platform, provider_installation_id")
    .eq("installation_id", installationId)
    .is("revoked_at", null);
  report("one installation has two active push kinds", !rowsError && rows?.length === 2, rowsError?.message ?? `got ${rows?.length ?? 0}`);
  report(
    "VoIP registration is iOS-only",
    rows?.some((row) => row.push_kind === "voip" && row.platform === "ios") === true,
  );

  const { data: hidden, error: hiddenError } = await first.from("push_devices").select("id");
  report("signed-in clients cannot read push device rows", Boolean(hiddenError) || (hidden?.length ?? 0) === 0, hiddenError?.message);

  result = await registerStandard(first, rotatedToken);
  report("standard token rotation succeeds", !result.error, result.error?.message);
  const { data: rotated } = await admin.from("push_devices")
    .select("push_kind, provider_installation_id, revoked_at")
    .eq("installation_id", installationId)
    .order("push_kind");
  report(
    "rotation leaves one active standard token and keeps VoIP active",
    rotated?.filter((row) => row.revoked_at === null).length === 2 &&
      rotated.some((row) => row.push_kind === "standard" && row.provider_installation_id === rotatedToken),
  );

  result = await registerVoip(second, "other-voip-token-" + crypto.randomUUID());
  report("another account cannot take over an active installation", Boolean(result.error));

  result = await registerStandard(second, voipToken);
  report("another account cannot take over an active provider token", Boolean(result.error));

  result = await first.rpc("unregister_voip_push_device", { p_installation_id: installationId });
  report("VoIP unregistration succeeds", !result.error, result.error?.message);
  result = await first.rpc("unregister_push_device", { p_installation_id: installationId });
  report("standard unregistration succeeds", !result.error, result.error?.message);
  const { data: remaining } = await admin.from("push_devices")
    .select("id")
    .eq("installation_id", installationId)
    .is("revoked_at", null);
  report("sign-out cleanup revokes both kinds", (remaining?.length ?? 0) === 0);

  if (failures) process.exitCode = 1;
  else console.log("All push-device assertions passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
