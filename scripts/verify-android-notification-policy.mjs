#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mainActivity = fs.readFileSync(
  path.join(root, "apps/android/app/src/main/kotlin/space/fishhub/android/MainActivity.kt"),
  "utf8",
);

for (const forbidden of [
  "observeNotificationPermission",
  "fish-permissions",
  "notification-requested",
]) {
  assert.equal(
    mainActivity.includes(forbidden),
    false,
    `MainActivity must not contain the unsolicited notification prompt: ${forbidden}`,
  );
}

assert.match(
  mainActivity,
  /Manifest\.permission\.POST_NOTIFICATIONS/,
  "Explicit call permission handling must remain available",
);

console.log("Android notification permission policy verification passed.");
