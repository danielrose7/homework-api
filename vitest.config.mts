import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { testEnv } from "./test/env.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    globalSetup: ["./test/global-setup.ts"],
    setupFiles: ["./test/setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: testEnv.appUrl,
      MIGRATION_DATABASE_URL: testEnv.ownerUrl,
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
