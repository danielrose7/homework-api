import { applyGrade } from "@/modules/submissions/mutations/grade-submission";
import {
  findManualBand,
  lookupBand,
  PASS_FAIL,
  PLUS_MINUS,
  type BandInput,
} from "@/lib/domain/grading";
import type { Auth } from "@/lib/server/auth-factory";
import type { AppPrismaClient } from "@/lib/server/db";
import { addBands } from "@/modules/grading-scales/mutations/add-bands";
import { createDefaultGradingScale } from "@/modules/grading-scales/mutations/create-default-grading-scale";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";
import {
  ASSIGNMENTS,
  CLASSES,
  SANDBOX_PASSWORD,
  SANDBOX_SCHOOL,
  PEOPLE,
  SUBMISSIONS,
  type GradeSpec,
  type ScaleKey,
} from "@/app/sandbox/_server/seed-data";
import { createDefaultOrganizationPreferences } from "@/modules/organizations/mutations/create-default-preferences";

class SeedRefusedError extends Error {
  constructor() {
    super(
      "The database already has data. Run `pnpm db:reset` to clear it and seed again.",
    );
  }
}

export interface SeedSummary {
  organization_id: string;
  slug: string;
  password: string;
  people: Array<{ username: string; role: string }>;
  submissions: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function createScale(
  db: AppPrismaClient,
  organization_id: string,
  name: string,
  bands: readonly BandInput[],
) {
  const scale = await db.gradingScale.create({
    data: { organization_id, name },
  });
  await addBands(db, organization_id, scale.id, bands);
  return scale.id;
}

export async function seedSandbox(
  db: AppPrismaClient,
  auth: Auth,
): Promise<SeedSummary> {
  if ((await db.user.count()) > 0 || (await db.organization.count()) > 0) {
    throw new SeedRefusedError();
  }

  const now = Date.now();
  const organization = await db.organization.create({ data: SANDBOX_SCHOOL });
  const organization_id = organization.id;
  const standard_id = await createDefaultGradingScale(db, organization_id);
  await createDefaultOrganizationPreferences(db, organization_id);
  const scale_ids: Record<ScaleKey, string> = {
    standard: standard_id,
    plus_minus: await createScale(
      db,
      organization_id,
      "Plus/minus",
      PLUS_MINUS,
    ),
    pass_fail: await createScale(db, organization_id, "Pass/Fail", PASS_FAIL),
  };

  const members = new Map<string, string>();
  for (const person of PEOPLE) {
    const { user } = await auth.api.signUpEmail({
      body: {
        name: person.name,
        email: `${person.username}@sandbox.test`,
        password: SANDBOX_PASSWORD,
        username: person.username,
      },
    });
    const member = await db.member.create({
      data: {
        organizationId: organization_id,
        userId: user.id,
        role: person.role,
      },
    });
    members.set(person.username, member.id);
  }
  const member_id = (username: string) => {
    const id = members.get(username);
    if (!id) throw new Error(`seed has no person "${username}"`);
    return id;
  };

  const day = (offset: number) =>
    new Date(now + offset * DAY).toISOString().slice(0, 10);
  const year = await db.academicYear.create({
    data: {
      organization_id,
      name: "2026–27",
      starts_on: new Date(day(-60)),
      ends_on: new Date(day(160)),
    },
  });
  const fall = await db.term.create({
    data: {
      organization_id,
      academic_year_id: year.id,
      name: "Fall",
      starts_on: new Date(day(-60)),
      ends_on: new Date(day(45)),
    },
  });
  await db.term.create({
    data: {
      organization_id,
      academic_year_id: year.id,
      name: "Spring",
      starts_on: new Date(day(60)),
      ends_on: new Date(day(160)),
    },
  });

  const class_ids = new Map<string, string>();
  const students = PEOPLE.filter((p) => p.role === "student");
  const seat_ids = new Map<string, string>();
  for (const spec of CLASSES) {
    const klass = await db.class.create({
      data: {
        organization_id,
        term_id: fall.id,
        name: spec.name,
        grading_scale_id: spec.scale ? scale_ids[spec.scale] : null,
      },
    });
    class_ids.set(spec.key, klass.id);
    await db.classTeacher.create({
      data: {
        organization_id,
        class_id: klass.id,
        member_id: member_id(spec.teacher),
      },
    });
    for (const student of students) {
      const seat = await db.classSeat.create({
        data: {
          organization_id,
          class_id: klass.id,
          member_id: member_id(student.username),
        },
      });
      seat_ids.set(`${spec.key}:${student.username}`, seat.id);
    }
  }

  const assignmentIds = new Map<string, string>();
  for (const spec of ASSIGNMENTS) {
    const class_id = class_ids.get(spec.class_key);
    if (!class_id) throw new Error(`seed has no class "${spec.class_key}"`);
    const row = await db.assignment.create({
      data: {
        organization_id,
        class_id,
        title: spec.title,
        type: spec.type,
        grading_mode: spec.grading_mode,
        max_points: spec.max_points,
        grading_scale_id: spec.scale ? scale_ids[spec.scale] : null,
        due_at: new Date(now + spec.due_in_days * DAY),
        published_at: new Date(now - 14 * DAY),
        ...(spec.deleted
          ? {
              deleted_at: new Date(now - 1 * DAY),
              deleted_by_id: member_id("reyes"),
              deletion_reason: "Replaced by the poetry assignment",
            }
          : {}),
      },
    });
    assignmentIds.set(spec.key, row.id);
  }

  const teacherOf = (class_key: string) => {
    const spec = CLASSES.find((c) => c.key === class_key);
    if (!spec) throw new Error(`seed has no class "${class_key}"`);
    return member_id(spec.teacher);
  };

  for (const spec of SUBMISSIONS) {
    const assignment = ASSIGNMENTS.find((a) => a.key === spec.assignment);
    const assignment_id = assignmentIds.get(spec.assignment);
    const seat_id = assignment
      ? seat_ids.get(`${assignment.class_key}:${spec.student}`)
      : undefined;
    if (!assignment || !assignment_id || !seat_id) {
      throw new Error(
        `seed submission ${spec.student}/${spec.assignment} has no assignment or seat`,
      );
    }

    const submitted_at = new Date(now - spec.days_ago * DAY);
    const submission = await db.assignmentSubmission.create({
      data: {
        organization_id,
        assignment_id,
        class_seat_id: seat_id,
        attempt_number: 1,
        text_content: spec.text,
        submitted_at,
      },
    });
    if (!spec.grade) continue;

    const class_id = class_ids.get(assignment.class_key);
    const klass = await db.class.findUniqueOrThrow({
      where: { id: class_id },
    });
    const dbAssignment = await db.assignment.findUniqueOrThrow({
      where: { id: assignment_id },
    });
    const scale = await resolveGradingScale(db, {
      organization_id,
      assignment_scale_id: dbAssignment.grading_scale_id,
      class_scale_id: klass.grading_scale_id,
    });

    const grade = async (
      given: Pick<GradeSpec, "points" | "band" | "notes">,
      after_hours: number,
      reason: string | null,
    ) => {
      const band =
        given.points !== undefined && assignment.max_points !== null
          ? lookupBand(scale.bands, given.points, assignment.max_points)
          : findManualBand(scale.bands, given.band ?? "");
      if (!band) {
        throw new Error(
          `seed grade for ${spec.student}/${spec.assignment} resolves to no band`,
        );
      }
      await applyGrade(db, {
        organization_id,
        submission_id: submission.id,
        graded_by_id: teacherOf(assignment.class_key),
        now: new Date(
          Math.min(now, submitted_at.getTime() + after_hours * HOUR),
        ),
        scale_id: scale.id,
        band,
        points_awarded: given.points ?? null,
        max_points: assignment.max_points,
        teacher_notes: given.notes ?? null,
        reason,
      });
    };

    await grade(spec.grade, spec.grade.after_hours ?? 24, null);
    if (spec.grade.regrade) {
      await grade(
        spec.grade.regrade,
        spec.grade.regrade.after_hours,
        spec.grade.regrade.reason,
      );
    }
  }

  return {
    organization_id,
    slug: SANDBOX_SCHOOL.slug,
    password: SANDBOX_PASSWORD,
    people: PEOPLE.map(({ username, role }) => ({ username, role })),
    submissions: SUBMISSIONS.length,
  };
}
