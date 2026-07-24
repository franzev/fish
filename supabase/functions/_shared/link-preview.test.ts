import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.110.0";
import {
  enqueueLinkPreviewJob,
  firstPublicHttpUrl,
  firstSafePublicHttpUrl,
  processLinkPreviewJobs,
  resolvePublicHostAddresses,
  type HostAddressResolver,
  validatePublicUrl,
} from "./link-preview.ts";

type TableName = "message_link_previews" | "chat_link_preview_jobs";
type Row = Record<string, unknown>;

type UpsertCall = {
  table: TableName;
  payload: Row;
  options: Record<string, unknown>;
};

function fakeAdmin() {
  const previewRows = new Map<string, Row>();
  const jobs = new Map<string, Row>();
  const upsertCalls: UpsertCall[] = [];
  const updateCalls: Array<{ table: TableName; payload: Row }> = [];

  const admin = {
    from(table: TableName) {
      return {
        upsert(payload: Row, options: Record<string, unknown>) {
          upsertCalls.push({ table, payload, options });
          const target = table === "message_link_previews" ? previewRows : jobs;
          const messageId = String(payload.message_id);
          if (!target.has(messageId) || options.ignoreDuplicates !== true) {
            target.set(messageId, { ...payload });
          }
          return Promise.resolve({ data: null, error: null });
        },
        select() {
          return queryBuilder(table, "select");
        },
        update(payload: Row) {
          updateCalls.push({ table, payload });
          return queryBuilder(table, "update", payload);
        },
      };
    },
  } as unknown as SupabaseClient;

  function queryBuilder(table: TableName, action: "select" | "update", payload: Row = {}) {
    const filters: Array<[string, unknown]> = [];
    const query = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return query;
      },
      in(column: string, values: unknown[]) {
        filters.push([column, values]);
        return query;
      },
      lte(column: string, value: unknown) {
        filters.push([column, value]);
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return Promise.resolve(resolve());
      },
      select() {
        return Promise.resolve(resolve());
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(resolve()).then(onFulfilled, onRejected);
      },
    };

    function resolve() {
      const target = table === "message_link_previews" ? previewRows : jobs;
      const rows = [...target.values()].filter((row) => filters.every(([column, value]) => {
        if (column === "next_attempt_at") return true;
        if (Array.isArray(value)) return value.includes(row[column]);
        return row[column] === value;
      }));
      if (action === "update") {
        for (const row of rows) Object.assign(row, payload);
        return { data: rows.map((row) => ({ message_id: row.message_id })), error: null };
      }
      return { data: rows, error: null };
    }

    return query;
  }

  return { admin, jobs, previewRows, upsertCalls, updateCalls };
}

const publicIpv4 = "93.184.216.34";
const publicIpv6 = "2606:2800:220:1:248:1893:25c8:1946";
const normalizedPublicIpv6 = "2606:2800:0220:0001:0248:1893:25c8:1946";

function resolverFor(records: Record<string, Partial<Record<"A" | "AAAA", string[]>>>): HostAddressResolver {
  return async (hostname, recordType) => records[hostname]?.[recordType] ?? [];
}

test("link extraction keeps the first lexical web URL and strips punctuation", () => {
  assert.equal(
    firstPublicHttpUrl("Read https://example.com/article). Then stop."),
    "https://example.com/article",
  );
  assert.equal(firstPublicHttpUrl("http://127.0.0.1/admin"), null);
  assert.equal(firstPublicHttpUrl("http://[::ffff:127.0.0.1]/admin"), null);
  assert.equal(firstPublicHttpUrl("https://user:pass@example.com"), null);
});

test("URL validation rejects private networks and non-web schemes", () => {
  assert.equal(validatePublicUrl("http://localhost:3000"), null);
  assert.equal(validatePublicUrl("http://192.168.1.20"), null);
  assert.equal(validatePublicUrl("http://169.254.169.254/latest"), null);
  assert.equal(validatePublicUrl("http://100.64.0.1"), null);
  assert.equal(validatePublicUrl("http://224.0.0.1"), null);
  assert.equal(validatePublicUrl("https://example.com:8443/page"), null);
  assert.equal(validatePublicUrl("http://[2001:db8::1]/page"), null);
  assert.equal(validatePublicUrl("file:///etc/passwd"), null);
  assert.equal(validatePublicUrl("https://example.com")?.hostname, "example.com");
});

test("DNS validation accepts public A-only and AAAA-only hosts", async () => {
  const resolver = resolverFor({
    "a-only.example": { A: [publicIpv4], AAAA: [] },
    "aaaa-only.example": { A: [], AAAA: [publicIpv6] },
  });

  assert.deepEqual(
    await resolvePublicHostAddresses("a-only.example", resolver),
    [publicIpv4],
  );
  assert.deepEqual(
    await resolvePublicHostAddresses("aaaa-only.example", resolver),
    [normalizedPublicIpv6],
  );
});

test("DNS validation fails closed for every private, reserved, malformed, and mixed answer", async () => {
  const unsafeAnswers = [
    "127.0.0.1", // loopback
    "169.254.169.254", // link-local
    "10.0.0.1", // RFC1918
    "100.64.0.1", // CGNAT
    "fd00::1", // unique-local
    "ff02::1", // multicast
    "192.0.2.1", // documentation/reserved
    "not-an-address", // malformed
  ];

  for (const [index, address] of unsafeAnswers.entries()) {
    const resolver = resolverFor({ [`unsafe-${index}.example`]: { A: [address], AAAA: [] } });
    assert.equal(
      await resolvePublicHostAddresses(`unsafe-${index}.example`, resolver),
      null,
      address,
    );
  }

  const mixed = resolverFor({ "mixed.example": { A: [publicIpv4, "192.168.1.2"], AAAA: [] } });
  assert.equal(await resolvePublicHostAddresses("mixed.example", mixed), null);

  const empty = resolverFor({ "empty.example": { A: [], AAAA: [] } });
  assert.equal(await resolvePublicHostAddresses("empty.example", empty), null);

  const failing: HostAddressResolver = async (_hostname, recordType) => {
    if (recordType === "A") throw new Error("dns_unavailable");
    return [publicIpv6];
  };
  assert.equal(await resolvePublicHostAddresses("failure.example", failing), null);
});

test("safe extraction skips DNS-unsafe candidates and returns the first fully safe candidate", async () => {
  const resolver = resolverFor({
    "unsafe.example": { A: ["10.0.0.5"], AAAA: [] },
    "safe.example": { A: [publicIpv4], AAAA: [] },
  });

  assert.equal(
    await firstSafePublicHttpUrl(
      "Try https://unsafe.example/private first, then https://safe.example/article.",
      resolver,
    ),
    "https://safe.example/article",
  );
});

test("enqueue persists only a version-2 proof after DNS validation and creates no job", async () => {
  const fake = fakeAdmin();
  const resolver = resolverFor({ "example.com": { A: [publicIpv4], AAAA: [] } });

  assert.equal(
    await enqueueLinkPreviewJob(fake.admin, "message-1", "See https://example.com/a", resolver),
    true,
  );
  assert.equal(fake.upsertCalls.length, 1);
  assert.equal(fake.upsertCalls[0]?.table, "message_link_previews");
  assert.deepEqual(fake.previewRows.get("message-1"), {
    message_id: "message-1",
    url: "https://example.com/a",
    hostname: "example.com",
    safe_link_validation_version: 2,
    safe_link_validated_at: fake.previewRows.get("message-1")?.safe_link_validated_at,
  });
  assert.equal(typeof fake.previewRows.get("message-1")?.safe_link_validated_at, "string");
  assert.equal(fake.jobs.size, 0);
});

test("DNS failure writes neither canonical proof nor a job", async () => {
  const fake = fakeAdmin();
  const resolver: HostAddressResolver = async () => { throw new Error("dns_down"); };

  assert.equal(
    await enqueueLinkPreviewJob(fake.admin, "message-2", "https://example.com/fails", resolver),
    false,
  );
  assert.deepEqual(fake.upsertCalls, []);
  assert.equal(fake.previewRows.size, 0);
  assert.equal(fake.jobs.size, 0);
});

test("re-enqueue preserves the first safe identity and proof", async () => {
  const fake = fakeAdmin();
  const resolver = resolverFor({ "example.com": { A: [publicIpv4], AAAA: [] } });

  assert.equal(await enqueueLinkPreviewJob(fake.admin, "message-3", "https://example.com/first", resolver), true);
  const firstProof = { ...fake.previewRows.get("message-3") };
  assert.equal(await enqueueLinkPreviewJob(fake.admin, "message-3", "https://example.com/later", resolver), true);

  assert.deepEqual(fake.previewRows.get("message-3"), firstProof);
  assert.equal(fake.upsertCalls.length, 2);
  assert.equal(fake.upsertCalls[1]?.payload.url, "https://example.com/later");
});

test("legacy pending and stranded processing jobs are terminalized without fetch or canonical-row mutation", async () => {
  const fake = fakeAdmin();
  fake.previewRows.set("message-pending", {
    message_id: "message-pending",
    url: "https://canonical.example/original",
    hostname: "canonical.example",
    title: null,
    description: null,
    site_name: null,
    safe_link_validation_version: 2,
    safe_link_validated_at: "2026-07-22T00:00:00.000Z",
  });
  fake.jobs.set("message-pending", {
    message_id: "message-pending",
    url: "https://redirect.example/to-private",
    state: "pending",
    attempt_count: 4,
    next_attempt_at: "2020-01-01T00:00:00.000Z",
  });
  fake.jobs.set("message-processing", {
    message_id: "message-processing",
    url: "https://rebind.example/sequence",
    state: "processing",
    attempt_count: 1,
    next_attempt_at: "2020-01-01T00:00:00.000Z",
  });
  const originalPreview = structuredClone(fake.previewRows.get("message-pending"));
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch must not be called");
  };
  try {
    await processLinkPreviewJobs(fake.admin, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchCalls, 0);
  assert.equal(fake.jobs.get("message-pending")?.state, "failed");
  assert.equal(fake.jobs.get("message-pending")?.last_error, "preview_fetch_disabled");
  assert.equal(fake.jobs.get("message-processing")?.state, "failed");
  assert.equal(fake.jobs.get("message-processing")?.last_error, "preview_fetch_disabled");
  assert.deepEqual(fake.previewRows.get("message-pending"), originalPreview);
  assert.equal(fake.upsertCalls.length, 0);
});
