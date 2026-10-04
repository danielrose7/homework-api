import { z } from "zod";

import { STATUS } from "@/lib/http-status";
import { defineRoute } from "@/lib/server/route";
import { serve } from "@/lib/server/serve";
import { listSubmissionAttachments } from "@/modules/attachments/queries/list-submission-attachments";
import { serializeAttachmentList } from "@/modules/attachments/serializers";

const params = z.object({
  submission_id: z.uuid().describe("The submission the files belong to."),
});

export const listAttachmentsRoute = defineRoute({
  resource: "submission",
  id_param: "submission_id",
  doc: {
    id: "list_attachments",
    method: "GET",
    path: "/api/v1/orgs/{org_slug}/submissions/{submission_id}/attachments",
    group: "Shared",
    title: "List attachments",
    summary: "List the metadata of the files attached to a submission.",
    description:
      "Same access rules as the submission. Each item carries a `url` to download the bytes.",
    roles: ["student", "teacher", "administrator"],
    params,
    success: {
      status: STATUS.ok,
      description: "A list object of attachments.",
    },
    errors: [
      {
        status: STATUS.not_found,
        code: "not_found",
        description: "No such submission, or one the caller may not see.",
      },
    ],
  },
  handle: async ({ ctx, input }) => {
    const { submission_id } = input.params(params);
    const attachments = await listSubmissionAttachments(ctx, submission_id);
    const url = `/api/v1/orgs/${ctx.organization_slug}/submissions/${submission_id}/attachments`;
    return Response.json(serializeAttachmentList(url, attachments));
  },
});

export const GET = serve(listAttachmentsRoute);
