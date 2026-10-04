import { z } from "zod";

import { listJson } from "@/lib/server/list-json";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { listSubmissionAttachments } from "@/modules/attachments/queries/list-submission-attachments";
import { serializeAttachment } from "@/modules/attachments/serializers";

const params = z.object({ submissionId: z.uuid() });

export const listAttachmentsRoute = defineRoute({
  resource: "submission",
  idParam: "submissionId",
  handle: async ({ ctx, input }) => {
    const { submissionId } = input.params(params);
    const attachments = await listSubmissionAttachments(ctx, submissionId);
    const url = `/api/v1/orgs/${ctx.organizationSlug}/submissions/${submissionId}/attachments`;
    return Response.json(listJson(url, attachments.map(serializeAttachment)));
  },
});

export const GET = serve(listAttachmentsRoute);
