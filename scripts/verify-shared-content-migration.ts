import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Client = SupabaseClient;
const NORMALIZED_FIELDS = [
  "item_id",
  "conversation_id",
  "source_message_id",
  "sender_id",
  "source_created_at",
  "source_rank",
  "category",
  "kind",
  "attachment_id",
  "attachment_original_name",
  "attachment_mime_type",
  "attachment_byte_size",
  "attachment_width",
  "attachment_height",
  "attachment_display_path",
  "attachment_thumbnail_path",
  "duration_ms",
  "gif_provider",
  "gif_provider_content_id",
  "gif_title",
  "gif_description",
  "sticker_id",
  "link_url",
  "link_hostname",
  "link_title",
  "link_description",
  "link_site_name",
  "can_delete",
  "can_export",
] as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
  console.error("SETUP_REQUIRED: local Supabase credentials are missing.");
  process.exit(1);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let failures = 0;

function report(name: string, ok: boolean, detail?: string): void {
  const safeDetail = detail ? ` (${detail.replace(/[^a-zA-Z0-9_.:=+ -]/g, "")})` : "";
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${safeDetail}`);
  if (!ok) failures += 1;
}

function errorCode(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const candidate = value as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof candidate.code === "string" && candidate.code.length < 80) return candidate.code;
  if (typeof candidate.status === "number") return `http_${candidate.status}`;
  if (typeof candidate.name === "string" && candidate.name.length < 80) return candidate.name;
  return "rejected";
}

function localMigration(command: string[]): void {
  try {
    execFileSync("supabase", command, {
      cwd: process.cwd(),
      stdio: "ignore",
      timeout: 180_000,
    });
  } catch {
    throw new Error("local_migration_transition_failed");
  }
}

function ids(rows: Row[] | null): string[] {
  return (rows ?? []).map((row) => String(row.id ?? row.message_id ?? ""));
}

function hasExactNormalizedShape(row: Row): boolean {
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...NORMALIZED_FIELDS].sort());
}

async function signIn(email: string, password: string): Promise<Client> {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error("fixture_sign_in_failed");
  return client;
}

async function main(): Promise<void> {
  if (!supabaseUrl!.startsWith("http://127.0.0.1") && !supabaseUrl!.startsWith("http://localhost")) {
    console.error("SETUP_REQUIRED: this regression only runs against local Supabase.");
    process.exitCode = 2;
    return;
  }

  const prefix = `migration-regression-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const password = "fish-shared-content-migration";
  const coachEmail = `${prefix}-coach@fish.dev`;
  const ownerEmail = `${prefix}-owner@fish.dev`;
  let coachId = "";
  let ownerId = "";
  let conversationId = "";
  let ownerClient: Client | null = null;

  try {
    localMigration(["db", "reset", "--local", "--version", "0061", "--no-seed", "--yes"]);
    report("pre_0062_schema", true, "0061");

    const coach = await admin.auth.admin.createUser({
      email: coachEmail,
      password,
      email_confirm: true,
    });
    const owner = await admin.auth.admin.createUser({
      email: ownerEmail,
      password,
      email_confirm: true,
    });
    if (coach.error || !coach.data.user || owner.error || !owner.data.user) {
      throw new Error("fixture_identity_setup_failed");
    }
    coachId = coach.data.user.id;
    ownerId = owner.data.user.id;

    const promoted = await admin.from("profiles").update({ role: "coach" }).eq("id", coachId);
    if (promoted.error) throw new Error("fixture_coach_setup_failed");

    const assignment = await admin.from("coach_clients").insert({ coach_id: coachId, client_id: ownerId });
    if (assignment.error) throw new Error("fixture_assignment_setup_failed");

    const conversation = await admin.from("conversations").insert({
      coach_id: coachId,
      client_id: ownerId,
    }).select("id").single();
    if (conversation.error || !conversation.data) throw new Error("fixture_conversation_setup_failed");
    conversationId = conversation.data.id;

    const timestamps = {
      olderLive: "2026-01-01T00:00:01.000Z",
      olderDeleted: "2026-01-01T00:00:02.000Z",
      target: "2026-01-01T00:00:03.000Z",
      newerDeleted: "2026-01-01T00:00:04.000Z",
      newerLive: "2026-01-01T00:00:05.000Z",
    };
    const olderLiveId = randomUUID();
    const olderDeletedId = randomUUID();
    const targetId = randomUUID();
    const newerDeletedId = randomUUID();
    const newerLiveId = randomUUID();
    const deletedAt = "2026-01-02T00:00:00.000Z";

    const messages = await admin.from("messages").insert([
      {
        id: olderLiveId,
        conversation_id: conversationId,
        sender_id: ownerId,
        sender_role: "client",
        body: "older live",
        client_request_id: `${prefix}-older-live`,
        created_at: timestamps.olderLive,
      },
      {
        id: olderDeletedId,
        conversation_id: conversationId,
        sender_id: ownerId,
        sender_role: "client",
        body: "",
        client_request_id: `${prefix}-older-deleted`,
        created_at: timestamps.olderDeleted,
        deleted_at: deletedAt,
      },
      {
        id: targetId,
        conversation_id: conversationId,
        sender_id: ownerId,
        sender_role: "client",
        body: "target message",
        client_request_id: `${prefix}-target`,
        created_at: timestamps.target,
      },
      {
        id: newerDeletedId,
        conversation_id: conversationId,
        sender_id: ownerId,
        sender_role: "client",
        body: "",
        client_request_id: `${prefix}-newer-deleted`,
        created_at: timestamps.newerDeleted,
        deleted_at: deletedAt,
      },
      {
        id: newerLiveId,
        conversation_id: conversationId,
        sender_id: ownerId,
        sender_role: "client",
        body: "newer live",
        client_request_id: `${prefix}-newer-live`,
        created_at: timestamps.newerLive,
      },
    ]);
    if (messages.error) throw new Error("fixture_message_setup_failed");

    const attachment = await admin.from("message_attachments").insert({
      id: randomUUID(),
      conversation_id: conversationId,
      message_id: olderDeletedId,
      uploader_id: ownerId,
      kind: "file",
      status: "ready",
      client_upload_id: `${prefix}-legacy-attachment`,
      position: 0,
      staging_path: `${prefix}/staging.pdf`,
      display_path: `${prefix}/display.pdf`,
      thumbnail_path: null,
      original_name: "legacy.pdf",
      source_mime_type: "application/pdf",
      stored_mime_type: "application/pdf",
      source_byte_size: 1,
      stored_byte_size: 1,
      width: null,
      height: null,
      integrity_status: "legacy_unverified",
      scan_status: "legacy_accepted",
      delete_requested_at: null,
    }).select("id, delete_requested_at").single();
    if (attachment.error || !attachment.data) throw new Error("fixture_attachment_setup_failed");
    const legacyAttachmentId = String(attachment.data.id);

    const voiceAttachment = await admin.from("message_attachments").insert({
      id: randomUUID(),
      conversation_id: conversationId,
      message_id: targetId,
      uploader_id: ownerId,
      kind: "file",
      status: "ready",
      client_upload_id: `${prefix}-voice-attachment`,
      position: 0,
      staging_path: `${prefix}/voice-staging.m4a`,
      display_path: `${prefix}/voice-display.m4a`,
      thumbnail_path: null,
      original_name: "voice.m4a",
      source_mime_type: "audio/mp4",
      stored_mime_type: "audio/mp4",
      source_byte_size: 1,
      stored_byte_size: 1,
      width: null,
      height: null,
      integrity_status: "legacy_unverified",
      scan_status: "legacy_accepted",
      delete_requested_at: null,
    }).select("id").single();
    if (voiceAttachment.error || !voiceAttachment.data) throw new Error("fixture_voice_attachment_setup_failed");
    const voiceAttachmentId = String(voiceAttachment.data.id);

    const unsafeLink = await admin.from("message_link_previews").insert({
      message_id: targetId,
      url: "http://127.0.0.1:54321/private",
      hostname: "127.0.0.1",
      title: "unproven",
    }).select("message_id").single();
    if (unsafeLink.error || !unsafeLink.data) throw new Error("fixture_link_setup_failed");
    report("legacy_unsafe_link_fixture", true, "stored");

    localMigration(["migration", "up", "--local"]);
    report("post_0063_schema", true, "latest");

    ownerClient = await signIn(ownerEmail, password);

    const legacyDuration = await admin
      .from("message_attachments")
      .select("duration_ms")
      .eq("id", voiceAttachmentId)
      .single();
    report(
      "migration adds nullable duration metadata without rewriting legacy voice rows",
      !legacyDuration.error && legacyDuration.data?.duration_ms === null,
      errorCode(legacyDuration.error),
    );

    const legacyVoiceList = await ownerClient.rpc("list_conversation_shared_content", {
      p_conversation_id: conversationId,
      p_category: "voice",
      p_before_created_at: null,
      p_before_message_id: null,
      p_before_source_rank: null,
      p_before_item_id: null,
      p_limit: 40,
    });
    const legacyVoiceRows = (legacyVoiceList.data ?? []) as Row[];
    report(
      "migrated voice RPC exposes one exact 29-field legacy row",
      !legacyVoiceList.error
        && legacyVoiceRows.length === 1
        && legacyVoiceRows[0]!.duration_ms === null
        && legacyVoiceRows.every(hasExactNormalizedShape),
      `${errorCode(legacyVoiceList.error)}:fields=${Object.keys(legacyVoiceRows[0] ?? {}).length}`,
    );

    const trustedDurationWrite = await admin
      .from("message_attachments")
      .update({ duration_ms: 90_500 } as never)
      .eq("id", voiceAttachmentId)
      .select("id")
      .maybeSingle();
    report(
      "migration accepts trusted non-negative duration metadata",
      !trustedDurationWrite.error && trustedDurationWrite.data?.id === voiceAttachmentId,
      errorCode(trustedDurationWrite.error),
    );
    const durationVoiceList = await ownerClient.rpc("list_conversation_shared_content", {
      p_conversation_id: conversationId,
      p_category: "voice",
      p_before_created_at: null,
      p_before_message_id: null,
      p_before_source_rank: null,
      p_before_item_id: null,
      p_limit: 40,
    });
    const durationVoiceRows = (durationVoiceList.data ?? []) as Row[];
    report(
      "authorized migrated RPC returns trusted duration in the normalized row",
      !durationVoiceList.error
        && durationVoiceRows.length === 1
        && durationVoiceRows[0]!.duration_ms === 90_500
        && durationVoiceRows.every(hasExactNormalizedShape),
      errorCode(durationVoiceList.error),
    );

    const negativeDurationWrite = await admin
      .from("message_attachments")
      .update({ duration_ms: -1 } as never)
      .eq("id", voiceAttachmentId)
      .select("id")
      .maybeSingle();
    report(
      "migration rejects negative duration metadata with a database check",
      errorCode(negativeDurationWrite.error) === "23514",
      errorCode(negativeDurationWrite.error),
    );
    const memberDurationWrite = await ownerClient
      .from("message_attachments")
      .update({ duration_ms: 1 } as never)
      .eq("id", voiceAttachmentId)
      .select("id");
    report(
      "member cannot mutate trusted duration metadata after migration",
      !memberDurationWrite.error && (memberDurationWrite.data?.length ?? 0) === 0,
      errorCode(memberDurationWrite.error),
    );

    const direct = await ownerClient
      .from("message_link_previews")
      .select("message_id")
      .eq("message_id", targetId);
    report("unsafe_link_direct_member_read", !direct.error && (direct.data?.length ?? 0) === 0, errorCode(direct.error));

    const listed = await ownerClient.rpc("list_conversation_shared_content", {
      p_conversation_id: conversationId,
      p_category: "links",
      p_before_created_at: null,
      p_before_message_id: null,
      p_before_source_rank: null,
      p_before_item_id: null,
      p_limit: 40,
    });
    const listedRows = (listed.data ?? []) as Row[];
    report("unsafe_link_shared_content_projection", !listed.error && listedRows.length === 0, errorCode(listed.error));

    const categories = await ownerClient.rpc("list_conversation_shared_content_categories", {
      p_conversation_id: conversationId,
    });
    const categoryNames = ((categories.data ?? []) as Row[]).map((row) => String(row.category));
    report("unsafe_link_category_projection", !categories.error && !categoryNames.includes("links"), errorCode(categories.error));

    const marker = await admin
      .from("message_attachments")
      .select("delete_requested_at, cleanup_claimed_at")
      .eq("id", legacyAttachmentId)
      .single();
    report(
      "legacy_tombstoned_attachment_marker",
      !marker.error && marker.data?.delete_requested_at !== null,
      errorCode(marker.error),
    );

    const claimed = await admin.rpc("claim_deleted_chat_attachment_cleanup", {
      p_claim_token: randomUUID(),
      p_limit: 10,
    });
    const claimedRows = (claimed.data ?? []) as Row[];
    report(
      "legacy_tombstoned_attachment_claimable",
      !claimed.error && ids(claimedRows).includes(legacyAttachmentId),
      `${errorCode(claimed.error)}:count=${claimedRows.length}`,
    );

    const context = await ownerClient.rpc("list_conversation_message_context", {
      p_conversation_id: conversationId,
      p_message_id: targetId,
      p_before: 1,
      p_after: 1,
    });
    const contextRows = (context.data ?? []) as Row[];
    const contextIds = contextRows.map((row) => String(row.message_id));
    const gapFlags = contextRows.every(
      (row) => row.has_older_gap === false && row.has_newer_gap === false,
    );
    report(
      "context_excludes_deleted_neighbors",
      !context.error && JSON.stringify(contextIds) === JSON.stringify([olderLiveId, targetId, newerLiveId]),
      errorCode(context.error),
    );
    report("context_gap_flags_use_live_rows", !context.error && gapFlags, errorCode(context.error));

    report("migration_regression", failures === 0);
    if (failures > 0) process.exitCode = 1;
  } catch (error) {
    report("migration_regression", false, errorCode(error));
    process.exitCode = 1;
  } finally {
    if (conversationId) {
      await admin.from("conversations").delete().eq("id", conversationId);
    }
    if (ownerClient) await ownerClient.auth.signOut().catch(() => undefined);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
    if (coachId) await admin.auth.admin.deleteUser(coachId);
  }
}

await main();
