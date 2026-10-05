import { findManualBand, lookupBand, type Band } from "@/lib/domain/grading";
import { toHundredths } from "@/lib/domain/decimal";
import {
  validateGradeRequest,
  type GradeRequest,
} from "@/lib/domain/grade-request";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import { notFound, validationFailed } from "@/lib/server/errors";
import { transact } from "@/lib/server/transaction";
import { requireTeachesClass } from "@/lib/server/access";
import { toGradeResult } from "@/modules/submissions/serializers";
import type { GradeResult } from "@/modules/submissions/types";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";

function samePoints(current: string | null, requested: string | null) {
  if (current === null || requested === null) return current === requested;
  return toHundredths(current) === toHundredths(requested);
}

interface ApplyGradeParams {
  organization_id: string;
  submission_id: string;
  graded_by_id: string;
  now: Date;
  scale_id: string;
  band: Band;
  points_awarded: string | null;
  max_points: string | null;
  teacher_notes: string | null;
  reason: string | null;
}

export async function applyGrade(
  tx: DbClient,
  params: ApplyGradeParams,
): Promise<GradeResult> {
  const { organization_id, submission_id, band, now } = params;
  const group = band.group_label ?? band.label;
  const snapshot = {
    points_awarded: params.points_awarded,
    grading_scale_id: params.scale_id,
    grade_band_id: band.id,
    grade_label: band.label,
    grade_group: group,
    teacher_notes: params.teacher_notes,
    graded_by_id: params.graded_by_id,
  };

  await tx.assignmentSubmission.update({
    where: { organization_id_id: { organization_id, id: submission_id } },
    data: { ...snapshot, graded_at: now },
  });
  await tx.submissionGradeEvent.create({
    data: {
      ...snapshot,
      organization_id,
      submission_id,
      max_points: params.max_points,
      reason: params.reason,
      created_at: now,
    },
  });

  return toGradeResult({
    submission_id,
    graded_at: now,
    teacher_notes: params.teacher_notes,
    scale_id: params.scale_id,
    band_id: band.id,
    label: band.label,
    group,
    points_awarded: params.points_awarded,
    max_points: params.max_points,
  });
}

async function loadGradingTarget(
  tx: DbClient,
  ctx: RequestContext,
  submission_id: string,
) {
  const submission = await tx.assignmentSubmission.findFirst({
    where: { id: submission_id, organization_id: ctx.organization_id },
  });
  if (!submission) throw notFound();
  const assignment = await tx.assignment.findFirst({
    where: {
      id: submission.assignment_id,
      organization_id: ctx.organization_id,
    },
  });
  if (!assignment) throw notFound();
  const klass = await tx.class.findFirst({
    where: { id: assignment.class_id, organization_id: ctx.organization_id },
  });
  if (!klass) throw notFound();
  await requireTeachesClass({ ...ctx, db: tx }, assignment.class_id);
  return { submission, assignment, klass };
}

export async function gradeSubmission(
  ctx: RequestContext,
  submission_id: string,
  command: GradeRequest,
): Promise<GradeResult> {
  requirePermission(ctx, { grade: ["update"] });

  return transact(ctx.db, async (tx) => {
    await tx.$queryRaw`SELECT id FROM assignment_submission WHERE id = ${submission_id}::uuid AND organization_id = ${ctx.organization_id}::uuid FOR UPDATE`;

    const { submission, assignment, klass } = await loadGradingTarget(
      tx,
      ctx,
      submission_id,
    );

    const scale = submission.grading_scale_id
      ? await loadGradingScale(
          tx,
          ctx.organization_id,
          submission.grading_scale_id,
        )
      : await resolveGradingScale(tx, {
          organization_id: ctx.organization_id,
          assignment_scale_id: assignment.grading_scale_id,
          class_scale_id: klass.grading_scale_id,
        });
    if (!scale) throw notFound();

    const max_points = assignment.max_points?.toString() ?? null;
    const current_band =
      scale.bands.find((band) => band.id === submission.grade_band_id) ?? null;
    const band =
      command.points != null && max_points !== null
        ? lookupBand(scale.bands, command.points, max_points)
        : findManualBand(scale.bands, command.band ?? "");
    const points_awarded = command.points ?? null;
    const teacher_notes = command.teacher_notes ?? null;
    const unchanged =
      band !== null &&
      submission.grading_scale_id === scale.id &&
      submission.grade_band_id === band.id &&
      samePoints(
        submission.points_awarded?.toString() ?? null,
        points_awarded,
      ) &&
      submission.teacher_notes === teacher_notes;
    const issues = validateGradeRequest(command, {
      assignment: { grading_mode: assignment.grading_mode, max_points },
      bands: scale.bands,
      current_band,
      unchanged,
    });
    if (issues.length > 0) throw validationFailed(issues);

    if (!band) throw notFound();
    if (unchanged && submission.graded_at !== null) {
      return toGradeResult({
        submission_id,
        graded_at: submission.graded_at,
        teacher_notes,
        scale_id: scale.id,
        band_id: band.id,
        label: submission.grade_label ?? band.label,
        group: submission.grade_group ?? band.group_label ?? band.label,
        points_awarded,
        max_points,
      });
    }

    const result = await applyGrade(tx, {
      organization_id: ctx.organization_id,
      submission_id,
      graded_by_id: ctx.member_id,
      now: new Date(),
      scale_id: scale.id,
      band,
      points_awarded,
      max_points,
      teacher_notes,
      reason: command.reason?.trim() || null,
    });

    await recordActivity(tx, ctx, {
      action: "grade",
      resource_type: "submission",
      resource_id: submission_id,
      metadata: { assignment_id: assignment.id, band_id: band.id },
    });
    return result;
  });
}
