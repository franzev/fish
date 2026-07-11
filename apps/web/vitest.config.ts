import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Mirror tsconfig's "@/*" -> "./*" path alias.
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // Next.js replaces these marker packages at build time. Tests use
      // inert aliases while the static boundary suite verifies direction.
      "server-only": fileURLToPath(
        new URL("./tests/module-markers/server-only.ts", import.meta.url)
      ),
      "client-only": fileURLToPath(
        new URL("./tests/module-markers/client-only.ts", import.meta.url)
      ),
    },
  },
  test: {
    environment: "jsdom",
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "test-results/**",
      "playwright-report/**",
    ],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
