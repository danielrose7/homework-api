import type { AttachmentSummary } from "@/modules/attachments/types";

export function serializeAttachment(attachment: AttachmentSummary) {
  return {
    id: attachment.attachment_id,
    object: "attachment" as const,
    filename: attachment.filename,
    content_type: attachment.content_type,
    byte_size: attachment.byte_size,
    checksum: attachment.checksum,
  };
}
