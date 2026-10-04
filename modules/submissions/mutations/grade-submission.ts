import {
  findManualBand,
  lookupBand,
  percentOf,
  type Band,
} from "@/lib/domain/grading";
import {
  validateGradeRequest,
  type GradeRequest,
} from "@/lib/domain/grade-request";
import { recordActivity } from "@/lib/server/activity";
import { requirePermission, type RequestContext } from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import { notFound, validationFailed } from "@/lib/server/errors";
import { transact } from "@/lib/server/transaction";
import { requireTeachesClass } from "@/modules/academics/queries/access";
import { loadGradingScale } from "@/modules/grading-scales/queries/load-grading-scale";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";

export interface GradeResult {
  submission_id: string;
  graded_at: string;
  teacher_notes: string | null;
  grade: {
    band_id: string;
    scale_id: string;
    label: string;
    group: string;
    points_awarded: string | null;
    max_points: string | null;
    percent: string | null;
  };
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
  const group = params.band.group_label ?? params.band.label;

  await tx.assignmentSubmission.update({
    where: {
      organization_id_id: {
        organization_id: params.organization_id,
        id: params.submission_id,
      },
    },
    data: {
      points_awarded: params.points_awarded,
      grading_scale_id: params.scale_id,
      grade_band_id: params.band.id,
      grade_label: params.band.label,
      grade_group: group,
      teacher_notes: params.teacher_notes,
      graded_at: params.now,
      graded_by_id: params.graded_by_id,
    },
  });
  await tx.submissionGradeEvent.create({
    data: {
      organization_id: params.organization_id,
      submission_id: params.submission_id,
      points_awarded: params.points_awarded,
      max_points: params.max_points,
      grading_scale_id: params.scale_id,
      grade_band_id: params.band.id,
      grade_label: params.band.label,
      grade_group: group,
      teacher_notes: params.teacher_notes,
      reason: params.reason,
      graded_by_id: params.graded_by_id,
      created_at: params.now,
    },
  });

  return {
    submission_id: params.submission_id,
    graded_at: params.now.toISOString(),
    teacher_notes: params.teacher_notes,
    grade: {
      band_id: params.band.id,
      scale_id: params.scale_id,
      label: params.band.label,
      group,
      points_awarded: params.points_awarded,
      max_points: params.max_points,
      percent:
        params.points_awarded !== null && params.max_points !== null
          ? percentOf(params.points_awarded, params.max_points)
          : null,
    },
  };
}

export async function gradeSubmission(
  ctx: RequestContext,
  submission_id: string,
  command: GradeRequest,
): Promise<GradeResult> {
  requirePermission(ctx, { grade: ["update"] });

  return transact(ctx.db, async (tx) => {
    const scoped: RequestContext = { ...ctx, db: tx };

    await tx.$queryRaw`SELECT id FROM assignment_submission WHERE id = ${submission_id}::uuid AND organization_id = ${ctx.organization_id}::uuid FOR UPDATE`;

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
    await requireTeachesClass(scoped, assignment.class_id);

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
    const issues = validateGradeRequest(command, {
      assignment: { grading_mode: assignment.grading_mode, max_points },
      bands: scale.bands,
      current_band,
    });
    if (issues.length > 0) throw validationFailed(issues);

    const band =
      command.points != null && max_points !== null
        ? lookupBand(scale.bands, command.points, max_points)
        : findManualBand(scale.bands, command.band ?? "");
    if (!band) throw notFound();

    const result = await applyGrade(tx, {
      organization_id: ctx.organization_id,
      submission_id,
      graded_by_id: ctx.member_id,
      now: new Date(),
      scale_id: scale.id,
      band,
      points_awarded: command.points ?? null,
      max_points,
      teacher_notes: command.teacher_notes ?? null,
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
