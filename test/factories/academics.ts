import { Factory } from "fishery";

import {
  PASS_FAIL,
  PLUS_MINUS,
  STANDARD_AF,
  findManualBand,
  lookupBand,
  type Band,
  type BandInput,
} from "@/lib/domain/grading";
import { applyGrade } from "@/lib/server/services/grades";
import {
  addBands,
  resolveGradingScale,
  toBand,
} from "@/lib/server/services/grading-scales";

import { memberFactory, type MemberRecord } from "./member";
import { organizationFactory } from "./organization";
import { factoryDb } from "./runtime";

export const daysFromNow = (days: number): string => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const at = (day: string) => new Date(`${day}T00:00:00Z`);
const offset = (days: number) => new Date(Date.now() + days * 86_400_000);

async function organizationIdOr(organizationId: string | undefined) {
  return organizationId ?? (await organizationFactory.create()).id;
}

export interface AcademicYearBuild {
  organizationId?: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface AcademicYearRecord extends AcademicYearBuild {
  id: string;
  organizationId: string;
}

export const academicYearFactory = Factory.define<
  AcademicYearBuild,
  unknown,
  AcademicYearRecord
>(({ sequence, onCreate }) => {
  onCreate(async (build) => {
    const organizationId = await organizationIdOr(build.organizationId);
    const row = await factoryDb().academicYear.create({
      data: {
        organizationId,
        name: build.name,
        startsOn: at(build.startsOn),
        endsOn: at(build.endsOn),
      },
    });
    return { ...build, id: row.id, organizationId };
  });
  return {
    name: `Year ${sequence}`,
    startsOn: daysFromNow(-365),
    endsOn: daysFromNow(365),
  };
});

export interface TermBuild {
  organizationId?: string;
  academicYearId?: string;
  name: string;
  startsOn: string;
  endsOn: string;
}

export interface TermRecord extends TermBuild {
  id: string;
  organizationId: string;
  academicYearId: string;
}

class TermFactory extends Factory<TermBuild, unknown, TermRecord> {
  current() {
    return this.params({ startsOn: daysFromNow(-30), endsOn: daysFromNow(60) });
  }
  past() {
    return this.params({
      startsOn: daysFromNow(-200),
      endsOn: daysFromNow(-110),
    });
  }
  upcoming() {
    return this.params({ startsOn: daysFromNow(70), endsOn: daysFromNow(160) });
  }
}

export const termFactory = TermFactory.define(({ sequence, onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const year = build.academicYearId
      ? await db.academicYear.findUniqueOrThrow({
          where: { id: build.academicYearId },
        })
      : await academicYearFactory.create({
          organizationId: build.organizationId,
        });
    const row = await db.term.create({
      data: {
        organizationId: year.organizationId,
        academicYearId: year.id,
        name: build.name,
        startsOn: at(build.startsOn),
        endsOn: at(build.endsOn),
      },
    });
    return {
      ...build,
      id: row.id,
      organizationId: year.organizationId,
      academicYearId: year.id,
    };
  });
  return {
    name: `Term ${sequence}`,
    startsOn: daysFromNow(-30),
    endsOn: daysFromNow(60),
  };
});

export interface GradingScaleBuild {
  organizationId?: string;
  name: string;
  isDefault: boolean;
  bands: BandInput[];
}

export interface GradingScaleRecord {
  id: string;
  organizationId: string;
  name: string;
  isDefault: boolean;
  bands: Band[];
}

class GradingScaleFactory extends Factory<
  GradingScaleBuild,
  unknown,
  GradingScaleRecord
> {
  standardAF() {
    return this.params({ bands: [...STANDARD_AF] });
  }
  plusMinus() {
    return this.params({ name: "Plus/minus", bands: [...PLUS_MINUS] });
  }
  passFail() {
    return this.params({ name: "Pass/Fail", bands: [...PASS_FAIL] });
  }
  asDefault() {
    return this.params({ isDefault: true });
  }
}

export const gradingScaleFactory = GradingScaleFactory.define(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const organizationId = await organizationIdOr(build.organizationId);
      if (build.isDefault) {
        await db.gradingScale.updateMany({
          where: { organizationId, isDefault: true },
          data: { isDefault: false },
        });
      }
      const row = await db.gradingScale.create({
        data: { organizationId, name: build.name, isDefault: build.isDefault },
      });
      await addBands(db, organizationId, row.id, build.bands);
      const bands = await db.gradingScaleBand.findMany({
        where: { organizationId, gradingScaleId: row.id },
        orderBy: { sortOrder: "asc" },
      });
      return {
        id: row.id,
        organizationId,
        name: row.name,
        isDefault: row.isDefault,
        bands: bands.map(toBand),
      };
    });
    return {
      name: `Scale ${sequence}`,
      isDefault: false,
      bands: [...STANDARD_AF],
    };
  },
);

export interface ClassBuild {
  organizationId?: string;
  termId?: string;
  name: string;
  gradingScaleId: string | null;
}

export interface ClassRecord {
  id: string;
  organizationId: string;
  termId: string;
  name: string;
  gradingScaleId: string | null;
  teachers: MemberRecord[];
  students: MemberRecord[];
}

interface ClassTransient {
  teachers: number;
  students: number;
}

class ClassFactory extends Factory<ClassBuild, ClassTransient, ClassRecord> {
  withTeachers(count = 1) {
    return this.transient({ teachers: count });
  }
  withStudents(count = 1) {
    return this.transient({ students: count });
  }
}

export const classFactory = ClassFactory.define(
  ({ sequence, onCreate, transientParams }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const term = build.termId
        ? await db.term.findUniqueOrThrow({ where: { id: build.termId } })
        : await termFactory.create({ organizationId: build.organizationId });
      const row = await db.class.create({
        data: {
          organizationId: term.organizationId,
          termId: term.id,
          name: build.name,
          gradingScaleId: build.gradingScaleId,
        },
      });

      const inSchool = { organizationId: term.organizationId };
      const teachers: MemberRecord[] = [];
      for (let i = 0; i < (transientParams.teachers ?? 0); i++) {
        const member = await memberFactory.teacher().create(inSchool);
        await classTeacherFactory.create({
          classId: row.id,
          memberId: member.id,
        });
        teachers.push(member);
      }
      const students: MemberRecord[] = [];
      for (let i = 0; i < (transientParams.students ?? 0); i++) {
        const member = await memberFactory.student().create(inSchool);
        await classSeatFactory.create({ classId: row.id, memberId: member.id });
        students.push(member);
      }

      return {
        id: row.id,
        organizationId: term.organizationId,
        termId: term.id,
        name: row.name,
        gradingScaleId: row.gradingScaleId,
        teachers,
        students,
      };
    });
    return { name: `Class ${sequence}`, gradingScaleId: null };
  },
);

async function classOr(classId: string | undefined) {
  if (classId)
    return factoryDb().class.findUniqueOrThrow({ where: { id: classId } });
  return classFactory.create();
}

export interface ClassTeacherBuild {
  classId?: string;
  memberId?: string;
}

export interface ClassTeacherRecord {
  id: string;
  organizationId: string;
  classId: string;
  memberId: string;
}

export const classTeacherFactory = Factory.define<
  ClassTeacherBuild,
  unknown,
  ClassTeacherRecord
>(({ onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const klass = await classOr(build.classId);
    const memberId =
      build.memberId ??
      (
        await memberFactory
          .teacher()
          .create({ organizationId: klass.organizationId })
      ).id;
    const row = await db.classTeacher.create({
      data: {
        organizationId: klass.organizationId,
        classId: klass.id,
        memberId,
      },
    });
    return {
      id: row.id,
      organizationId: klass.organizationId,
      classId: klass.id,
      memberId,
    };
  });
  return {};
});

export interface ClassSeatBuild {
  classId?: string;
  memberId?: string;
  status: "active" | "dropped";
}

export interface ClassSeatRecord {
  id: string;
  organizationId: string;
  classId: string;
  memberId: string;
  status: "active" | "dropped";
}

class ClassSeatFactory extends Factory<
  ClassSeatBuild,
  unknown,
  ClassSeatRecord
> {
  active() {
    return this.params({ status: "active" });
  }
  dropped() {
    return this.params({ status: "dropped" });
  }
}

export const classSeatFactory = ClassSeatFactory.define(({ onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const klass = await classOr(build.classId);
    const memberId =
      build.memberId ??
      (
        await memberFactory
          .student()
          .create({ organizationId: klass.organizationId })
      ).id;
    const row = await db.classSeat.create({
      data: {
        organizationId: klass.organizationId,
        classId: klass.id,
        memberId,
        status: build.status,
        droppedAt: build.status === "dropped" ? new Date() : null,
      },
    });
    return {
      id: row.id,
      organizationId: klass.organizationId,
      classId: klass.id,
      memberId,
      status: build.status,
    };
  });
  const defaults: ClassSeatBuild = { status: "active" };
  return defaults;
});

export interface AssignmentBuild {
  classId?: string;
  title: string;
  description: string | null;
  type: "homework" | "exam" | "quiz" | "project";
  gradingMode: "points" | "band";
  maxPoints: string | null;
  gradingScaleId: string | null;
  dueAt: Date | null;
  maxSubmissions: number;
  publishedAt: Date | null;
  deletedAt: Date | null;
}

export interface AssignmentRecord extends AssignmentBuild {
  id: string;
  organizationId: string;
  classId: string;
}

class AssignmentFactory extends Factory<
  AssignmentBuild,
  unknown,
  AssignmentRecord
> {
  homework() {
    return this.params({ type: "homework" });
  }
  exam() {
    return this.params({ type: "exam" });
  }
  quiz() {
    return this.params({ type: "quiz" });
  }
  project() {
    return this.params({ type: "project" });
  }
  pointsGraded(maxPoints = "100") {
    return this.params({ gradingMode: "points", maxPoints });
  }
  passFail() {
    return this.params({ gradingMode: "band", maxPoints: null });
  }
  draft() {
    return this.params({ publishedAt: null });
  }
  published() {
    return this.params({ publishedAt: offset(-1) });
  }
  pastDue() {
    return this.params({ dueAt: offset(-3) });
  }
  singleAttempt() {
    return this.params({ maxSubmissions: 1 });
  }
  multiAttempt(attempts = 3) {
    return this.params({ maxSubmissions: attempts });
  }
  deleted() {
    return this.params({ deletedAt: new Date() });
  }
}

export const assignmentFactory = AssignmentFactory.define(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const klass = await classOr(build.classId);
      const { classId: _classId, ...fields } = build;
      void _classId;
      const row = await factoryDb().assignment.create({
        data: {
          ...fields,
          organizationId: klass.organizationId,
          classId: klass.id,
        },
      });
      return {
        ...build,
        id: row.id,
        organizationId: klass.organizationId,
        classId: klass.id,
      };
    });
    const defaults: AssignmentBuild = {
      title: `Assignment ${sequence}`,
      description: null,
      type: "homework",
      gradingMode: "points",
      maxPoints: "100",
      gradingScaleId: null,
      dueAt: offset(7),
      maxSubmissions: 1,
      publishedAt: offset(-1),
      deletedAt: null,
    };
    return defaults;
  },
);

export interface SubmissionBuild {
  assignmentId?: string;
  classSeatId?: string;
  attemptNumber: number;
  textContent: string | null;
  deletedAt: Date | null;
}

export interface SubmissionRecord {
  id: string;
  organizationId: string;
  assignmentId: string;
  classSeatId: string;
  attemptNumber: number;
  gradedAt: string | null;
}

interface SubmissionTransient {
  points?: string;
  band?: string;
  notes?: string;
}

class SubmissionFactory extends Factory<
  SubmissionBuild,
  SubmissionTransient,
  SubmissionRecord
> {
  ungraded() {
    return this;
  }
  graded(points: string | number, notes?: string) {
    return this.transient({ points: String(points), notes });
  }
  markedBand(band: string, notes?: string) {
    return this.transient({ band, notes });
  }
  incomplete(notes?: string) {
    return this.markedBand("Incomplete", notes);
  }
  deleted() {
    return this.params({ deletedAt: new Date() });
  }
}

export const submissionFactory = SubmissionFactory.define(
  ({ onCreate, transientParams }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const assignment = build.assignmentId
        ? await db.assignment.findUniqueOrThrow({
            where: { id: build.assignmentId },
          })
        : await assignmentFactory.create();
      const seat = build.classSeatId
        ? await db.classSeat.findUniqueOrThrow({
            where: { id: build.classSeatId },
          })
        : await classSeatFactory.create({ classId: assignment.classId });

      const row = await db.assignmentSubmission.create({
        data: {
          organizationId: assignment.organizationId,
          assignmentId: assignment.id,
          classSeatId: seat.id,
          attemptNumber: build.attemptNumber,
          textContent: build.textContent,
          deletedAt: build.deletedAt,
        },
      });

      let gradedAt: string | null = null;
      if (
        transientParams.points !== undefined ||
        transientParams.band !== undefined
      ) {
        gradedAt = await gradeDirectly(row.id, assignment.id, transientParams);
      }
      return {
        id: row.id,
        organizationId: assignment.organizationId,
        assignmentId: assignment.id,
        classSeatId: seat.id,
        attemptNumber: build.attemptNumber,
        gradedAt,
      };
    });
    return {
      attemptNumber: 1,
      textContent: "My answer",
      deletedAt: null,
    };
  },
);

async function gradeDirectly(
  submissionId: string,
  assignmentId: string,
  grade: SubmissionTransient,
): Promise<string> {
  const db = factoryDb();
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
  });
  const klass = await db.class.findUniqueOrThrow({
    where: { id: assignment.classId },
  });
  const teacherLink = await db.classTeacher.findFirst({
    where: { classId: klass.id },
  });
  const graderId =
    teacherLink?.memberId ??
    (await classTeacherFactory.create({ classId: klass.id })).memberId;

  const scale = await resolveGradingScale(db, {
    organizationId: assignment.organizationId,
    assignmentScaleId: assignment.gradingScaleId,
    classScaleId: klass.gradingScaleId,
  });
  const maxPoints = assignment.maxPoints?.toString() ?? null;
  const band =
    grade.points !== undefined && maxPoints !== null
      ? lookupBand(scale.bands, grade.points, maxPoints)
      : findManualBand(scale.bands, grade.band ?? "");
  if (!band)
    throw new Error("factory could not resolve a band for the requested grade");

  const result = await applyGrade(db, {
    organizationId: assignment.organizationId,
    submissionId,
    gradedBy: graderId,
    now: new Date(),
    scaleId: scale.id,
    band,
    pointsAwarded: grade.points ?? null,
    maxPoints,
    teacherNotes: grade.notes ?? null,
    reason: null,
  });
  return result.gradedAt;
}
