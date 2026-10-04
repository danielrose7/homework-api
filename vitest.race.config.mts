import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

import { raceEnv } from "./test/env.ts";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["test/race/**/*.test.ts"],
    globalSetup: ["./test/race/global-setup.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: raceEnv.appUrl,
      MIGRATION_DATABASE_URL: raceEnv.owner_url,
      BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
      BETTER_AUTH_URL: "http://localhost:3000",
    },
  },
});
