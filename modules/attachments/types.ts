export interface BlobSummary {
  id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  checksum: string;
}

export interface AttachInput {
  submission_id: string;
  blob_id: string;
  name?: string;
}

export interface AttachmentSummary extends BlobSummary {
  attachmentId: string;
  name: string;
}
