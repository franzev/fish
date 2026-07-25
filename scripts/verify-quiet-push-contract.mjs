// Guards the one thing per-conversation quiet must never get wrong: a member
// who silenced a conversation must not receive a banner, and must still get an
// accurate badge. APNs cannot be reached from a local stack, so these are
// source-level contract checks, in the same shape as the VoIP push contract.
import { readFile } from "node:fs/promises";

const files = {
  apns: "supabase/functions/_shared/apns.ts",
  fcm: "supabase/functions/_shared/fcm.ts",
  send: "supabase/functions/send-message/index.ts",
  mute: "supabase/functions/_shared/conversation-mute.ts",
};
const source = Object.fromEntries(
  await Promise.all(
    Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")]),
  ),
);

let failures = 0;
function check(label, value) {
  console.log(`${value ? "PASS" : "FAIL"} — ${label}`);
  if (!value) failures += 1;
}

function sliceFrom(text, marker) {
  const start = text.indexOf(marker);
  if (start < 0) return "";
  const rest = text.slice(start + marker.length);
  const end = rest.indexOf("\nexport ");
  return rest.slice(0, end < 0 ? undefined : end);
}

const badgeDispatcher = sliceFrom(source.apns, "export async function dispatchQuietBadgeApns");
check("a quiet conversation has a badge-only dispatcher", badgeDispatcher.length > 0);
check(
  "the quiet push carries a badge",
  badgeDispatcher.includes("aps: { badge:"),
);
check(
  "the quiet push carries nothing that would show a banner or make a sound",
  !badgeDispatcher.includes("alert:") &&
    !badgeDispatcher.includes("sound") &&
    !badgeDispatcher.includes("category") &&
    !badgeDispatcher.includes("thread-id"),
);
check(
  "the quiet push is sent at power-considerate priority",
  badgeDispatcher.includes('"5"'),
);
check(
  "a recipient with no known count is skipped rather than badged zero",
  badgeDispatcher.includes("return null"),
);

const fanOut = sliceFrom(source.fcm, "export async function dispatchDirectMessagePush");
check(
  "the fan-out takes one partition rather than two independent lists",
  fanOut.includes("const { notified, quiet } = push.recipients;"),
);
check(
  "only the badge dispatcher receives the quiet half",
  fanOut.includes("dispatchQuietBadgeApns(admin, {\n      recipientIds: quiet,") &&
    (fanOut.match(/recipientIds: quiet/g) ?? []).length === 1,
);
check(
  "every alerting dispatch receives the notified half",
  fanOut.includes("...notified.map((recipientId) => dispatchAndroidDataPush") &&
    fanOut.includes("recipientIds: notified,"),
);
check(
  "no alerting dispatch reads the quiet half",
  !fanOut.slice(0, fanOut.indexOf("dispatchQuietBadgeApns")).includes("quiet."),
);

check(
  "the two halves come from one pass over the members",
  source.mute.includes("export function partitionByQuiet") &&
    source.send.includes("const recipients = partitionByQuiet("),
);
check(
  "badge counts are read for every member, not just the notified ones",
  source.send.includes("members.map(async (recipientId) => {"),
);

if (failures) process.exitCode = 1;
