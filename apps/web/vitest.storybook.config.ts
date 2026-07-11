import { fileURLToPath } from "node:url";
import { playwright } from "@vitest/browser-playwright";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  cacheDir: "node_modules/.cache/vitest-storybook",
  plugins: [
    react(),
    storybookTest({
      configDir: fileURLToPath(new URL("./.storybook", import.meta.url)),
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/module-markers/server-only.ts", import.meta.url)
      ),
      "client-only": fileURLToPath(
        new URL("./tests/module-markers/client-only.ts", import.meta.url)
      ),
    },
  },
  optimizeDeps: {
    include: [
      "@base-ui/react/dialog",
      "@base-ui/react/menu",
      "@base-ui/react/popover",
      "@base-ui/react/scroll-area",
      "@base-ui/react/tabs",
      "next/headers",
      "zod",
    ],
  },
  test: {
    name: "storybook",
    browser: {
      enabled: true,
      provider: playwright({}),
      headless: true,
      instances: [{ browser: "chromium" }],
    },
  },
});
