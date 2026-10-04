import { submitRoute } from "@/app/api/v1/orgs/[org_slug]/assignments/[assignment_id]/submissions/route";
import { downloadAttachmentRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/[attachment_id]/route";
import { listAttachmentsRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/attachments/route";
import { gradeSubmissionRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/grade/route";
import { getSubmissionRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/[submission_id]/route";
import { listOwnRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/me/route";
import { listSubmissionsRoute } from "@/app/api/v1/orgs/[org_slug]/submissions/route";
import type { DocumentedRoute } from "@/lib/server/route";

import { signInDoc } from "./auth-routes";
import type { RouteDoc } from "@/lib/server/route-doc";

/** Every `/api/v1` route definition, in the order the docs list them. */
export const API_ROUTES: readonly DocumentedRoute[] = [
  submitRoute,
  listOwnRoute,
  listSubmissionsRoute,
  gradeSubmissionRoute,
  getSubmissionRoute,
  listAttachmentsRoute,
  downloadAttachmentRoute,
];

export const ROUTE_DOCS: readonly RouteDoc[] = [
  signInDoc,
  ...API_ROUTES.map((route) => route.doc),
];
