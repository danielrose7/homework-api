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
import { transact } from "@/lib/server/transaction";
import { attachBlobToSubmission } from "@/modules/attachments/mutations/attach-blob-to-submission";
import { createBlob } from "@/modules/attachments/mutations/create-blob";
import { listSubmissionAttachments } from "@/modules/attachments/queries/list-submission-attachments";
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

const MAX_COLLISION_RETRIES = 5;

export async function submitAssignment(
  ctx: RequestContext,
  assignment_id: string,
  input: SubmissionContent,
) {
  requirePermission(ctx, { submission: ["create"] });

  const issues = validateSubmissionContent(input);
  if (issues.length > 0) throw validationFailed(issues);

  for (let collisions = 0; ; collisions++) {
    try {
      return await saveSubmission(ctx, assignment_id, input);
    } catch (error) {
      if (!isAttemptCollision(error)) throw error;
      if (collisions >= MAX_COLLISION_RETRIES) {
        throw conflict(
          "submission_limit_reached",
          "Another submission for this assignment was saved at the same time",
        );
      }
    }
  }
}

/**
 * Another request took the same attempt number first. Postgres aborts the whole transaction, so the caller runs
 * it again: the retry either finds the limit reached (409) or numbers the next free attempt.
 */
function isAttemptCollision(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002" &&
    error.meta?.modelName === "AssignmentSubmission"
  );
}

async function saveSubmission(
  ctx: RequestContext,
  assignment_id: string,
  input: SubmissionContent,
) {
  return transact(ctx.db, async (tx) => {
    const inTransaction = { ...ctx, db: tx };

    const assignment = await tx.assignment.findFirst({
      where: { id: assignment_id, organization_id: ctx.organization_id },
    });
    if (!assignment) throw notFound();
    const seat = await tx.classSeat.findFirst({
      where: {
        organization_id: ctx.organization_id,
        class_id: assignment.class_id,
        member_id: ctx.member_id,
      },
    });
    if (!seat) throw deniedAsNotFound();

    const attempts = {
      organization_id: ctx.organization_id,
      assignment_id: assignment.id,
      class_seat_id: seat.id,
    };
    const highest = await tx.assignmentSubmission.aggregate({
      where: attempts,
      _max: { attempt_number: true },
    });
    const eligibility = submissionEligibility({
      assignment,
      seat,
      live_attempts: await tx.assignmentSubmission.count({ where: attempts }),
      // count() hides soft-deleted rows but aggregate() does not; they still hold their attempt numbers
      highest_attempt_number: highest._max.attempt_number ?? 0,
    });
    if (!eligibility.ok) throw eligibilityError(eligibility);

    const created = await tx.assignmentSubmission.create({
      data: {
        organization_id: ctx.organization_id,
        assignment_id: assignment.id,
        class_seat_id: seat.id,
        attempt_number: eligibility.attempt_number,
        text_content: input.text,
      },
      include: submissionInclude,
    });
    for (const file of input.files) {
      const blob = await createBlob(inTransaction, file);
      await attachBlobToSubmission(inTransaction, {
        submission_id: created.id,
        blob_id: blob.id,
      });
    }
    await recordActivity(tx, ctx, {
      action: "create",
      resource_type: "submission",
      resource_id: created.id,
      metadata: {
        assignment_id: assignment.id,
        attempt_number: created.attempt_number,
        attachment_count: input.files.length,
      },
    });

    return {
      submission: toSubmissionView(created),
      attachments: await listSubmissionAttachments(inTransaction, created.id),
    };
  });
}
