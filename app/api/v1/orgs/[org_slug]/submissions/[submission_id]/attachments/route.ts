import { z } from "zod";

import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { listSubmissionAttachments } from "@/modules/attachments/queries/list-submission-attachments";
import { serializeAttachmentList } from "@/modules/attachments/serializers";

const params = z.object({ submission_id: z.uuid() });

export const listAttachmentsRoute = defineRoute({
  resource: "submission",
  id_param: "submission_id",
  handle: async ({ ctx, input }) => {
    const { submission_id } = input.params(params);
    const attachments = await listSubmissionAttachments(ctx, submission_id);
    const url = `/api/v1/orgs/${ctx.organization_slug}/submissions/${submission_id}/attachments`;
    return Response.json(serializeAttachmentList(url, attachments));
  },
});

export const GET = serve(listAttachmentsRoute);
