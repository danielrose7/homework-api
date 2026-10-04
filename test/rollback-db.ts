import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";

import { createPrismaClient, type AppPrismaClient } from "@/lib/server/db";
import type { AppTransactionClient } from "@/lib/server/db-types";

import { testEnv } from "./env";

class Rollback extends Error {}

let client: AppPrismaClient | undefined;
let current: AppTransactionClient | undefined;
let release: (() => void) | undefined;
let finished: Promise<unknown> | undefined;

export function testDb(): AppTransactionClient {
  if (!current) throw new Error("testDb() used outside a test");
  return current;
}

export function withRollbackDb() {
  beforeAll(() => {
    client = createPrismaClient(testEnv.appUrl);
  });

  beforeEach(async () => {
    if (!client) throw new Error("test client not initialised");
    const db = client;
    await new Promise<void>((ready, failed) => {
      finished = db
        .$transaction(
          async (tx) => {
            current = tx;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { timeout: 120_000, maxWait: 10_000 },
        )
        .catch((error: unknown) => {
          if (!(error instanceof Rollback)) failed(error as Error);
        });
    });
  });

  afterEach(async () => {
    release?.();
    await finished;
    current = undefined;
    release = undefined;
    finished = undefined;
  });

  afterAll(async () => {
    await client?.$disconnect();
    client = undefined;
  });
}
