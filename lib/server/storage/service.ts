import type { DbClient } from "@/lib/server/db-types";

export interface StoredObject {
  organization_id: string;
  blob_id: string;
  key: string;
}

/** Where a blob's bytes live. `service_name` on the blob selects the implementation. */
export interface StorageService {
  readonly name: string;
  upload(db: DbClient, object: StoredObject, bytes: Uint8Array): Promise<void>;
  download(db: DbClient, object: StoredObject): Promise<Buffer>;
}
