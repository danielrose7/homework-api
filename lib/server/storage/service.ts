import type { DbClient } from "@/lib/server/db-types";

export interface StoredObject {
  organizationId: string;
  blobId: string;
  key: string;
}

/** Where a blob's bytes live. `service_name` on the blob selects the implementation. */
export interface StorageService {
  readonly name: string;
  upload(db: DbClient, object: StoredObject, bytes: Uint8Array): Promise<void>;
  download(db: DbClient, object: StoredObject): Promise<Buffer>;
}
