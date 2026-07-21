import { readFile } from "node:fs/promises";

const files = {
  migration: "supabase/migrations/0056_ios_voip_push_devices.sql",
  command: "supabase/functions/push-command/index.ts",
  apns: "supabase/functions/_shared/apns.ts",
  fcm: "supabase/functions/_shared/fcm.ts",
  ios: "apps/ios/App/Sources/VoipPushCoordinator.swift",
  project: "apps/ios/App/project.yml",
};
const source = Object.fromEntries(
  await Promise.all(Object.entries(files).map(async ([key, path]) => [key, await readFile(path, "utf8")])),
);
let failures = 0;
function check(label, value) {
  console.log(`${value ? "PASS" : "FAIL"} — ${label}`);
  if (!value) failures += 1;
}

check("push kind is constrained and coexistence is unique per user/install/kind", source.migration.includes("push_kind") && source.migration.includes("unique (user_id, installation_id, push_kind)"));
check("VoIP registration is iOS-only at the command boundary", source.command.includes('action: z.literal("register_voip")') && source.command.includes('platform: z.literal("ios")'));
check("VoIP APNs uses the .voip topic and high-priority header", source.apns.includes('`${config.topic}.voip`') && source.apns.includes('"apns-push-type": "voip"') && source.apns.includes('"apns-priority": "10"'));
check("VoIP APNs queries voip rows only", source.apns.includes('.eq("push_kind", "voip")'));
check("VoIP APNs retries transient failures and revokes stale tokens", source.apns.includes("response.status === 429") && source.apns.includes("shouldRevoke(response.status, payload)"));
const voipDispatcher = source.apns.slice(source.apns.indexOf("export async function dispatchVoipCallApns"));
check("VoIP payload avoids message content and carries only call recovery data", voipDispatcher.includes("callId: push.callId") && voipDispatcher.includes("callerName: push.callerName") && !voipDispatcher.includes("messageId") && !voipDispatcher.includes("senderName"));
check("call push dispatch sends APNs only for ringing", source.fcm.includes('push.event === "ringing"') && source.fcm.includes("dispatchVoipCallApns"));
check("PushKit requests voIP tokens and always completes delivery", source.ios.includes("desiredPushTypes = [.voIP]") && source.ios.includes("defer { completion() }"));
check("iOS app declares audio and voip background modes", source.project.includes("UIBackgroundModes: [audio, voip]"));

if (failures) process.exitCode = 1;
