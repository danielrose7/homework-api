export interface BlobSummary {
  id: string;
  filename: string;
  contentType: string;
  byteSize: number;
  checksum: string;
}

export interface AttachInput {
  submissionId: string;
  blobId: string;
  name?: string;
}

export interface AttachmentSummary extends BlobSummary {
  attachmentId: string;
  name: string;
}
