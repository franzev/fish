import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;
type Client = SupabaseClient;
type Cursor = {
  sourceCreatedAt: string;
  sourceMessageId: string;
  sourceRank: number;
  itemId: string;
};
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
type NormalizedField = (typeof NORMALIZED_FIELDS)[number];
type NormalizedValue = string | number | boolean | null;
type ExpectedItem = Record<NormalizedField, NormalizedValue>;
type Target = "local" | "linked";
type TargetConfig = {
  target: Target;
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};

function parseTarget(args: string[]): Target {
  let target: Target = "local";
  let seen = false;
  for (const arg of args) {
    if (!arg.startsWith("--target=")) {
      console.error("SETUP_REQUIRED: only --target=local or --target=linked is supported.");
      process.exit(2);
    }
    if (seen) {
      console.error("SETUP_REQUIRED: duplicate target flags are not allowed.");
      process.exit(2);
    }
    seen = true;
    const value = arg.slice("--target=".length);
    if (value !== "local" && value !== "linked") {
      console.error("SETUP_REQUIRED: target must be local or linked.");
      process.exit(2);
    }
    target = value;
  }
  return target;
}

function resolveTarget(target: Target): TargetConfig {
  const names = target === "local"
    ? ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const
    : ["SUPABASE_LINKED_URL", "SUPABASE_LINKED_PUBLISHABLE_KEY", "SUPABASE_LINKED_SERVICE_ROLE_KEY"] as const;
  const [urlName, publishableName, serviceRoleName] = names;
  const url = process.env[urlName];
  const publishableKey = process.env[publishableName];
  const serviceRoleKey = process.env[serviceRoleName];
  if (!url || !publishableKey || !serviceRoleKey) {
    console.error(`SETUP_REQUIRED: ${target} target requires ${urlName}, ${publishableName}, and ${serviceRoleName}.`);
    process.exit(1);
  }
  if (target === "linked" && !process.env.SUPABASE_ACCESS_TOKEN) {
    console.error("SETUP_REQUIRED: linked target requires SUPABASE_ACCESS_TOKEN.");
    process.exit(1);
  }
  return { target, url, publishableKey, serviceRoleKey };
}

const targetConfig = resolveTarget(parseTarget(process.argv.slice(2)));
const { target, url: supabaseUrl, publishableKey, serviceRoleKey } = targetConfig;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
let failures = 0;
let setupFailure = false;

function normalized(values: Partial<ExpectedItem>): ExpectedItem {
  const row = Object.fromEntries(NORMALIZED_FIELDS.map((field) => [field, null])) as ExpectedItem;
  return { ...row, ...values };
}

function report(name: string, ok: boolean, detail?: string): void {
  const safeDetail = detail ? ` (${detail.replace(/[^a-zA-Z0-9_.:=+ -]/g, "")})` : "";
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}${safeDetail}`);
  if (!ok) failures += 1;
}

function codeOf(value: unknown): string {
  if (!value || typeof value !== "object") return "unknown";
  const candidate = value as { code?: unknown; status?: unknown; name?: unknown };
  if (typeof candidate.code === "string" && candidate.code.length < 80) return candidate.code;
  if (typeof candidate.status === "number") return `http_${candidate.status}`;
  if (typeof candidate.name === "string" && candidate.name.length < 80) return candidate.name;
  return "rejected";
}

function requireRows<T extends Row>(data: T[] | null, error: unknown): T[] {
  if (error || !data) throw new Error("fixture_setup_failed");
  return data;
}

async function signIn(email: string, password: string): Promise<Client> {
  const client = createClient(supabaseUrl!, publishableKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw new Error("required_seed_identity_unavailable");
  return client;
}

async function invokeList(client: Client, conversationId: string, options: {
  category?: string | null;
  cursor?: Cursor | null;
  limit?: number;
}) {
  const cursor = options.cursor ?? null;
  return client.rpc("list_conversation_shared_content", {
    p_conversation_id: conversationId,
    p_category: options.category ?? null,
    p_before_created_at: cursor?.sourceCreatedAt ?? null,
    p_before_message_id: cursor?.sourceMessageId ?? null,
    p_before_source_rank: cursor?.sourceRank ?? null,
    p_before_item_id: cursor?.itemId ?? null,
    p_limit: options.limit ?? 40,
  });
}

function itemId(row: Row): string {
  return String(row.item_id ?? "");
}

function cursorFromRow(row: Row): Cursor {
  return {
    sourceCreatedAt: String(row.source_created_at),
    sourceMessageId: String(row.source_message_id),
    sourceRank: Number(row.source_rank),
    itemId: itemId(row),
  };
}

function sameIds(actual: string[], expected: string[]): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function compareNormalizedRows(actual: Row[], expected: ExpectedItem[]): { ok: boolean; field?: NormalizedField } {
  if (actual.length !== expected.length) return { ok: false, field: "item_id" };
  for (let index = 0; index < expected.length; index += 1) {
    const actualRow = actual[index];
    const expectedRow = expected[index];
    for (const field of NORMALIZED_FIELDS) {
      if (!(field in actualRow)) return { ok: false, field };
      const actualValue = actualRow[field] === undefined ? null : actualRow[field];
      if (actualValue !== expectedRow[field]) return { ok: false, field };
    }
  }
  return { ok: true };
}

function hasExactNormalizedShape(row: Row): boolean {
  return JSON.stringify(Object.keys(row).sort()) === JSON.stringify([...NORMALIZED_FIELDS].sort());
}

function generatedFunctionArgs(source: string, functionName: string): string {
  const start = source.indexOf(`${functionName}: {`);
  if (start < 0) return "";
  const end = source.indexOf("Returns:", start);
  return end < 0 ? "" : source.slice(start, end);
}

function compareC(left: string, right: string): number {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index]! - rightBytes[index]!;
  }
  return leftBytes.length - rightBytes.length;
}

function compareItems(left: ExpectedItem, right: ExpectedItem): number {
  return compareC(String(right.source_created_at), String(left.source_created_at))
    || compareC(String(right.source_message_id), String(left.source_message_id))
    || Number(right.source_rank) - Number(left.source_rank)
    || compareC(String(right.item_id), String(left.item_id));
}

function runSql(sql: string): string {
  try {
    return execFileSync("supabase", ["db", "query", `--${target}`, "--output-format", "json", sql], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    });
  } catch {
    throw new Error(`${target}_sql_unavailable`);
  }
}

function parseJsonPlan(raw: string): Row {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    throw new Error("explain_json_malformed");
  }
  const candidates = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as Row).rows)
      ? (parsed as Row).rows as unknown[]
      : [parsed];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const row = candidate as Row;
    const planValue = row["QUERY PLAN"];
    if (Array.isArray(planValue) && planValue[0] && typeof planValue[0] === "object") {
      const plan = (planValue[0] as Row).Plan;
      if (plan && typeof plan === "object") return plan as Row;
    }
    if (row.Plan && typeof row.Plan === "object") return row.Plan as Row;
  }
  throw new Error("explain_plan_missing");
}

function planNodes(root: Row): Row[] {
  const nodes: Row[] = [];
  const visit = (node: Row): void => {
    nodes.push(node);
    const children = node.Plans;
    if (Array.isArray(children)) {
      for (const child of children) if (child && typeof child === "object") visit(child as Row);
    }
  };
  visit(root);
  return nodes;
}

type PlanBudget = {
  label: string;
  slots: number;
  branchFactor: number;
  messageRows: number;
  perMessageNode: number;
  sharedBlocks: number;
  expectedRootRows: number;
  requiredIndexes: string[];
};

const pageBudget: PlanBudget = {
  label: "page",
  slots: 40 + 1,
  branchFactor: 8,
  messageRows: (40 + 1) * 8,
  perMessageNode: (40 + 1) * 2,
  sharedBlocks: (40 + 1) * 8,
  expectedRootRows: 40 + 1,
  requiredIndexes: ["messages_shared_content_live_conversation_order_idx", "message_attachments_shared_content_ready_idx"],
};
const categoryBudget: PlanBudget = {
  label: "category",
  slots: 4,
  branchFactor: 8,
  messageRows: 4 * 8,
  perMessageNode: 8,
  sharedBlocks: 4 * 8,
  expectedRootRows: 4,
  requiredIndexes: ["messages_shared_content_live_conversation_order_idx", "message_attachments_shared_content_ready_idx"],
};

function numeric(node: Row, key: string): number {
  const value = node[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function assertPlan(raw: string, budget: PlanBudget): Row {
  const root = parseJsonPlan(raw);
  const nodes = planNodes(root);
  if (numeric(root, "Actual Rows") > budget.expectedRootRows || numeric(root, "Actual Loops") !== 1) {
    throw new Error(`${budget.label}_plan_root_bound`);
  }
  const messageNodes = nodes.filter((node) => node["Relation Name"] === "messages");
  if (!messageNodes.length) throw new Error(`${budget.label}_plan_messages_node_missing`);
  let aggregate = 0;
  let blocks = 0;
  for (const node of nodes) {
    const children = node.Plans;
    if (!Array.isArray(children) || children.length === 0) {
      blocks += numeric(node, "Shared Hit Blocks") + numeric(node, "Shared Read Blocks");
    }
    if (node["Node Type"] === undefined) throw new Error(`${budget.label}_plan_node_type_missing`);
    if (node["Relation Name"] === "messages") {
      if (node["Node Type"] === "Seq Scan") throw new Error(`${budget.label}_plan_messages_seq_scan`);
      if (node["Index Name"] === undefined) throw new Error(`${budget.label}_plan_messages_index_missing`);
      const examined = (numeric(node, "Actual Rows") + numeric(node, "Rows Removed by Filter") + numeric(node, "Rows Removed by Index Recheck")) * numeric(node, "Actual Loops");
      if (examined > budget.perMessageNode || examined >= 1_000) throw new Error(`${budget.label}_plan_message_node_bound:examined=${examined}:node=${String(node["Node Type"])}:index=${String(node["Index Name"] ?? "none")}`);
      aggregate += examined;
    }
  }
  if (aggregate > budget.messageRows || aggregate >= 1_000) throw new Error(`${budget.label}_plan_messages_aggregate_bound`);
  if (blocks > budget.sharedBlocks) {
    const top = nodes
      .map((node) => ({ node, blocks: numeric(node, "Shared Hit Blocks") + numeric(node, "Shared Read Blocks") }))
      .filter((entry) => entry.blocks > 0)
      .sort((left, right) => right.blocks - left.blocks)
      .slice(0, 2)
      .map(({ node, blocks: nodeBlocks }) => `${String(node["Node Type"])}:${String(node["Relation Name"] ?? "cte")}:${nodeBlocks}`)
      .join("+");
    throw new Error(`${budget.label}_plan_shared_blocks_bound:blocks=${blocks}:top=${top}`);
  }
  const indexNames = new Set(nodes.map((node) => String(node["Index Name"] ?? "")));
  if (!budget.requiredIndexes.some((index) => indexNames.has(index)) && budget.label === "page") {
    throw new Error(`${budget.label}_plan_required_index_missing`);
  }
  return root;
}

function planEvidence(root: Row): string {
  const nodes = planNodes(root);
  const nodeTypes = [...new Set(nodes.map((node) => String(node["Node Type"] ?? "missing")))].join(",");
  const indexes = [...new Set(nodes.map((node) => node["Index Name"]).filter((value): value is string => typeof value === "string"))].join(",") || "none";
  return `nodes=${nodeTypes};indexes=${indexes}`;
}

function explainSharedContent(
  conversationId: string,
  viewerId: string,
  category: string | null,
  cursor: Cursor | null,
): Row {
  const quote = (value: string): string => `'${value.replace(/'/g, "''")}'`;
  const categorySql = category === null ? "null" : quote(category);
  const cursorSql = cursor
    ? `${quote(cursor.sourceCreatedAt)}::timestamptz, ${quote(cursor.sourceMessageId)}::uuid, ${cursor.sourceRank}, ${quote(cursor.itemId)}`
    : "null, null, null, null";
  const [createdAt, messageId, rank, itemIdValue] = cursorSql.split(", ").map((value) => value.trim());
  return assertPlan(runSql(`
    explain (analyze, buffers, format json)
    with auth_context as (
      select set_config('request.jwt.claim.sub', ${quote(viewerId)}, false) as ignored
    ), source_messages as materialized (
      select source_message.*
      from auth_context
      cross join lateral (
        select message.*
        from public.messages message
        where message.conversation_id = ${quote(conversationId)}::uuid
          and message.deleted_at is null
          and (${createdAt} is null or (message.created_at, message.id) < (${createdAt}, ${messageId}))
        order by message.created_at desc, message.id desc
        limit ${pageBudget.branchFactor}
      ) source_message
    ), eligible as (
      select message.created_at, message.id as source_message_id, 100 as source_rank,
        ('attachment:' || message.id::text) collate "C" as item_id
      from source_messages message
      cross join lateral (
        select attachment.message_id
        from public.message_attachments attachment
        where attachment.message_id = message.id
          and attachment.conversation_id = ${quote(conversationId)}::uuid
          and attachment.delete_requested_at is null
          and attachment.status = 'ready'
          and attachment.message_id is not null
        order by attachment.position desc, attachment.id desc
        limit ${pageBudget.branchFactor}
      ) attachment
      where ${categorySql} is null or ${categorySql} in ('media', 'files', 'links', 'voice')
    )
    select * from eligible limit ${pageBudget.slots};
  `), pageBudget);
}

async function main(): Promise<void> {
  if (target === "local" && !supabaseUrl!.startsWith("http://127.0.0.1") && !supabaseUrl!.startsWith("http://localhost")) {
    console.error("SETUP_REQUIRED: hosted behavioral verification requires an explicitly provisioned isolated fixture environment.");
    process.exitCode = 2;
    return;
  }
  if (target === "linked") {
    let migrations = "";
    try {
      migrations = execFileSync("supabase", ["migration", "list", "--linked"], {
        cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000,
      });
    } catch {
      console.error("SETUP_REQUIRED: linked migration history could not be inspected.");
      process.exitCode = 2;
      return;
    }
    if (!/0062/.test(migrations)) {
      console.error("SETUP_REQUIRED: linked migration history must include 0062.");
      process.exitCode = 2;
      return;
    }
    console.log("PASS - linked migration history includes 0062");
  }

  const prefix = `shared-content-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const idsToDelete: string[] = [];
  const attachmentIds: string[] = [];
  const storagePaths = new Set<string>();
  const testUserIds: string[] = [];
  const expected: ExpectedItem[] = [];
  const fileExpected: ExpectedItem[] = [];
  const messageCreatedAt = new Map<string, string>();
  const deletedMessageIds: string[] = [];
  let targetConversationId = "";
  let targetChannelId = "";
  let coachId = "";
  let ownerId = "";
  let memberId = "";
  let otherMemberId = "";
  let formerId = "";
  let blockedId = "";
  let otherConversationId = "";
  let safeLinkMessageId = "";
  let senderDeleteMessageId = "";
  let stage = "initialization";
  let ownerEmail = "";
  let coachEmail = "";
  let memberEmail = "";
  let formerEmail = "";
    let blockedEmail = "";

  try {
    const testPassword = "fish-shared-content-dev";
    const createTestUser = async (label: string): Promise<{ id: string; email: string }> => {
      const email = `${prefix}-${label}@fish.dev`;
      const created = await admin.auth.admin.createUser({ email, password: testPassword, email_confirm: true });
      if (created.error || !created.data.user) throw new Error("isolated_identity_setup_failed");
      testUserIds.push(created.data.user.id);
      return { id: created.data.user.id, email };
    };
    const coach = await createTestUser("coach");
    const owner = await createTestUser("owner");
    const member = await createTestUser("member");
    const former = await createTestUser("former");
    const blocked = await createTestUser("blocked");
    const outsiderUser = await createTestUser("outsider");
    const otherMemberUser = await createTestUser("other-member");
    coachId = coach.id;
    ownerId = owner.id;
    memberId = member.id;
    formerId = former.id;
    blockedId = blocked.id;
    coachEmail = coach.email;
    ownerEmail = owner.email;
    memberEmail = member.email;
    formerEmail = former.email;
    blockedEmail = blocked.email;
    const promoted = await admin.from("profiles").update({ role: "coach" }).eq("id", coachId);
    if (promoted.error) throw new Error("isolated_coach_setup_failed");
    const outsiderId = outsiderUser.id;
    otherMemberId = otherMemberUser.id;

    const ownerClient = await signIn(ownerEmail, testPassword);
    const recipient = await signIn(coachEmail, testPassword);
    const memberClient = await signIn(memberEmail, testPassword);
    const formerClient = await signIn(formerEmail, testPassword);
    const blockedClient = await signIn(blockedEmail, testPassword);
    const outsider = await signIn(outsiderUser.email, testPassword);
    const otherMember = await signIn(otherMemberUser.email, testPassword);
    const signedOut = createClient(supabaseUrl!, publishableKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const assignment = await admin.from("coach_clients").upsert(
      { coach_id: coachId, client_id: ownerId },
      { onConflict: "client_id" },
    );
    if (assignment.error) throw new Error("target_assignment_setup_failed");
    const conversationResult = await admin.from("conversations").upsert(
      { coach_id: coachId, client_id: ownerId },
      { onConflict: "client_id,coach_id" },
    ).select("id").single();
    if (conversationResult.error || !conversationResult.data) throw new Error("target_conversation_setup_failed");
    targetConversationId = conversationResult.data.id;
    idsToDelete.push(targetConversationId);

    const otherAssignment = await admin.from("coach_clients").upsert(
      { coach_id: coachId, client_id: otherMemberId },
      { onConflict: "client_id" },
    );
    if (otherAssignment.error) throw new Error("other_assignment_setup_failed");
    const otherConversation = await admin.from("conversations").upsert(
      { coach_id: coachId, client_id: otherMemberId },
      { onConflict: "client_id,coach_id" },
    ).select("id").single();
    if (otherConversation.error || !otherConversation.data) throw new Error("other_conversation_fixture_failed");
    otherConversationId = otherConversation.data.id;

    targetChannelId = randomUUID();
    const channel = await admin.from("channels").insert({
      id: targetChannelId,
      slug: prefix,
      name: "verification room",
      conversation_id: targetConversationId,
    });
    if (channel.error) throw new Error("target_channel_setup_failed");
    const members = await admin.from("channel_members").insert([
      { channel_id: targetChannelId, user_id: ownerId },
      { channel_id: targetChannelId, user_id: coachId },
      { channel_id: targetChannelId, user_id: memberId },
      { channel_id: targetChannelId, user_id: formerId },
      { channel_id: targetChannelId, user_id: blockedId },
    ]);
    if (members.error) throw new Error("target_membership_setup_failed");
    const block = await admin.from("user_blocks").upsert({ blocker_id: blockedId, blocked_id: ownerId });
    if (block.error) throw new Error("blocked_fixture_setup_failed");

    const message = async (senderId: string, senderRole: "client" | "coach", label: string, createdAt: string, extra: Row = {}): Promise<string> => {
      const id = randomUUID();
      const inserted = await admin.from("messages").insert({
        id,
        conversation_id: targetConversationId,
        sender_id: senderId,
        sender_role: senderRole,
        body: `shared-content verifier ${label}`,
        client_request_id: `${prefix}-${label}-${id}`,
        created_at: createdAt,
        ...extra,
      }).select("id,created_at").single();
      if (inserted.error || !inserted.data) throw new Error("message_fixture_insert_failed");
      messageCreatedAt.set(id, String(inserted.data.created_at));
      idsToDelete.push(id);
      return id;
    };

    const attachment = async (messageId: string | null, uploaderId: string, label: string, values: Row): Promise<string> => {
      stage = `attachment-${label}`;
      const id = randomUUID();
      const stagingPath = `${prefix}/${id}/staging`;
      const row = {
        id,
        conversation_id: targetConversationId,
        message_id: messageId,
        uploader_id: uploaderId,
        kind: "file",
        status: "ready",
        client_upload_id: `${prefix}-${label}-${id}`,
        position: 0,
        staging_path: stagingPath,
        original_name: `${label}.pdf`,
        source_mime_type: "application/pdf",
        source_byte_size: 100,
        stored_mime_type: "application/pdf",
        stored_byte_size: 100,
        display_path: `${prefix}/${id}/display.bin`,
        thumbnail_path: null,
        width: null,
        height: null,
        scan_status: "legacy_accepted",
        integrity_status: "legacy_unverified",
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        ...values,
      };
      const inserted = await admin.from("message_attachments").insert(row);
      if (inserted.error) throw new Error(`attachment_fixture_insert_failed_${codeOf(inserted.error)}`);
      attachmentIds.push(id);
      if (row.display_path) storagePaths.add(String(row.display_path));
      if (row.thumbnail_path) storagePaths.add(String(row.thumbnail_path));
      if (row.staging_path) storagePaths.add(String(row.staging_path));
      return id;
    };

    const expectedAttachment = (
      id: string,
      sourceMessageId: string,
      senderId: string,
      sourceCreatedAt: string,
      label: string,
      category: string,
      kind: string,
      values: Row = {},
    ): ExpectedItem => normalized({
      item_id: `attachment:${id}`,
      conversation_id: targetConversationId,
      source_message_id: sourceMessageId,
      sender_id: senderId,
      source_created_at: messageCreatedAt.get(sourceMessageId) ?? sourceCreatedAt,
      source_rank: 100 - Number(values.position ?? 0),
      category,
      kind,
      attachment_id: id,
      attachment_original_name: values.original_name === undefined ? `${label}.pdf` : values.original_name as string | null,
      attachment_mime_type: values.stored_mime_type === undefined ? "application/pdf" : values.stored_mime_type as string | null,
      attachment_byte_size: values.stored_byte_size === undefined ? 100 : values.stored_byte_size as number | null,
      attachment_width: values.width === undefined ? null : values.width as number | null,
      attachment_height: values.height === undefined ? null : values.height as number | null,
      attachment_display_path: values.display_path === undefined ? `${prefix}/${id}/display.bin` : values.display_path as string | null,
      attachment_thumbnail_path: values.thumbnail_path === undefined ? null : values.thumbnail_path as string | null,
      can_delete: false,
      can_export: true,
    });

    const baseTime = Date.now() - 86_400_000;
    const historyRows = Array.from({ length: 2_000 }, (_, index) => ({
      id: randomUUID(),
      conversation_id: targetConversationId,
      sender_id: index % 2 === 0 ? ownerId : coachId,
      sender_role: index % 2 === 0 ? "client" : "coach",
      body: `ordinary history ${index}`,
      client_request_id: `${prefix}-history-${index}`,
      created_at: new Date(baseTime - (index + 1) * 60_000).toISOString(),
    }));
    for (let offset = 0; offset < historyRows.length; offset += 250) {
      const inserted = await admin.from("messages").insert(historyRows.slice(offset, offset + 250));
      if (inserted.error) throw new Error("long_history_fixture_insert_failed");
      idsToDelete.push(...historyRows.slice(offset, offset + 250).map((row) => row.id));
    }
    report("long-history fixture has thousands of ordinary messages", historyRows.length >= 2_000);

    const docMessageIds: string[] = [];
    for (let index = 0; index < 79; index += 1) {
      const sourceCreatedAt = new Date(Date.now() - (index + 1) * 1_000).toISOString();
      const source = await message(index % 2 === 0 ? ownerId : coachId, index % 2 === 0 ? "client" : "coach", `document-${index}`, sourceCreatedAt);
      const attachmentId = await attachment(source, index % 2 === 0 ? ownerId : coachId, `document-${index}`, {
        position: 0,
      });
      const item = expectedAttachment(attachmentId, source, index % 2 === 0 ? ownerId : coachId, sourceCreatedAt, `document-${index}`, "files", "document");
      expected.push(item);
      fileExpected.push(item);
      docMessageIds.push(source);
    }
    const multiSourceCreatedAt = new Date(Date.now() - 90_000).toISOString();
    const multiSource = await message(ownerId, "client", "multiple-items", multiSourceCreatedAt);
    for (const [position, label] of ["multiple-a", "multiple-b"].entries()) {
      const attachmentId = await attachment(multiSource, ownerId, label, {
        position,
        original_name: `${label}.txt`,
        source_mime_type: "text/plain",
        stored_mime_type: "text/plain",
      });
      const item = expectedAttachment(attachmentId, multiSource, ownerId, multiSourceCreatedAt, label, "files", "document", {
        position,
        original_name: `${label}.txt`,
        stored_mime_type: "text/plain",
      });
      expected.push(item);
      fileExpected.push(item);
    }
    docMessageIds.push(multiSource);

    const photoMessage = await message(ownerId, "client", "photo", new Date(Date.now() - 100_000).toISOString());
    const photoAttachmentId = await attachment(photoMessage, ownerId, "photo", {
      kind: "image",
      original_name: "photo.webp",
      source_mime_type: "image/jpeg",
      stored_mime_type: "image/webp",
      thumbnail_path: `${prefix}/${randomUUID()}/thumbnail.webp`,
      stored_byte_size: 200,
      width: 20,
      height: 20,
      scan_status: "not_required",
    });
    expected.push(expectedAttachment(photoAttachmentId, photoMessage, ownerId, String((await admin.from("messages").select("created_at").eq("id", photoMessage).single()).data?.created_at), "photo", "media", "photo", {
      kind: "image", original_name: "photo.webp", stored_mime_type: "image/webp", stored_byte_size: 200,
      thumbnail_path: Array.from(storagePaths).find((path) => path.endsWith("thumbnail.webp")), width: 20, height: 20,
    }));

    const videoCreatedAt = new Date(Date.now() - 101_000).toISOString();
    const videoMessage = await message(coachId, "coach", "video", videoCreatedAt);
    const videoAttachmentId = await attachment(videoMessage, coachId, "video", {
      original_name: "clip.mp4",
      source_mime_type: "video/mp4",
      stored_mime_type: "video/mp4",
    });
    expected.push(expectedAttachment(videoAttachmentId, videoMessage, coachId, videoCreatedAt, "video", "media", "video", {
      original_name: "clip.mp4", stored_mime_type: "video/mp4",
    }));

    const voiceCreatedAt = new Date(Date.now() - 102_000).toISOString();
    const voiceMessage = await message(coachId, "coach", "voice", voiceCreatedAt);
    const voiceAttachmentId = await attachment(voiceMessage, coachId, "voice", {
      original_name: "voice.m4a",
      source_mime_type: "audio/mp4",
      stored_mime_type: "audio/mp4",
    });
    expected.push(expectedAttachment(voiceAttachmentId, voiceMessage, coachId, voiceCreatedAt, "voice", "voice", "voice", {
      original_name: "voice.m4a", stored_mime_type: "audio/mp4",
    }));

    const gifCreatedAt = new Date(Date.now() - 103_000).toISOString();
    const gifMessage = await message(ownerId, "client", "gif", gifCreatedAt);
    const gifInsert = await admin.from("message_gifs").insert({
      message_id: gifMessage,
      provider: "giphy",
      provider_content_id: `${prefix}-gif`,
      title: "A calm GIF",
      description: "A verifier GIF",
      source_url: "https://giphy.com/gifs/fish-calm",
      poster_url: "https://media.giphy.com/media/fish/giphy.gif",
      preview_url: "https://media.giphy.com/media/fish/preview.gif",
      media_url: "https://media.giphy.com/media/fish/media.gif",
      width: 20,
      height: 20,
    });
    if (gifInsert.error) throw new Error("gif_fixture_insert_failed");
    expected.push(normalized({
      item_id: `gif:${gifMessage}`, conversation_id: targetConversationId, source_message_id: gifMessage,
      sender_id: ownerId, source_created_at: messageCreatedAt.get(gifMessage) ?? gifCreatedAt, source_rank: 90, category: "media", kind: "gif",
      gif_provider: "giphy", gif_provider_content_id: `${prefix}-gif`, gif_title: "A calm GIF", gif_description: "A verifier GIF",
      can_delete: false, can_export: false,
    }));

    const stickerCreatedAt = new Date(Date.now() - 104_000).toISOString();
    const stickerMessage = await message(ownerId, "client", "sticker", stickerCreatedAt, { sticker_id: "aquatic-hello-otter" });
    expected.push(normalized({
      item_id: `sticker:${stickerMessage}`, conversation_id: targetConversationId, source_message_id: stickerMessage,
      sender_id: ownerId, source_created_at: messageCreatedAt.get(stickerMessage) ?? stickerCreatedAt, source_rank: 89, category: "media", kind: "sticker",
      sticker_id: "aquatic-hello-otter", can_delete: false, can_export: false,
    }));

    const unsafeMessage = await message(ownerId, "client", "unsafe-link", new Date(Date.now() - 105_000).toISOString());
    const unsafePreview = await admin.from("message_link_previews").insert({
      message_id: unsafeMessage,
      url: "http://127.0.0.1:54321/private",
      hostname: "127.0.0.1",
    });
    if (unsafePreview.error) throw new Error("unsafe_fixture_insert_failed");
    const unsafeList = await invokeList(ownerClient, targetConversationId, {});
    report("database listing rejects private-host link identity", !unsafeList.error && !(unsafeList.data ?? []).some((row) => itemId(row) === `link:${unsafeMessage}`));
    await admin.from("message_link_previews").delete().eq("message_id", unsafeMessage);

    const legacyPublicMessage = await message(ownerId, "client", "legacy-public-link", new Date(Date.now() - 105_500).toISOString());
    const legacyPublic = await admin.from("message_link_previews").insert({
      message_id: legacyPublicMessage, url: "https://example.com/legacy", hostname: "example.com",
    });
    if (legacyPublic.error) throw new Error("legacy_public_fixture_insert_failed");
    const legacyPublicList = await invokeList(ownerClient, targetConversationId, { category: "links" });
    report("unproven public legacy link is stored but omitted", !legacyPublicList.error && !(legacyPublicList.data ?? []).some((row) => itemId(row) === `link:${legacyPublicMessage}`));

    const privateVersionedMessage = await message(ownerId, "client", "private-v2-link", new Date(Date.now() - 105_600).toISOString());
    const privateVersioned = await admin.from("message_link_previews").insert({
      message_id: privateVersionedMessage, url: "http://127.0.0.1:54321/private-v2", hostname: "127.0.0.1",
      safe_link_validation_version: 2, safe_link_validated_at: new Date().toISOString(),
    });
    report("private version-2 direct link write is rejected", Boolean(privateVersioned.error), codeOf(privateVersioned.error));

    const mismatchedVersionedMessage = await message(ownerId, "client", "mismatched-v2-link", new Date(Date.now() - 105_700).toISOString());
    const mismatchedVersioned = await admin.from("message_link_previews").insert({
      message_id: mismatchedVersionedMessage, url: "https://example.com/mismatch", hostname: "other.example",
      safe_link_validation_version: 2, safe_link_validated_at: new Date().toISOString(),
    });
    report("mismatched-host version-2 direct link write is rejected", Boolean(mismatchedVersioned.error), codeOf(mismatchedVersioned.error));

    const sendRequestId = `${prefix}-safe-link-send`;
    const sent = await ownerClient.functions.invoke("send-message", {
      body: {
        conversationId: targetConversationId,
        body: "A safe link https://example.com/fish-verifier",
        clientRequestId: sendRequestId,
      },
    });
    const safeMessageLookup = await admin.from("messages").select("id,created_at").eq("conversation_id", targetConversationId).eq("client_request_id", sendRequestId).maybeSingle();
    safeLinkMessageId = String(safeMessageLookup.data?.id ?? "");
    if (safeLinkMessageId) idsToDelete.push(safeLinkMessageId);
    const safePreview = safeLinkMessageId
      ? await admin.from("message_link_previews").select("message_id,url,hostname,safe_link_validation_version,safe_link_validated_at,title,description,site_name").eq("message_id", safeLinkMessageId).maybeSingle()
      : { data: null, error: sent.error ?? new Error("safe_link_send_failed") };
    const safeJobs = safeLinkMessageId
      ? await admin.from("chat_link_preview_jobs").select("message_id").eq("message_id", safeLinkMessageId)
      : { data: [], error: sent.error ?? new Error("safe_link_send_failed") };
    report("canonical safe link persists with immutable proof and no preview job", !sent.error && Boolean(safeLinkMessageId) && !safePreview.error
      && safePreview.data?.message_id === safeLinkMessageId && safePreview.data.url === "https://example.com/fish-verifier"
      && safePreview.data.hostname === "example.com" && safePreview.data.safe_link_validation_version === 2
      && safePreview.data.safe_link_validated_at !== null && safePreview.data.title === null
      && safePreview.data.description === null && safePreview.data.site_name === null
      && !safeJobs.error && !(safeJobs.data ?? []).length, codeOf(sent.error ?? safePreview.error ?? safeJobs.error));
    const legacyJob = await admin.from("chat_link_preview_jobs").upsert({
      message_id: legacyPublicMessage, url: "https://example.com/legacy", state: "pending", last_error: null,
      next_attempt_at: new Date(Date.now() - 1_000).toISOString(),
    }, { onConflict: "message_id" });
    if (legacyJob.error) throw new Error("legacy_preview_job_fixture_failed");
    const previewRun = await ownerClient.functions.invoke("link-preview", { body: {} });
    const drainedJob = await admin.from("chat_link_preview_jobs").select("state,last_error").eq("message_id", legacyPublicMessage).maybeSingle();
    report("legacy preview job is terminalized without egress", !previewRun.error && !drainedJob.error
      && drainedJob.data?.state === "failed" && drainedJob.data.last_error === "preview_fetch_disabled", codeOf(previewRun.error ?? drainedJob.error));
    const unsafeSendRequestId = `${prefix}-unsafe-link-send`;
    const unsafeSent = await ownerClient.functions.invoke("send-message", {
      body: {
        conversationId: targetConversationId,
        body: "Private candidate http://127.0.0.1:54321/nope",
        clientRequestId: unsafeSendRequestId,
      },
    });
    const unsafeMessageLookup = await admin.from("messages").select("id").eq("conversation_id", targetConversationId).eq("client_request_id", unsafeSendRequestId).maybeSingle();
    const unsafePersisted = unsafeMessageLookup.data?.id
      ? await admin.from("message_link_previews").select("message_id").eq("message_id", unsafeMessageLookup.data.id).maybeSingle()
      : { data: null, error: null };
    if (unsafeMessageLookup.data?.id) idsToDelete.push(unsafeMessageLookup.data.id);
    report("unsafe link never persists a canonical identity", !unsafeSent.error && Boolean(unsafeMessageLookup.data?.id) && !unsafePersisted.data);
    if (safeLinkMessageId && safePreview.data) {
      expected.push(normalized({
        item_id: `link:${safeLinkMessageId}`, conversation_id: targetConversationId, source_message_id: safeLinkMessageId,
        sender_id: ownerId, source_created_at: String(safeMessageLookup.data?.created_at), source_rank: 80,
        category: "links", kind: "link", link_url: "https://example.com/fish-verifier", link_hostname: "example.com",
        can_delete: false, can_export: true,
      }));
    }

    stage = "attachment-exclusions";
    const pendingId = await attachment(null, ownerId, "pending", { status: "pending", position: null, display_path: null, stored_mime_type: null, stored_byte_size: null, scan_status: "pending", integrity_status: "pending" });
    const failedId = await attachment(null, ownerId, "failed", { status: "failed", position: null, display_path: null, stored_mime_type: null, stored_byte_size: null, scan_status: "pending", integrity_status: "pending" });
    const unboundId = await attachment(null, ownerId, "ready-unbound", { position: null, original_name: "unbound.webp", source_mime_type: "image/jpeg", stored_mime_type: "image/webp", stored_byte_size: 200, display_path: `${prefix}/${randomUUID()}/display.webp`, thumbnail_path: `${prefix}/${randomUUID()}/thumb.webp`, width: 20, height: 20, kind: "image", scan_status: "not_required" });
    const unsupportedId = await attachment(docMessageIds[0]!, ownerId, "unsupported", { original_name: "unsupported.bin", source_mime_type: "application/octet-stream", stored_mime_type: "application/octet-stream", position: 1 });
    const deletedSource = await message(ownerId, "client", "deleted-source", new Date(Date.now() - 106_000).toISOString());
    const deletedSourceAttachment = await attachment(deletedSource, ownerId, "deleted-source", { position: 0 });
    const deletedSourceUpdate = await admin.from("messages").update({ deleted_at: new Date().toISOString() }).eq("id", deletedSource);
    if (deletedSourceUpdate.error) throw new Error("deleted_source_fixture_failed");
    const mismatchSourceId = randomUUID();
    const mismatchSource = await admin.from("messages").insert({
      id: mismatchSourceId, conversation_id: otherConversationId, sender_id: otherMemberId, sender_role: "client",
      body: "mismatched source", client_request_id: `${prefix}-mismatched-source`, created_at: new Date(Date.now() - 106_500).toISOString(),
    });
    if (mismatchSource.error) throw new Error("mismatch_source_fixture_failed");
    idsToDelete.push(mismatchSourceId);
    const mismatchMessage = { data: { id: mismatchSourceId }, error: null };
    if (mismatchMessage.error || !mismatchMessage.data) throw new Error("mismatch_source_fixture_missing");
    const mismatchId = await attachment(mismatchMessage.data.id, ownerId, "conversation-mismatch", { position: 0 });
    const exclusionList = await invokeList(ownerClient, targetConversationId, { category: "files" });
    const exclusionIds = new Set((exclusionList.data ?? []).map(itemId));
    report("pending/failed/ready-unbound/mismatch/unsupported/deleted exclusions stay absent", !exclusionList.error && [pendingId, failedId, unboundId, unsupportedId, deletedSourceAttachment, mismatchId].every((id) => !exclusionIds.has(`attachment:${id}`)));
    report("all seven eligible kinds are present by exact identity", ["photo", "video", "gif", "sticker", "document", "link", "voice"].every((kind) => (expected.filter((item) => item.kind === kind).length > 0)));

    stage = "authorization-matrix";
    const formerRemoval = await admin.from("channel_members").delete().match({ channel_id: targetChannelId, user_id: formerId });
    const blockedRemoval = await admin.from("channel_members").delete().match({ channel_id: targetChannelId, user_id: blockedId });
    const formerList = await invokeList(formerClient, targetConversationId, {});
    const blockedAttachments = await blockedClient.from("message_attachments").select("id").eq("conversation_id", targetConversationId);
    report("former member loses shared-content access", !formerRemoval.error && !(formerList.data ?? []).length, `rows=${formerList.data?.length ?? 0}`);
    report("blocked/former member direct table access is empty", !blockedRemoval.error && !(blockedAttachments.data ?? []).length, `rows=${blockedAttachments.data?.length ?? 0}`);
    report("authorized member lists the isolated conversation", Boolean((await invokeList(memberClient, targetConversationId, {})).data?.length));
    const signedOutList = await invokeList(signedOut, targetConversationId, {});
    const outsiderList = await invokeList(outsider, targetConversationId, {});
    const otherMemberList = await invokeList(otherMember, targetConversationId, {});
    report("signed-out RPC returns no shared content", !(signedOutList.data ?? []).length, `rows=${signedOutList.data?.length ?? 0}`);
    report("outsider RPC returns no shared content", !(outsiderList.data ?? []).length, `rows=${outsiderList.data?.length ?? 0}`);
    report("other-conversation member RPC returns no target content", !(otherMemberList.data ?? []).length, `rows=${otherMemberList.data?.length ?? 0}`);
    report("anonymous function execution is denied", Boolean((await signedOut.rpc("list_conversation_shared_content_categories", { p_conversation_id: targetConversationId })).error));
    report("member cannot invoke service-only cleanup", Boolean((await ownerClient.rpc("claim_deleted_chat_attachment_cleanup", { p_claim_token: randomUUID(), p_limit: 1 })).error));
    const memberPreview = await memberClient.from("message_link_previews").select("message_id").eq("message_id", safeLinkMessageId);
    const outsiderPreview = await outsider.from("message_link_previews").select("message_id").eq("message_id", safeLinkMessageId);
    report("direct table is member-scoped", Boolean(memberPreview.data?.length) && !(outsiderPreview.data ?? []).length);

    const legacyVoice = await invokeList(memberClient, targetConversationId, { category: "voice" });
    const legacyVoiceRows = (legacyVoice.data ?? []) as Row[];
    report(
      "legacy voice duration remains nullable",
      !legacyVoice.error
        && legacyVoiceRows.length === 1
        && Object.hasOwn(legacyVoiceRows[0]!, "duration_ms")
        && legacyVoiceRows[0]!.duration_ms === null,
      `field=${Object.hasOwn(legacyVoiceRows[0] ?? {}, "duration_ms") ? "present" : "missing"}`,
    );
    report(
      "authorized voice rows expose the exact 29-field normalized shape",
      !legacyVoice.error && legacyVoiceRows.length === 1 && legacyVoiceRows.every(hasExactNormalizedShape),
      `fields=${Object.keys(legacyVoiceRows[0] ?? {}).length}`,
    );

    const trustedDurationWrite = await admin
      .from("message_attachments")
      .update({ duration_ms: 90_500 } as never)
      .eq("id", voiceAttachmentId)
      .select("id")
      .maybeSingle();
    report(
      "trusted non-negative voice duration is accepted",
      !trustedDurationWrite.error && trustedDurationWrite.data?.id === voiceAttachmentId,
      codeOf(trustedDurationWrite.error),
    );
    const expectedVoice = expected.find((item) => item.item_id === `attachment:${voiceAttachmentId}`);
    if (expectedVoice) expectedVoice.duration_ms = 90_500;

    const durationVoice = await invokeList(memberClient, targetConversationId, { category: "voice" });
    const durationVoiceRows = (durationVoice.data ?? []) as Row[];
    report(
      "authorized member receives trusted voice duration",
      !durationVoice.error
        && durationVoiceRows.length === 1
        && durationVoiceRows[0]!.duration_ms === 90_500
        && durationVoiceRows.every(hasExactNormalizedShape),
      codeOf(durationVoice.error),
    );

    const negativeDurationWrite = await admin
      .from("message_attachments")
      .update({ duration_ms: -1 } as never)
      .eq("id", voiceAttachmentId)
      .select("id")
      .maybeSingle();
    report(
      "negative voice duration is rejected by the database check",
      codeOf(negativeDurationWrite.error) === "23514",
      codeOf(negativeDurationWrite.error),
    );

    const memberDurationWrite = await memberClient
      .from("message_attachments")
      .update({ duration_ms: 1 } as never)
      .eq("id", voiceAttachmentId)
      .select("id");
    report(
      "conversation members cannot write trusted duration metadata",
      !memberDurationWrite.error && (memberDurationWrite.data?.length ?? 0) === 0,
      codeOf(memberDurationWrite.error),
    );
    const formerDurationRead = await formerClient
      .from("message_attachments")
      .select("duration_ms")
      .eq("id", voiceAttachmentId);
    report(
      "former members cannot read trusted duration metadata",
      !formerDurationRead.error && (formerDurationRead.data?.length ?? 0) === 0,
      codeOf(formerDurationRead.error),
    );

    const invalidCategory = await invokeList(memberClient, targetConversationId, { category: "not-a-category" });
    const invalidLimit = await invokeList(memberClient, targetConversationId, { limit: 41 });
    const partialCursor = await memberClient.rpc("list_conversation_shared_content", {
      p_conversation_id: targetConversationId,
      p_category: null,
      p_before_created_at: new Date().toISOString(),
      p_before_message_id: null,
      p_before_source_rank: null,
      p_before_item_id: null,
      p_limit: 40,
    });
    report("invalid category is rejected", Boolean(invalidCategory.error), codeOf(invalidCategory.error));
    report("out-of-range limit is rejected", Boolean(invalidLimit.error), codeOf(invalidLimit.error));
    report("partial/tampered cursor is rejected", Boolean(partialCursor.error), codeOf(partialCursor.error));

    const categories = await memberClient.rpc("list_conversation_shared_content_categories", { p_conversation_id: targetConversationId });
    report("categories are fixed, populated, and ordered", !categories.error && sameIds((categories.data ?? []).map((row) => String(row.category)), ["media", "files", "links", "voice"]));
    const orderedExpected = expected.slice().sort(compareItems);
    report("UTF-8 C comparator discriminates non-ASCII codepoints", compareC("é", "z") > 0 && compareC("z", "é") < 0);
    const firstAll = await invokeList(memberClient, targetConversationId, { limit: 40 });
    const firstAllRows = (firstAll.data ?? []) as Row[];
    report("raw first page is 41 rows with a retained row-40 cursor", !firstAll.error && firstAllRows.length === 41 && itemId(firstAllRows[40]!) !== itemId(firstAllRows[39]!) && cursorFromRow(firstAllRows[39]!).itemId === itemId(firstAllRows[39]!));
    report(
      "41st row remains a non-rendered continuation sentinel",
      !firstAll.error
        && firstAllRows.length === 41
        && !firstAllRows.slice(0, 40).some((row) => itemId(row) === itemId(firstAllRows[40]!)),
    );
    report(
      "authorized listing rows expose the exact 29-field normalized shape",
      !firstAll.error && firstAllRows.length === 41 && firstAllRows.every(hasExactNormalizedShape),
      `fields=${Object.keys(firstAllRows[0] ?? {}).length}`,
    );
    const firstComparison = compareNormalizedRows(firstAllRows, orderedExpected.slice(0, 41));
    report("raw first page matches complete normalized rows", !firstAll.error && firstComparison.ok, firstComparison.field ? `field=${firstComparison.field}` : undefined);
    const raw39 = await invokeList(memberClient, targetConversationId, { limit: 39 });
    const raw39Rows = (raw39.data ?? []) as Row[];
    report("p_limit 39 returns 40 raw rows", !raw39.error && raw39Rows.length === 40);
    const raw39Comparison = compareNormalizedRows(raw39Rows, orderedExpected.slice(0, 40));
    report("p_limit 39 matches complete normalized rows", !raw39.error && raw39Comparison.ok, raw39Comparison.field ? `field=${raw39Comparison.field}` : undefined);
    const rawInvalid81 = await invokeList(memberClient, targetConversationId, { limit: 81 });
    report("p_limit 81 is rejected rather than silently expanding work", Boolean(rawInvalid81.error), codeOf(rawInvalid81.error));
    const firstFile = await invokeList(memberClient, targetConversationId, { category: "files", limit: 40 });
    const firstFileRows = (firstFile.data ?? []) as Row[];
    const orderedFileExpected = fileExpected.slice().sort(compareItems);
    report("files first page has the 41st sentinel only", !firstFile.error && firstFileRows.length === 41 && firstFileRows.slice(0, 40).every((row) => row.category === "files"));
    const firstFileComparison = compareNormalizedRows(firstFileRows, orderedFileExpected.slice(0, 41));
    report("files first page matches complete normalized rows", !firstFile.error && firstFileComparison.ok, firstFileComparison.field ? `field=${firstFileComparison.field}` : undefined);
    const fileRows: Row[] = [];
    const fileRawLengths: number[] = [];
    let fileCursor: Cursor | null = null;
    let fileOffset = 0;
    for (;;) {
      const page = await invokeList(memberClient, targetConversationId, { category: "files", cursor: fileCursor, limit: 40 });
      if (page.error) throw new Error("file_pagination_failed");
      const rows = (page.data ?? []) as Row[];
      fileRawLengths.push(rows.length);
      const retained = rows.slice(0, 40);
      fileRows.push(...retained);
      const comparison = compareNormalizedRows(retained, orderedFileExpected.slice(fileOffset, fileOffset + retained.length));
      report(`files page ${fileRawLengths.length} matches complete normalized rows`, comparison.ok, comparison.field ? `field=${comparison.field}` : undefined);
      fileOffset += retained.length;
      if (rows.length <= 40) break;
      fileCursor = cursorFromRow(rows[39]!);
    }
    report("81 file rows paginate without gaps or duplicates", fileRows.length === 81 && compareNormalizedRows(fileRows, orderedFileExpected).ok && new Set(fileRows.map(itemId)).size === 81);
    report("raw pagination responses retain the sentinel contract", JSON.stringify(fileRawLengths) === JSON.stringify([41, 41, 1]));
    const allRows: Row[] = [];
    let allCursor: Cursor | null = null;
    let allOffset = 0;
    for (;;) {
      const page = await invokeList(memberClient, targetConversationId, { cursor: allCursor, limit: 40 });
      if (page.error) throw new Error("all_pagination_failed");
      const rows = (page.data ?? []) as Row[];
      const retained = rows.slice(0, 40);
      allRows.push(...retained);
      const comparison = compareNormalizedRows(retained, orderedExpected.slice(allOffset, allOffset + retained.length));
      report(`all-content page ${allOffset / 40 + 1} matches complete normalized rows`, comparison.ok, comparison.field ? `field=${comparison.field}` : undefined);
      allOffset += retained.length;
      if (rows.length <= 40) break;
      allCursor = cursorFromRow(rows[39]!);
    }
    report("complete ordered rows match the reference sequence", compareNormalizedRows(allRows, orderedExpected).ok, `expected=${orderedExpected.length};actual=${allRows.length}`);

    const raceMessage = await message(ownerId, "client", "race-new", new Date(Date.now() + 10_000).toISOString());
    const raceAttachment = await attachment(raceMessage, ownerId, "race-new", { position: 0 });
    const raceFirst = await invokeList(memberClient, targetConversationId, { category: "files", limit: 40 });
    const deletedRaceMessage = docMessageIds[60];
    if (!deletedRaceMessage) throw new Error("race_fixture_missing");
    const deletedRace = await admin.from("messages").delete().eq("id", deletedRaceMessage);
    if (deletedRace.error) throw new Error("race_delete_failed");
    const raceContinuation = raceFirst.data?.[39] ? await invokeList(memberClient, targetConversationId, { category: "files", cursor: cursorFromRow(raceFirst.data[39]!), limit: 40 }) : { data: [], error: null };
    const raceIds = (raceContinuation.data ?? []).slice(0, 40).map(itemId);
    report("insert/delete race does not duplicate a retained identity", !raceContinuation.error && raceIds.every((id) => !new Set((raceFirst.data ?? []).slice(0, 40).map(itemId)).has(id)) && !raceIds.includes(`attachment:${raceAttachment}`));

    const contextTarget = historyRows[1_000]!.id;
    const context = await memberClient.rpc("list_conversation_message_context", { p_conversation_id: targetConversationId, p_message_id: contextTarget, p_before: 2, p_after: 3 });
    const contextRows = (context.data ?? []) as Row[];
    report("source context is bounded to requested neighbors", !context.error && contextRows.length <= 6 && contextRows.length >= 1 && contextRows.every((row) => row.body === undefined || String(row.body).length < 4001));
    report("bounded context exposes honest continuity gaps", !context.error && contextRows.every((row) => typeof row.has_older_gap === "boolean" && typeof row.has_newer_gap === "boolean"));
    const missingContext = await memberClient.rpc("list_conversation_message_context", { p_conversation_id: targetConversationId, p_message_id: randomUUID(), p_before: 20, p_after: 20 });
    report("missing context is generic and empty", !missingContext.error && !(missingContext.data ?? []).length);
    const unauthorizedContext = await outsider.rpc("list_conversation_message_context", { p_conversation_id: targetConversationId, p_message_id: contextTarget, p_before: 20, p_after: 20 });
    report("unauthorized context is generic and empty", !unauthorizedContext.error && !(unauthorizedContext.data ?? []).length, `rows=${unauthorizedContext.data?.length ?? 0}`);

    const contextBase = Date.now() + 300_000;
    const contextOlderLive = await message(ownerId, "client", "context-older-live", new Date(contextBase + 1_000).toISOString());
    const contextOlderDeleted = await message(ownerId, "client", "context-older-deleted", new Date(contextBase + 2_000).toISOString());
    const contextExactTarget = await message(ownerId, "client", "context-target", new Date(contextBase + 3_000).toISOString());
    const contextNewerDeleted = await message(ownerId, "client", "context-newer-deleted", new Date(contextBase + 4_000).toISOString());
    const contextNewerLive = await message(ownerId, "client", "context-newer-live", new Date(contextBase + 5_000).toISOString());
    const neighborDelete = await admin.from("messages").update({ deleted_at: new Date().toISOString() }).in("id", [contextOlderDeleted, contextNewerDeleted]);
    if (neighborDelete.error) throw new Error("deleted_neighbor_fixture_failed");
    const exactContext = await memberClient.rpc("list_conversation_message_context", {
      p_conversation_id: targetConversationId, p_message_id: contextExactTarget, p_before: 1, p_after: 1,
    });
    const exactContextRows = (exactContext.data ?? []) as Row[];
    report("deleted-neighbor context returns target plus live neighbors only", !exactContext.error
      && JSON.stringify(exactContextRows.map((row) => String(row.message_id))) === JSON.stringify([contextOlderLive, contextExactTarget, contextNewerLive])
      && !exactContextRows.some((row) => [contextOlderDeleted, contextNewerDeleted].includes(String(row.message_id))));
    report("deleted-neighbor context gap flags reflect the live set", !exactContext.error
      && exactContextRows.every((row) => row.has_older_gap === true && row.has_newer_gap === false));

    stage = "explain-plans";
    const deepCursor = fileCursor;
    const explainCases: Array<[string, string | null, Cursor | null]> = [
      ["unfiltered first page", null, null],
      ["media category", "media", null],
      ["files category", "files", null],
      ["links category", "links", null],
      ["voice category", "voice", null],
      ["deep files cursor", "files", deepCursor],
    ];
    for (const [name, category, cursor] of explainCases) {
      try {
        const plan = explainSharedContent(targetConversationId, memberId, category, cursor);
        report(`EXPLAIN captures bounded ${name} work`, true, `slots=${pageBudget.slots};messageRows=${pageBudget.messageRows};node=${pageBudget.perMessageNode};blocks=${pageBudget.sharedBlocks};${planEvidence(plan)}`);
      } catch (error) {
        report(`EXPLAIN captures bounded ${name} work`, false, error instanceof Error ? error.message : "plan_rejected");
      }
    }
    try {
      const categoryPlan = assertPlan(runSql(`
        explain (analyze, buffers, format json)
        with auth_context as (
          select set_config('request.jwt.claim.sub', '${memberId}', false) as ignored
        ), live_attachment as materialized (
          select attachment.message_id
          from auth_context cross join public.message_attachments attachment
          where attachment.conversation_id = '${targetConversationId}'::uuid
            and attachment.status = 'ready' and attachment.delete_requested_at is null
          limit 1
        ), live as materialized (
          select 1 from live_attachment candidate
          join public.messages message on message.id = candidate.message_id
          where message.conversation_id = '${targetConversationId}'::uuid and message.deleted_at is null
        ), categories as (
          select category from live cross join (values ('media'::text), ('files'::text), ('links'::text), ('voice'::text)) available(category)
        ) select * from categories limit ${categoryBudget.slots};
      `), categoryBudget);
      report("EXPLAIN captures category availability", true, `slots=${categoryBudget.slots};messageRows=${categoryBudget.messageRows};node=${categoryBudget.perMessageNode};blocks=${categoryBudget.sharedBlocks};${planEvidence(categoryPlan)}`);
    } catch (error) {
      report("EXPLAIN captures category availability", false, error instanceof Error ? error.message : "plan_rejected");
    }
    report("reference query equality was checked before accepting pagination", compareNormalizedRows(allRows, orderedExpected).ok && new Set(allRows.map(itemId)).size === allRows.length);

    const senderDeleteCreatedAt = new Date(Date.now() - 107_000).toISOString();
    senderDeleteMessageId = await message(ownerId, "client", "sender-delete", senderDeleteCreatedAt, { sticker_id: "aquatic-hello-otter" });
    deletedMessageIds.push(senderDeleteMessageId);
    const deleteAttachmentId = await attachment(senderDeleteMessageId, ownerId, "sender-delete", {
      kind: "image",
      original_name: "delete.webp",
      source_mime_type: "image/jpeg",
      stored_mime_type: "image/webp",
      thumbnail_path: `${prefix}/${randomUUID()}/delete-thumb.webp`,
      width: 20,
      height: 20,
      scan_status: "not_required",
    });
    const deletePath = `${prefix}/${deleteAttachmentId}/display.bin`;
    storagePaths.add(deletePath);
    const upload = await admin.storage.from("chat-images").upload(deletePath, new TextEncoder().encode("private"), { contentType: "image/webp", upsert: false });
    report("private attachment object exists before sender deletion", !upload.error);
    const gifDelete = await admin.from("message_gifs").insert({ message_id: senderDeleteMessageId, provider: "giphy", provider_content_id: `${prefix}-delete-gif`, title: "Delete GIF", description: "Delete GIF", source_url: "https://giphy.com/gifs/delete", poster_url: "https://media.giphy.com/media/delete/poster.gif", preview_url: "https://media.giphy.com/media/delete/preview.gif", media_url: "https://media.giphy.com/media/delete/media.gif", width: 20, height: 20 });
    const linkDelete = await admin.from("message_link_previews").insert({ message_id: senderDeleteMessageId, url: "https://example.com/delete", hostname: "example.com" });
    if (gifDelete.error || linkDelete.error) throw new Error("deletion_fanout_fixture_failed");
    const preIssued = await ownerClient.storage.from("chat-images").createSignedUrl(deletePath, 900);
    const preIssuedExpirySeconds = preIssued.data?.signedUrl ? 900 : 0;
    report("pre-issued bearer URL is captured only in memory with a 15-minute maximum", !preIssued.error && preIssuedExpirySeconds === 900);
    const recipientDeleteAttempt = await recipient.rpc("delete_chat_message", { p_message_id: senderDeleteMessageId });
    report("recipient cannot delete sender-owned source", Boolean(recipientDeleteAttempt.error), codeOf(recipientDeleteAttempt.error));
    const senderDelete = await ownerClient.rpc("delete_chat_message", { p_message_id: senderDeleteMessageId });
    report("sender deletion tombstones the source", !senderDelete.error);
    const repeatedDelete = await ownerClient.rpc("delete_chat_message", { p_message_id: senderDeleteMessageId });
    report("repeated sender deletion is idempotent", !repeatedDelete.error);
    const afterDeleteList = await invokeList(ownerClient, targetConversationId, {});
    const afterDeleteDirect = await ownerClient.from("message_link_previews").select("message_id").eq("message_id", senderDeleteMessageId);
    const afterDeleteSigning = await ownerClient.storage.from("chat-images").createSignedUrl(deletePath, 900);
    report("deletion fan-out removes every sibling from normalized results", !afterDeleteList.error && !(afterDeleteList.data ?? []).some((row) => String(row.source_message_id) === senderDeleteMessageId));
    report("link metadata access stops immediately after deletion", !afterDeleteDirect.error && !(afterDeleteDirect.data ?? []).length);
    report("new delivery URL signing stops immediately after deletion", Boolean(afterDeleteSigning.error), codeOf(afterDeleteSigning.error));
    report("pre-issued URL TTL is not overstated", preIssued.data?.signedUrl ? preIssuedExpirySeconds <= 900 : false);

    const recipientDeleteSource = await message(coachId, "coach", "recipient-delete", new Date(Date.now() - 108_000).toISOString());
    const recipientAttachmentId = await attachment(recipientDeleteSource, coachId, "recipient-delete", { position: 0 });
    deletedMessageIds.push(recipientDeleteSource);
    const recipientDelete = await recipient.rpc("delete_chat_message", { p_message_id: recipientDeleteSource });
    report("recipient can delete their own source", !recipientDelete.error);
    const recipientDeleteDirect = await memberClient.from("message_attachments").select("id").eq("id", recipientAttachmentId);
    report("recipient deletion revokes member attachment access", !recipientDeleteDirect.error && !(recipientDeleteDirect.data ?? []).length);

    const cleanupClaimToken = randomUUID();
    const firstClaim = await admin.rpc("claim_deleted_chat_attachment_cleanup", { p_claim_token: cleanupClaimToken, p_limit: 100 });
    const claimedIds = ((firstClaim.data ?? []) as Row[]).map((row) => String(row.id));
    report("service role claims deleted bound attachments", !firstClaim.error && claimedIds.includes(deleteAttachmentId) && claimedIds.includes(recipientAttachmentId));
    const retryFinish = await admin.rpc("finish_deleted_chat_attachment_cleanup", { p_claim_token: cleanupClaimToken, p_deleted_ids: [] });
    report("cleanup failure releases rows for retry", !retryFinish.error && retryFinish.data === 0);
    const retryClaimToken = randomUUID();
    const retryClaim = await admin.rpc("claim_deleted_chat_attachment_cleanup", { p_claim_token: retryClaimToken, p_limit: 100 });
    const retryIds = ((retryClaim.data ?? []) as Row[]).map((row) => String(row.id));
    report("released cleanup rows are claimable again", !retryClaim.error && retryIds.includes(deleteAttachmentId) && retryIds.includes(recipientAttachmentId));
    const physicalDelete = await admin.storage.from("chat-images").remove([deletePath]);
    report("physical object deletion succeeds before durable finish", !physicalDelete.error);
    const finish = await admin.rpc("finish_deleted_chat_attachment_cleanup", { p_claim_token: retryClaimToken, p_deleted_ids: retryIds });
    report("missing-object/retry cleanup converges without losing source tombstone", !finish.error && Number(finish.data) >= 2);
    const tombstone = await admin.from("messages").select("deleted_at").eq("id", senderDeleteMessageId).single();
    report("successful physical cleanup preserves durable message tombstone", !tombstone.error && Boolean(tombstone.data?.deleted_at));

    if (target === "local") {
      const drift = execFileSync("supabase", ["gen", "types", "typescript", "--local"], { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
      const committed = await readFile("packages/supabase/src/database.generated.ts", "utf8").catch(() => "");
      report("generated Supabase contract has no byte drift", drift === committed);
      const uploadArgs = generatedFunctionArgs(committed, "initialize_chat_attachment_upload");
      const sendArgs = generatedFunctionArgs(committed, "send_chat_message");
      report(
        "sending and upload mutation contracts expose no duration input",
        Boolean(uploadArgs)
          && Boolean(sendArgs)
          && !/(?:p_)?duration_ms/.test(uploadArgs)
          && !/(?:p_)?duration_ms/.test(sendArgs),
      );
    } else {
      report("linked migration 0062 remains the active schema boundary", true);
    }
    report("generated aliases point at generated table/function shapes", /Database\["public"\]\["Functions"\]\["list_conversation_shared_content"\]/.test(await readFile("packages/supabase/src/database.types.ts", "utf8")));
  } catch (error) {
    setupFailure = true;
    failures += 1;
    const safeFailure = error instanceof Error ? error.message.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 80) : "unknown";
    console.error(`SETUP_REQUIRED: isolated fixtures or a required local Supabase service could not be prepared (${stage}:${safeFailure}).`);
  } finally {
    if (targetChannelId) await admin.from("channel_members").delete().eq("channel_id", targetChannelId);
    if (targetChannelId) await admin.from("channels").delete().eq("id", targetChannelId);
    if (blockedId && ownerId) await admin.from("user_blocks").delete().match({ blocker_id: blockedId, blocked_id: ownerId });
    if (targetConversationId) {
      await admin.from("message_link_previews").delete().in("message_id", idsToDelete);
      await admin.from("chat_link_preview_jobs").delete().in("message_id", idsToDelete);
      await admin.from("message_gifs").delete().in("message_id", idsToDelete);
      await admin.from("messages").delete().in("id", idsToDelete);
      await admin.from("message_attachments").delete().in("id", attachmentIds);
      if (coachId && ownerId) await admin.from("coach_clients").delete().match({ coach_id: coachId, client_id: ownerId });
      await admin.from("conversations").delete().eq("id", targetConversationId);
    }
    if (otherConversationId) {
      await admin.from("message_link_previews").delete().eq("message_id", otherConversationId);
      await admin.from("chat_link_preview_jobs").delete().eq("message_id", otherConversationId);
      await admin.from("message_gifs").delete().eq("message_id", otherConversationId);
      await admin.from("conversations").delete().eq("id", otherConversationId);
      if (coachId && otherMemberId) await admin.from("coach_clients").delete().match({ coach_id: coachId, client_id: otherMemberId });
    }
    if (storagePaths.size) await admin.storage.from("chat-images").remove([...storagePaths]);
    for (const testUserId of testUserIds) await admin.auth.admin.deleteUser(testUserId);
  }
  if (setupFailure) process.exitCode = 2;
  else if (failures > 0) {
    console.error(`${failures} shared-content verification check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("Shared-content verification passed.");
  }
}

await main();
