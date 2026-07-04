import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const androidDir = join(root, "apps", "android");
const apkPath = join(androidDir, "app", "build", "outputs", "apk", "debug", "app-debug.apk");
const javaHome = process.env.JAVA_HOME || "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
const startPort = Number(process.env.ANDROID_PREVIEW_PORT || 8765);

function runBuild() {
  if (!existsSync(javaHome)) {
    console.error(`Java runtime not found at ${javaHome}`);
    console.error("Open Android Studio once, or set JAVA_HOME before running this command.");
    process.exit(1);
  }

  const gradle = spawnSync("./gradlew", ["app:assembleDebug"], {
    cwd: androidDir,
    env: { ...process.env, JAVA_HOME: javaHome },
    stdio: "inherit",
  });

  if (gradle.status !== 0) {
    process.exit(gradle.status ?? 1);
  }
}

function lanIp() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return "localhost";
}

function localHostName() {
  const result = spawnSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function page({ apkUrl, fileSize }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Android Preview</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
    body { margin: 0; min-height: 100svh; display: grid; place-items: center; background: Canvas; color: CanvasText; }
    main { width: min(440px, calc(100vw - 40px)); }
    a { display: flex; min-height: 56px; align-items: center; justify-content: center; border-radius: 12px; background: CanvasText; color: Canvas; text-decoration: none; font-weight: 700; }
    p { color: color-mix(in oklab, CanvasText 72%, Canvas); line-height: 1.45; }
    small { color: color-mix(in oklab, CanvasText 56%, Canvas); }
  </style>
</head>
<body>
  <main>
    <h1>Android preview</h1>
    <p>Install the latest debug build on this phone. If Android asks, allow installs from this browser for this one preview.</p>
    <a href="${apkUrl}">Download APK</a>
    <p><small>${fileSize}</small></p>
  </main>
</body>
</html>`;
}

function listenOnFreePort(handler, port) {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.once("error", (error) => {
      if (error.code === "EADDRINUSE" && port < startPort + 20) {
        resolve(listenOnFreePort(handler, port + 1));
        return;
      }
      reject(error);
    });
    server.listen(port, "0.0.0.0", () => resolve({ server, port }));
  });
}

runBuild();

if (!existsSync(apkPath)) {
  console.error(`APK not found at ${apkPath}`);
  process.exit(1);
}

const sizeMb = `${(statSync(apkPath).size / 1024 / 1024).toFixed(1)} MB`;
const hostIp = lanIp();
const bonjour = localHostName();

const { port } = await listenOnFreePort((request, response) => {
  if (request.url === "/app-debug.apk") {
    response.writeHead(200, {
      "content-type": "application/vnd.android.package-archive",
      "content-disposition": 'attachment; filename="app-debug.apk"',
    });
    createReadStream(apkPath).pipe(response);
    return;
  }

  const apkUrl = `http://${request.headers.host}/app-debug.apk`;
  response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  response.end(page({ apkUrl, fileSize: sizeMb }));
}, startPort);

const ipUrl = `http://${hostIp}:${port}/`;
const localUrl = bonjour ? `http://${bonjour}.local:${port}/` : "";

console.log("\nAndroid preview is ready.");
if (localUrl) console.log(`Try this on your phone first: ${localUrl}`);
console.log(`Fallback LAN URL: ${ipUrl}`);
console.log("\nKeep this terminal running while you install the APK.");
