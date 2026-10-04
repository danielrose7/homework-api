import { toHundredths } from "@/lib/domain/decimal";
import { validateRange, validateTerm } from "@/lib/domain/terms";
import { issue, type ValidationIssue } from "@/lib/domain/validation";
import { recordActivity } from "@/lib/server/activity";
import {
  requirePermission,
  requireRole,
  type RequestContext,
} from "@/lib/server/context";
import type { DbClient } from "@/lib/server/db-types";
import {
  conflict,
  forbidden,
  notFound,
  validationFailed,
} from "@/lib/server/errors";

const MAX_POINTS_LIMIT = 99_999_99;
const MAX_ATTEMPTS = 20;

const day = (value: string) => new Date(`${value}T00:00:00Z`);
const formatDay = (value: Date) => value.toISOString().slice(0, 10);

function fail(issues: ValidationIssue[]) {
  if (issues.length > 0) throw validationFailed(issues);
}

function requireName(value: string, field = "name", limit = 120) {
  const name = value.trim();
  if (!name) return [issue(field, "name_required", "A name is required")];
  if (name.length > limit) {
    return [issue(field, "too_long", `Use at most ${limit} characters`)];
  }
  return [];
}

export interface YearInput {
  name: string;
  startsOn: string;
  endsOn: string;
}

export async function createAcademicYear(
  ctx: RequestContext,
  input: YearInput,
) {
  requireRole(ctx, "administrator");
  const issues = [...requireName(input.name), ...validateRange(input)];
  if (issues.length === 0) {
    const taken = await ctx.db.academicYear.findFirst({
      where: { organizationId: ctx.organizationId, name: input.name.trim() },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.academicYear.create({
    data: {
      organizationId: ctx.organizationId,
      name: input.name.trim(),
      startsOn: day(input.startsOn),
      endsOn: day(input.endsOn),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "academic_year",
    resourceId: row.id,
  });
  return {
    id: row.id,
    name: row.name,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };
}

export interface TermInput {
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export async function createTerm(ctx: RequestContext, input: TermInput) {
  requireRole(ctx, "administrator");
  const year = await ctx.db.academicYear.findFirst({
    where: { id: input.academicYearId, organizationId: ctx.organizationId },
  });
  if (!year) {
    throw validationFailed([
      issue("academicYearId", "not_found", "Academic year not found"),
    ]);
  }

  const siblings = await ctx.db.term.findMany({
    where: { organizationId: ctx.organizationId, academicYearId: year.id },
  });
  const issues = [
    ...requireName(input.name),
    ...validateTerm(
      input,
      { startsOn: formatDay(year.startsOn), endsOn: formatDay(year.endsOn) },
      siblings.map((term) => ({
        id: term.id,
        name: term.name,
        startsOn: formatDay(term.startsOn),
        endsOn: formatDay(term.endsOn),
      })),
    ),
  ];
  if (siblings.some((term) => term.name === input.name.trim())) {
    issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.term.create({
    data: {
      organizationId: ctx.organizationId,
      academicYearId: year.id,
      name: input.name.trim(),
      startsOn: day(input.startsOn),
      endsOn: day(input.endsOn),
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "term",
    resourceId: row.id,
  });
  return {
    id: row.id,
    academicYearId: year.id,
    name: row.name,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
  };
}

export interface ClassInput {
  termId: string;
  name: string;
  gradingScaleId?: string | null;
}

async function scaleIssue(
  db: DbClient,
  organizationId: string,
  gradingScaleId: string | null | undefined,
): Promise<ValidationIssue[]> {
  if (!gradingScaleId) return [];
  const scale = await db.gradingScale.findFirst({
    where: { id: gradingScaleId, organizationId },
  });
  return scale
    ? []
    : [issue("gradingScaleId", "not_found", "Grading scale not found")];
}

export async function createClass(ctx: RequestContext, input: ClassInput) {
  requireRole(ctx, "administrator");
  const term = await ctx.db.term.findFirst({
    where: { id: input.termId, organizationId: ctx.organizationId },
  });
  const issues = [
    ...requireName(input.name),
    ...(term ? [] : [issue("termId", "not_found", "Term not found")]),
    ...(await scaleIssue(ctx.db, ctx.organizationId, input.gradingScaleId)),
  ];
  if (term) {
    const taken = await ctx.db.class.findFirst({
      where: {
        organizationId: ctx.organizationId,
        termId: term.id,
        name: input.name.trim(),
      },
    });
    if (taken)
      issues.push(issue("name", "name_taken", "That name is already used"));
  }
  fail(issues);

  const row = await ctx.db.class.create({
    data: {
      organizationId: ctx.organizationId,
      termId: input.termId,
      name: input.name.trim(),
      gradingScaleId: input.gradingScaleId ?? null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class",
    resourceId: row.id,
  });
  return {
    id: row.id,
    termId: row.termId,
    name: row.name,
    gradingScaleId: row.gradingScaleId,
  };
}

async function requireClass(ctx: RequestContext, classId: string) {
  const row = await ctx.db.class.findFirst({
    where: { id: classId, organizationId: ctx.organizationId },
  });
  if (!row) throw notFound();
  return row;
}

async function memberWithRole(
  ctx: RequestContext,
  memberId: string,
  role: "teacher" | "student",
) {
  const member = await ctx.db.member.findFirst({
    where: { id: memberId, organizationId: ctx.organizationId },
  });
  if (!member) {
    throw validationFailed([
      issue("memberId", "not_found", "Member not found"),
    ]);
  }
  if (member.role !== role) {
    throw validationFailed([
      issue("memberId", "wrong_role", `This member is not a ${role}`),
    ]);
  }
  return member;
}

export async function addClassTeacher(
  ctx: RequestContext,
  classId: string,
  memberId: string,
) {
  requireRole(ctx, "administrator");
  const klass = await requireClass(ctx, classId);
  const member = await memberWithRole(ctx, memberId, "teacher");

  const existing = await ctx.db.classTeacher.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  if (existing)
    throw conflict("already_assigned", "Already teaching this class");

  const row = await ctx.db.classTeacher.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class_teacher",
    resourceId: row.id,
    metadata: { classId: klass.id, memberId: member.id },
  });
  return { id: row.id, classId: klass.id, memberId: member.id };
}

export async function addClassSeat(
  ctx: RequestContext,
  classId: string,
  memberId: string,
) {
  requireRole(ctx, "administrator");
  const klass = await requireClass(ctx, classId);
  const member = await memberWithRole(ctx, memberId, "student");

  const existing = await ctx.db.classSeat.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  if (existing)
    throw conflict("seat_exists", "Already has a seat in this class");

  const row = await ctx.db.classSeat.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      memberId: member.id,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "class_seat",
    resourceId: row.id,
    metadata: { classId: klass.id, memberId: member.id },
  });
  return {
    id: row.id,
    classId: klass.id,
    memberId: member.id,
    status: row.status,
  };
}

export async function requireTeachesClass(
  ctx: RequestContext,
  classId: string,
) {
  if (ctx.role === "administrator") return;
  if (ctx.role !== "teacher") throw forbidden();
  const assignment = await ctx.db.classTeacher.findFirst({
    where: {
      organizationId: ctx.organizationId,
      classId,
      memberId: ctx.memberId,
    },
  });
  if (!assignment) throw notFound();
}

export type AssignmentKind = "homework" | "exam" | "quiz" | "project";

export interface AssignmentInput {
  title: string;
  description?: string | null;
  type: AssignmentKind;
  gradingMode?: "points" | "band";
  maxPoints?: string | null;
  gradingScaleId?: string | null;
  dueAt?: Date | null;
  maxSubmissions?: number;
  publish?: boolean;
}

export function validateAssignmentInput(
  input: AssignmentInput,
): ValidationIssue[] {
  const issues = requireName(input.title, "title", 200);
  const mode = input.gradingMode ?? "points";

  const rawMax = input.maxPoints ?? null;
  const hasMax = rawMax !== null;
  if (mode === "points") {
    const max = rawMax === null ? null : toHundredths(rawMax);
    if (!hasMax) {
      issues.push(
        issue("maxPoints", "max_points_required", "Points are required"),
      );
    } else if (max === null) {
      issues.push(
        issue("maxPoints", "invalid_number", "Use at most two decimals"),
      );
    } else if (max <= 0) {
      issues.push(
        issue("maxPoints", "must_be_positive", "Must be greater than zero"),
      );
    } else if (max > MAX_POINTS_LIMIT) {
      issues.push(issue("maxPoints", "too_large", "Must be 99999.99 or less"));
    }
  } else if (hasMax) {
    issues.push(
      issue(
        "maxPoints",
        "max_points_not_allowed",
        "Pass/fail work has no points",
      ),
    );
  }

  const attempts = input.maxSubmissions ?? 1;
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > MAX_ATTEMPTS) {
    issues.push(
      issue(
        "maxSubmissions",
        "invalid_max_submissions",
        `Use a whole number from 1 to ${MAX_ATTEMPTS}`,
      ),
    );
  }
  return issues;
}

export async function createAssignment(
  ctx: RequestContext,
  classId: string,
  input: AssignmentInput,
) {
  requirePermission(ctx, { assignment: ["create"] });
  const klass = await requireClass(ctx, classId);
  await requireTeachesClass(ctx, klass.id);

  fail([
    ...validateAssignmentInput(input),
    ...(await scaleIssue(ctx.db, ctx.organizationId, input.gradingScaleId)),
  ]);

  const mode = input.gradingMode ?? "points";
  const row = await ctx.db.assignment.create({
    data: {
      organizationId: ctx.organizationId,
      classId: klass.id,
      title: input.title.trim(),
      description: input.description ?? null,
      type: input.type,
      gradingMode: mode,
      maxPoints: mode === "points" ? (input.maxPoints ?? null) : null,
      gradingScaleId: input.gradingScaleId ?? null,
      dueAt: input.dueAt ?? null,
      maxSubmissions: input.maxSubmissions ?? 1,
      publishedAt: input.publish ? new Date() : null,
    },
  });
  await recordActivity(ctx.db, ctx, {
    action: "create",
    resourceType: "assignment",
    resourceId: row.id,
    metadata: { classId: klass.id },
  });
  return row;
}
