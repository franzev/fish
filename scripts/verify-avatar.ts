import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("Missing Supabase environment variables. Run the local stack and seed first.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});
let failures = 0;

function report(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures += 1;
}

async function signIn(email: string, password: string) {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { persistSession: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function verifyForRole(email: string, password: string, label: string) {
  const client = await signIn(email, password);
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error(`No user for ${email}`);
  await admin.from("avatar_uploads").delete().eq("user_id", userId);

  const firstId = crypto.randomUUID();
  const first = await client.rpc("initialize_avatar_upload", {
    p_client_upload_id: firstId,
    p_original_name: "avatar.jpg",
    p_source_mime_type: "image/jpeg",
    p_source_byte_size: 1024,
  });
  report(`${label} can initialize`, !first.error && Boolean(first.data), first.error?.message);

  const second = await client.rpc("initialize_avatar_upload", {
    p_client_upload_id: crypto.randomUUID(),
    p_original_name: "avatar.png",
    p_source_mime_type: "image/png",
    p_source_byte_size: 2048,
  });
  report(`${label} can replace pending selection`, !second.error, second.error?.message);

  const firstRow = Array.isArray(first.data) ? first.data[0] : first.data;
  if (firstRow?.id) {
    const stale = await admin.from("avatar_uploads").select("status")
      .eq("id", firstRow.id).single();
    report(`${label} supersedes stale upload`, stale.data?.status === "superseded");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const additional = await client.rpc("initialize_avatar_upload", {
      p_client_upload_id: crypto.randomUUID(),
      p_original_name: "avatar.webp",
      p_source_mime_type: "image/webp",
      p_source_byte_size: 1024,
    });
    report(`${label} can initialize rate-limit fixture ${attempt + 1}`, !additional.error, additional.error?.message);
  }

  const idempotentRetry = await client.rpc("initialize_avatar_upload", {
    p_client_upload_id: firstId,
    p_original_name: "avatar.jpg",
    p_source_mime_type: "image/jpeg",
    p_source_byte_size: 1024,
  });
  report(
    `${label} can retry an existing request at the rate limit`,
    !idempotentRetry.error && Boolean(idempotentRetry.data),
    idempotentRetry.error?.message
  );

  const rateLimited = await client.rpc("initialize_avatar_upload", {
    p_client_upload_id: crypto.randomUUID(),
    p_original_name: "avatar.jpg",
    p_source_mime_type: "image/jpeg",
    p_source_byte_size: 1024,
  });
  report(`${label} rate-limits a new sixth request`, Boolean(rateLimited.error));

  const directUpdate = await client.from("profiles").update({
    avatar_path: `${userId}/forged/avatar.webp`,
    avatar_thumbnail_path: `${userId}/forged/thumbnail.webp`,
    avatar_updated_at: new Date().toISOString(),
  }).eq("id", userId);
  report(`${label} cannot forge avatar pointers`, Boolean(directUpdate.error));

  await admin.from("avatar_uploads").delete().eq("user_id", userId);
}

async function verifyExpiredCleanup() {
  const client = await signIn("client1@fish.dev", "fish-client-dev");
  const { data: userData } = await client.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("No client user for cleanup verification");

  const uploadId = crypto.randomUUID();
  const stagingPath = `${userId}/${uploadId}/staging.webp`;
  const stored = await admin.storage.from("avatars").upload(
    stagingPath,
    new Blob([new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])], {
      type: "image/webp",
    }),
    { contentType: "image/webp", upsert: false }
  );
  if (stored.error) throw stored.error;

  const inserted = await admin.from("avatar_uploads").insert({
    id: uploadId,
    user_id: userId,
    client_upload_id: `cleanup-${uploadId}`,
    original_name: "cleanup.webp",
    source_mime_type: "image/webp",
    source_byte_size: 12,
    status: "cancelled",
    staging_path: stagingPath,
    expires_at: new Date(Date.now() - 60_000).toISOString(),
  });
  if (inserted.error) throw inserted.error;

  const cleanup = await admin.functions.invoke<{
    rowsRemoved: number;
    objectsRemoved: number;
  }>("avatar-command", { body: { action: "cleanup-expired" } });
  report("expired cleanup command succeeds", !cleanup.error, cleanup.error?.message);

  const row = await admin.from("avatar_uploads").select("id").eq("id", uploadId).maybeSingle();
  const object = await admin.storage.from("avatars").download(stagingPath);
  report("expired cleanup removes its tracking row", !row.error && row.data === null, row.error?.message);
  report("expired cleanup removes its storage object", Boolean(object.error), object.error?.message);

  await admin.storage.from("avatars").remove([stagingPath]);
  await admin.from("avatar_uploads").delete().eq("id", uploadId);
}

const bucket = await admin.storage.getBucket("avatars");
report("avatar bucket is private", bucket.data?.public === false, bucket.error?.message);

const anonymous = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false } });
const anonymousResolve = await anonymous.rpc("resolve_avatar_paths", {
  p_profile_ids: [],
  p_variant: "thumbnail",
});
report("signed-out avatar resolution is denied", Boolean(anonymousResolve.error));

await verifyForRole("client1@fish.dev", "fish-client-dev", "client");
await verifyForRole("coach@fish.dev", "fish-coach-dev", "coach");
if (process.argv.includes("--edge")) await verifyExpiredCleanup();

if (failures > 0) {
  console.error(`${failures} avatar verification check(s) failed.`);
  process.exit(1);
}
console.log("Avatar verification passed.");
