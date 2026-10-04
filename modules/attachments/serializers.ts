import type { AttachmentSummary } from "@/modules/attachments/types";

export function serializeAttachment(attachment: AttachmentSummary) {
  return {
    id: attachment.attachmentId,
    object: "attachment" as const,
    filename: attachment.filename,
    content_type: attachment.contentType,
    byte_size: attachment.byteSize,
    checksum: attachment.checksum,
  };
}
