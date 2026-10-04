import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const testFiles = ["test/**/*.ts", "**/*.test.ts", "**/__tests__/**/*.ts"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: testFiles,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/server/db",
              importNames: ["prisma"],
              message:
                "The app-wide prisma client is not wrapped in the test transaction. Use testDb() from test/rollback-db.",
            },
          ],
          patterns: [
            {
              regex: "(^|/)auth$",
              message:
                "The app-wide auth instance writes outside the test transaction. Use createAuth(testDb()) or factoryAuth().",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/generated/**",
  ]),
]);

export default eslintConfig;
