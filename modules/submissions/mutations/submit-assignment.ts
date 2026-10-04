import {
  submissionEligibility,
  validateSubmissionContent,
  type EligibilityResult,
  type SubmissionContent,
} from "@/lib/domain/submission";
import { Prisma } from "@/lib/generated/prisma/client";
import { STATUS } from "@/lib/http-status";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import {
  ApiError,
  conflict,
  deniedAsNotFound,
  notFound,
  validationFailed,
} from "@/lib/server/errors";
import {
  attachBlobToSubmission,
  createBlob,
  listSubmissionAttachments,
} from "@/lib/server/services/attachments";
import { transact } from "@/lib/server/transaction";
import { toSubmissionView } from "@/modules/submissions/serializers";
import { submissionInclude } from "@/modules/submissions/types";

function eligibilityError(failure: Extract<EligibilityResult, { ok: false }>) {
  switch (failure.status) {
    case STATUS.not_found:
      return notFound();
    case STATUS.forbidden:
      return new ApiError(
        STATUS.forbidden,
        failure.code,
        "You are not actively enrolled in this class",
        [],
        true,
      );
    case STATUS.conflict:
      return conflict(
        failure.code,
        "You have used all your submissions for this assignment",
      );
  }
}

export async function submitAssignment(
  ctx: RequestContext,
  assignmentId: string,
  input: SubmissionContent,
) {
  requirePermission(ctx, { submission: ["create"] });

  const issues = validateSubmissionContent(input);
  if (issues.length > 0) throw validationFailed(issues);

  try {
    return await transact(ctx.db, async (tx) => {
      const inTransaction = { ...ctx, db: tx };

      const assignment = await tx.assignment.findFirst({
        where: { id: assignmentId, organizationId: ctx.organizationId },
      });
      if (!assignment) throw notFound();
      const seat = await tx.classSeat.findFirst({
        where: {
          organizationId: ctx.organizationId,
          classId: assignment.classId,
          memberId: ctx.memberId,
        },
      });
      if (!seat) throw deniedAsNotFound();

      const eligibility = submissionEligibility({
        assignment,
        seat,
        attemptsSoFar: await tx.assignmentSubmission.count({
          where: {
            organizationId: ctx.organizationId,
            assignmentId: assignment.id,
            classSeatId: seat.id,
          },
        }),
      });
      if (!eligibility.ok) throw eligibilityError(eligibility);

      const created = await tx.assignmentSubmission.create({
        data: {
          organizationId: ctx.organizationId,
          assignmentId: assignment.id,
          classSeatId: seat.id,
          attemptNumber: eligibility.attemptNumber,
          textContent: input.text,
        },
        include: submissionInclude,
      });
      for (const file of input.files) {
        const blob = await createBlob(inTransaction, file);
        await attachBlobToSubmission(inTransaction, {
          submissionId: created.id,
          blobId: blob.id,
        });
      }
      await recordActivity(tx, ctx, {
        action: "create",
        resourceType: "submission",
        resourceId: created.id,
        metadata: {
          assignmentId: assignment.id,
          attemptNumber: created.attemptNumber,
          attachmentCount: input.files.length,
        },
      });

      return {
        submission: toSubmissionView(created),
        attachments: await listSubmissionAttachments(inTransaction, created.id),
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw conflict(
        "submission_limit_reached",
        "Another submission for this assignment was saved at the same time",
      );
    }
    throw error;
  }
}
