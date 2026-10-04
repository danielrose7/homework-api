import {
  percentOf,
  findManualBand,
  lookupBand,
  type Band,
} from "@/lib/domain/grading";
import {
  validateGradeRequest,
  type GradeRequest,
} from "@/lib/domain/grade-request";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import {
  notFound,
  preconditionFailed,
  preconditionRequired,
  validationFailed,
} from "@/lib/server/errors";
import { requireTeachesClass } from "@/lib/server/services/academics";
import {
  loadScale,
  resolveGradingScale,
} from "@/lib/server/services/grading-scales";
import { transact } from "@/lib/server/transaction";

export interface GradeCommand extends GradeRequest {
  /** The `gradedAt` the caller last saw. Required when the submission is already graded. */
  expectedGradedAt?: string | null;
}

export interface GradeResult {
  submissionId: string;
  gradedAt: string;
  teacherNotes: string | null;
  grade: {
    bandId: string;
    scaleId: string;
    label: string;
    group: string;
    pointsAwarded: string | null;
    maxPoints: string | null;
    percent: string | null;
  };
}

interface ApplyGradeParams {
  organizationId: string;
  submissionId: string;
  gradedById: string;
  now: Date;
  scaleId: string;
  band: Band;
  pointsAwarded: string | null;
  maxPoints: string | null;
  teacherNotes: string | null;
  reason: string | null;
}

/** Writes the current grade and its history row. No authorization or validation; callers do that. */
export async function applyGrade(
  tx: DbClient,
  params: ApplyGradeParams,
): Promise<GradeResult> {
  const group = params.band.groupLabel ?? params.band.label;

  await tx.assignmentSubmission.update({
    where: {
      organizationId_id: {
        organizationId: params.organizationId,
        id: params.submissionId,
      },
    },
    data: {
      pointsAwarded: params.pointsAwarded,
      gradingScaleId: params.scaleId,
      gradeBandId: params.band.id,
      gradeLabel: params.band.label,
      gradeGroup: group,
      teacherNotes: params.teacherNotes,
      gradedAt: params.now,
      gradedById: params.gradedById,
    },
  });
  await tx.submissionGradeEvent.create({
    data: {
      organizationId: params.organizationId,
      submissionId: params.submissionId,
      pointsAwarded: params.pointsAwarded,
      maxPoints: params.maxPoints,
      gradingScaleId: params.scaleId,
      gradeBandId: params.band.id,
      gradeLabel: params.band.label,
      gradeGroup: group,
      teacherNotes: params.teacherNotes,
      reason: params.reason,
      gradedById: params.gradedById,
      createdAt: params.now,
    },
  });

  return {
    submissionId: params.submissionId,
    gradedAt: params.now.toISOString(),
    teacherNotes: params.teacherNotes,
    grade: {
      bandId: params.band.id,
      scaleId: params.scaleId,
      label: params.band.label,
      group,
      pointsAwarded: params.pointsAwarded,
      maxPoints: params.maxPoints,
      percent:
        params.pointsAwarded !== null && params.maxPoints !== null
          ? percentOf(params.pointsAwarded, params.maxPoints)
          : null,
    },
  };
}

export async function gradeSubmission(
  ctx: RequestContext,
  submissionId: string,
  command: GradeCommand,
): Promise<GradeResult> {
  requirePermission(ctx, { grade: ["update"] });

  return transact(ctx.db, async (tx) => {
    const scoped: RequestContext = { ...ctx, db: tx };

    await tx.$queryRaw`SELECT id FROM assignment_submission WHERE id = ${submissionId}::uuid AND organization_id = ${ctx.organizationId}::uuid FOR UPDATE`;

    const submission = await tx.assignmentSubmission.findFirst({
      where: { id: submissionId, organizationId: ctx.organizationId },
    });
    if (!submission) throw notFound();
    const assignment = await tx.assignment.findFirst({
      where: {
        id: submission.assignmentId,
        organizationId: ctx.organizationId,
      },
    });
    if (!assignment) throw notFound();
    const klass = await tx.class.findFirst({
      where: { id: assignment.classId, organizationId: ctx.organizationId },
    });
    if (!klass) throw notFound();
    await requireTeachesClass(scoped, assignment.classId);

    const currentVersion = submission.gradedAt?.toISOString() ?? null;
    if (currentVersion !== null) {
      if (command.expectedGradedAt == null) throw preconditionRequired();
      if (command.expectedGradedAt !== currentVersion)
        throw preconditionFailed();
    } else if (command.expectedGradedAt != null) {
      throw preconditionFailed();
    }

    const scale = submission.gradingScaleId
      ? await loadScale(tx, ctx.organizationId, submission.gradingScaleId)
      : await resolveGradingScale(tx, {
          organizationId: ctx.organizationId,
          assignmentScaleId: assignment.gradingScaleId,
          classScaleId: klass.gradingScaleId,
        });
    if (!scale) throw notFound();

    const maxPoints = assignment.maxPoints?.toString() ?? null;
    const currentBand =
      scale.bands.find((band) => band.id === submission.gradeBandId) ?? null;
    const issues = validateGradeRequest(command, {
      assignment: { gradingMode: assignment.gradingMode, maxPoints },
      bands: scale.bands,
      currentBand,
    });
    if (issues.length > 0) throw validationFailed(issues);

    const band =
      command.points != null && maxPoints !== null
        ? lookupBand(scale.bands, command.points, maxPoints)
        : findManualBand(scale.bands, command.band ?? "");
    if (!band) throw notFound();

    const result = await applyGrade(tx, {
      organizationId: ctx.organizationId,
      submissionId,
      gradedById: ctx.memberId,
      now: new Date(),
      scaleId: scale.id,
      band,
      pointsAwarded: command.points ?? null,
      maxPoints,
      teacherNotes: command.teacherNotes ?? null,
      reason: command.reason?.trim() || null,
    });

    await recordActivity(tx, ctx, {
      action: "grade",
      resourceType: "submission",
      resourceId: submissionId,
      metadata: { assignmentId: assignment.id, bandId: band.id },
    });
    return result;
  });
}
