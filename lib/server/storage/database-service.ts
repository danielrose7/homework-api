import type { StorageService } from "./service";

/** Keeps bytes in `storage_blob_data`, one row per blob, kept apart from the blob's metadata. */
export const databaseStorage: StorageService = {
  name: "database",

  async upload(db, object, bytes) {
    await db.storageBlobData.create({
      data: {
        organizationId: object.organizationId,
        blobId: object.blobId,
        content: Buffer.from(bytes),
      },
    });
  },

  async download(db, object) {
    const row = await db.storageBlobData.findUniqueOrThrow({
      where: {
        organizationId_blobId: {
          organizationId: object.organizationId,
          blobId: object.blobId,
        },
      },
    });
    return Buffer.from(row.content);
  },
};
