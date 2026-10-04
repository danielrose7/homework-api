import { createAuth, type Auth } from "@/lib/server/auth-factory";
import type { DbClient } from "@/lib/server/db-types";

import { testDb } from "../rollback-db";

let provider: () => DbClient = testDb;
const authByDb = new WeakMap<object, Auth>();

export function setFactoryDb(next: () => DbClient) {
  provider = next;
}

export function factoryDb(): DbClient {
  return provider();
}

export function factoryAuth(): Auth {
  const db = factoryDb();
  let auth = authByDb.get(db);
  if (!auth) {
    auth = createAuth(db);
    authByDb.set(db, auth);
  }
  return auth;
}
