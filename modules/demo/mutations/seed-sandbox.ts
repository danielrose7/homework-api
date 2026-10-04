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
import {
  addBands,
  createDefaultGradingScale,
  resolveGradingScale,
} from "@/lib/server/services/grading-scales";
import {
  ASSIGNMENTS,
  CLASSES,
  DEMO_PASSWORD,
  DEMO_SCHOOL,
  PEOPLE,
  SUBMISSIONS,
  type GradeSpec,
  type ScaleKey,
} from "@/modules/demo/seed-data";
import { createDefaultOrganizationPreferences } from "@/modules/organizations/mutations/create-default-preferences";

export class SeedRefusedError extends Error {
  constructor() {
    super(
      "The database already has data. Run `pnpm db:reset` to clear it and seed again.",
    );
  }
}

export interface SeedSummary {
  organizationId: string;
  slug: string;
  password: string;
  people: Array<{ username: string; role: string }>;
  submissions: number;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

async function createScale(
  db: AppPrismaClient,
  organizationId: string,
  name: string,
  bands: readonly BandInput[],
) {
  const scale = await db.gradingScale.create({
    data: { organizationId, name },
  });
  await addBands(db, organizationId, scale.id, bands);
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
  const organization = await db.organization.create({ data: DEMO_SCHOOL });
  const organizationId = organization.id;
  const standardId = await createDefaultGradingScale(db, organizationId);
  await createDefaultOrganizationPreferences(db, organizationId);
  const scaleIds: Record<ScaleKey, string> = {
    standard: standardId,
    plusMinus: await createScale(db, organizationId, "Plus/minus", PLUS_MINUS),
    passFail: await createScale(db, organizationId, "Pass/Fail", PASS_FAIL),
  };

  const members = new Map<string, string>();
  for (const person of PEOPLE) {
    const { user } = await auth.api.signUpEmail({
      body: {
        name: person.name,
        email: `${person.username}@sandbox.test`,
        password: DEMO_PASSWORD,
        username: person.username,
      },
    });
    const member = await db.member.create({
      data: { organizationId, userId: user.id, role: person.role },
    });
    members.set(person.username, member.id);
  }
  const memberId = (username: string) => {
    const id = members.get(username);
    if (!id) throw new Error(`seed has no person "${username}"`);
    return id;
  };

  const day = (offset: number) =>
    new Date(now + offset * DAY).toISOString().slice(0, 10);
  const year = await db.academicYear.create({
    data: {
      organizationId,
      name: "2026–27",
      startsOn: new Date(day(-60)),
      endsOn: new Date(day(160)),
    },
  });
  const fall = await db.term.create({
    data: {
      organizationId,
      academicYearId: year.id,
      name: "Fall",
      startsOn: new Date(day(-60)),
      endsOn: new Date(day(45)),
    },
  });
  await db.term.create({
    data: {
      organizationId,
      academicYearId: year.id,
      name: "Spring",
      startsOn: new Date(day(60)),
      endsOn: new Date(day(160)),
    },
  });

  const classIds = new Map<string, string>();
  const students = PEOPLE.filter((p) => p.role === "student");
  const seatIds = new Map<string, string>();
  for (const spec of CLASSES) {
    const klass = await db.class.create({
      data: {
        organizationId,
        termId: fall.id,
        name: spec.name,
        gradingScaleId: spec.scale ? scaleIds[spec.scale] : null,
      },
    });
    classIds.set(spec.key, klass.id);
    await db.classTeacher.create({
      data: {
        organizationId,
        classId: klass.id,
        memberId: memberId(spec.teacher),
      },
    });
    for (const student of students) {
      const seat = await db.classSeat.create({
        data: {
          organizationId,
          classId: klass.id,
          memberId: memberId(student.username),
        },
      });
      seatIds.set(`${spec.key}:${student.username}`, seat.id);
    }
  }

  const assignmentIds = new Map<string, string>();
  for (const spec of ASSIGNMENTS) {
    const classId = classIds.get(spec.classKey);
    if (!classId) throw new Error(`seed has no class "${spec.classKey}"`);
    const row = await db.assignment.create({
      data: {
        organizationId,
        classId,
        title: spec.title,
        type: spec.type,
        gradingMode: spec.gradingMode,
        maxPoints: spec.maxPoints,
        gradingScaleId: spec.scale ? scaleIds[spec.scale] : null,
        dueAt: new Date(now + spec.dueInDays * DAY),
        publishedAt: new Date(now - 14 * DAY),
        ...(spec.deleted
          ? {
              deletedAt: new Date(now - 1 * DAY),
              deletedById: memberId("reyes"),
              deletionReason: "Replaced by the poetry assignment",
            }
          : {}),
      },
    });
    assignmentIds.set(spec.key, row.id);
  }

  const teacherOf = (classKey: string) => {
    const spec = CLASSES.find((c) => c.key === classKey);
    if (!spec) throw new Error(`seed has no class "${classKey}"`);
    return memberId(spec.teacher);
  };

  for (const spec of SUBMISSIONS) {
    const assignment = ASSIGNMENTS.find((a) => a.key === spec.assignment);
    const assignmentId = assignmentIds.get(spec.assignment);
    const seatId = assignment
      ? seatIds.get(`${assignment.classKey}:${spec.student}`)
      : undefined;
    if (!assignment || !assignmentId || !seatId) {
      throw new Error(
        `seed submission ${spec.student}/${spec.assignment} has no assignment or seat`,
      );
    }

    const submittedAt = new Date(now - spec.daysAgo * DAY);
    const submission = await db.assignmentSubmission.create({
      data: {
        organizationId,
        assignmentId,
        classSeatId: seatId,
        attemptNumber: 1,
        textContent: spec.text,
        submittedAt,
      },
    });
    if (!spec.grade) continue;

    const classId = classIds.get(assignment.classKey);
    const klass = await db.class.findUniqueOrThrow({
      where: { id: classId },
    });
    const dbAssignment = await db.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
    });
    const scale = await resolveGradingScale(db, {
      organizationId,
      assignmentScaleId: dbAssignment.gradingScaleId,
      classScaleId: klass.gradingScaleId,
    });

    const grade = async (
      given: Pick<GradeSpec, "points" | "band" | "notes">,
      afterHours: number,
      reason: string | null,
    ) => {
      const band =
        given.points !== undefined && assignment.maxPoints !== null
          ? lookupBand(scale.bands, given.points, assignment.maxPoints)
          : findManualBand(scale.bands, given.band ?? "");
      if (!band) {
        throw new Error(
          `seed grade for ${spec.student}/${spec.assignment} resolves to no band`,
        );
      }
      await applyGrade(db, {
        organizationId,
        submissionId: submission.id,
        gradedById: teacherOf(assignment.classKey),
        now: new Date(Math.min(now, submittedAt.getTime() + afterHours * HOUR)),
        scaleId: scale.id,
        band,
        pointsAwarded: given.points ?? null,
        maxPoints: assignment.maxPoints,
        teacherNotes: given.notes ?? null,
        reason,
      });
    };

    await grade(spec.grade, spec.grade.afterHours ?? 24, null);
    if (spec.grade.regrade) {
      await grade(
        spec.grade.regrade,
        spec.grade.regrade.afterHours,
        spec.grade.regrade.reason,
      );
    }
  }

  return {
    organizationId,
    slug: DEMO_SCHOOL.slug,
    password: DEMO_PASSWORD,
    people: PEOPLE.map(({ username, role }) => ({ username, role })),
    submissions: SUBMISSIONS.length,
  };
}
