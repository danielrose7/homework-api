import type { StorageService } from "./service";

/** Keeps bytes in `storage_blob_data`, one row per blob, kept apart from the blob's metadata. */
export const databaseStorage: StorageService = {
  name: "database",

  async upload(db, object, bytes) {
    await db.storageBlobData.create({
      data: {
        organization_id: object.organization_id,
        blob_id: object.blob_id,
        content: Buffer.from(bytes),
      },
    });
  },

  async download(db, object) {
    const row = await db.storageBlobData.findUniqueOrThrow({
      where: {
        organization_id_blob_id: {
          organization_id: object.organization_id,
          blob_id: object.blob_id,
        },
      },
    });
    return Buffer.from(row.content);
  },
};
