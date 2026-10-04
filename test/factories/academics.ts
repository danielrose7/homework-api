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
import { applyGrade } from "@/modules/submissions/mutations/grade-submission";
import { addBands } from "@/modules/grading-scales/mutations/add-bands";
import { resolveGradingScale } from "@/modules/grading-scales/queries/resolve-grading-scale";
import { toBand } from "@/modules/grading-scales/serializers";

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

async function organizationIdOr(organization_id: string | undefined) {
  return organization_id ?? (await organizationFactory.create()).id;
}

export interface AcademicYearBuild {
  organization_id?: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export interface AcademicYearRecord extends AcademicYearBuild {
  id: string;
  organization_id: string;
}

export const academicYearFactory = Factory.define<
  AcademicYearBuild,
  unknown,
  AcademicYearRecord
>(({ sequence, onCreate }) => {
  onCreate(async (build) => {
    const organization_id = await organizationIdOr(build.organization_id);
    const row = await factoryDb().academicYear.create({
      data: {
        organization_id,
        name: build.name,
        starts_on: at(build.starts_on),
        ends_on: at(build.ends_on),
      },
    });
    return { ...build, id: row.id, organization_id };
  });
  return {
    name: `Year ${sequence}`,
    starts_on: daysFromNow(-365),
    ends_on: daysFromNow(365),
  };
});

export interface TermBuild {
  organization_id?: string;
  academic_year_id?: string;
  name: string;
  starts_on: string;
  ends_on: string;
}

export interface TermRecord extends TermBuild {
  id: string;
  organization_id: string;
  academic_year_id: string;
}

class TermFactory extends Factory<TermBuild, unknown, TermRecord> {
  current() {
    return this.params({
      starts_on: daysFromNow(-30),
      ends_on: daysFromNow(60),
    });
  }
  past() {
    return this.params({
      starts_on: daysFromNow(-200),
      ends_on: daysFromNow(-110),
    });
  }
  upcoming() {
    return this.params({
      starts_on: daysFromNow(70),
      ends_on: daysFromNow(160),
    });
  }
}

export const termFactory = TermFactory.define(({ sequence, onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const year = build.academic_year_id
      ? await db.academicYear.findUniqueOrThrow({
          where: { id: build.academic_year_id },
        })
      : await academicYearFactory.create({
          organization_id: build.organization_id,
        });
    const row = await db.term.create({
      data: {
        organization_id: year.organization_id,
        academic_year_id: year.id,
        name: build.name,
        starts_on: at(build.starts_on),
        ends_on: at(build.ends_on),
      },
    });
    return {
      ...build,
      id: row.id,
      organization_id: year.organization_id,
      academic_year_id: year.id,
    };
  });
  return {
    name: `Term ${sequence}`,
    starts_on: daysFromNow(-30),
    ends_on: daysFromNow(60),
  };
});

export interface GradingScaleBuild {
  organization_id?: string;
  name: string;
  is_default: boolean;
  bands: BandInput[];
}

export interface GradingScaleRecord {
  id: string;
  organization_id: string;
  name: string;
  is_default: boolean;
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
    return this.params({ is_default: true });
  }
}

export const gradingScaleFactory = GradingScaleFactory.define(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const organization_id = await organizationIdOr(build.organization_id);
      if (build.is_default) {
        await db.gradingScale.updateMany({
          where: { organization_id, is_default: true },
          data: { is_default: false },
        });
      }
      const row = await db.gradingScale.create({
        data: {
          organization_id,
          name: build.name,
          is_default: build.is_default,
        },
      });
      await addBands(db, organization_id, row.id, build.bands);
      const bands = await db.gradingScaleBand.findMany({
        where: { organization_id, grading_scale_id: row.id },
        orderBy: { sort_order: "asc" },
      });
      return {
        id: row.id,
        organization_id,
        name: row.name,
        is_default: row.is_default,
        bands: bands.map(toBand),
      };
    });
    return {
      name: `Scale ${sequence}`,
      is_default: false,
      bands: [...STANDARD_AF],
    };
  },
);

export interface ClassBuild {
  organization_id?: string;
  term_id?: string;
  name: string;
  grading_scale_id: string | null;
}

export interface ClassRecord {
  id: string;
  organization_id: string;
  term_id: string;
  name: string;
  grading_scale_id: string | null;
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
      const term = build.term_id
        ? await db.term.findUniqueOrThrow({ where: { id: build.term_id } })
        : await termFactory.create({ organization_id: build.organization_id });
      const row = await db.class.create({
        data: {
          organization_id: term.organization_id,
          term_id: term.id,
          name: build.name,
          grading_scale_id: build.grading_scale_id,
        },
      });

      const inSchool = { organization_id: term.organization_id };
      const teachers: MemberRecord[] = [];
      for (let i = 0; i < (transientParams.teachers ?? 0); i++) {
        const member = await memberFactory.teacher().create(inSchool);
        await classTeacherFactory.create({
          class_id: row.id,
          member_id: member.id,
        });
        teachers.push(member);
      }
      const students: MemberRecord[] = [];
      for (let i = 0; i < (transientParams.students ?? 0); i++) {
        const member = await memberFactory.student().create(inSchool);
        await classSeatFactory.create({
          class_id: row.id,
          member_id: member.id,
        });
        students.push(member);
      }

      return {
        id: row.id,
        organization_id: term.organization_id,
        term_id: term.id,
        name: row.name,
        grading_scale_id: row.grading_scale_id,
        teachers,
        students,
      };
    });
    return { name: `Class ${sequence}`, grading_scale_id: null };
  },
);

async function classOr(class_id: string | undefined) {
  if (class_id)
    return factoryDb().class.findUniqueOrThrow({ where: { id: class_id } });
  return classFactory.create();
}

export interface ClassTeacherBuild {
  class_id?: string;
  member_id?: string;
}

export interface ClassTeacherRecord {
  id: string;
  organization_id: string;
  class_id: string;
  member_id: string;
}

export const classTeacherFactory = Factory.define<
  ClassTeacherBuild,
  unknown,
  ClassTeacherRecord
>(({ onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const klass = await classOr(build.class_id);
    const member_id =
      build.member_id ??
      (
        await memberFactory
          .teacher()
          .create({ organization_id: klass.organization_id })
      ).id;
    const row = await db.classTeacher.create({
      data: {
        organization_id: klass.organization_id,
        class_id: klass.id,
        member_id,
      },
    });
    return {
      id: row.id,
      organization_id: klass.organization_id,
      class_id: klass.id,
      member_id,
    };
  });
  return {};
});

export interface ClassSeatBuild {
  class_id?: string;
  member_id?: string;
  status: "active" | "dropped";
}

export interface ClassSeatRecord {
  id: string;
  organization_id: string;
  class_id: string;
  member_id: string;
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
    const klass = await classOr(build.class_id);
    const member_id =
      build.member_id ??
      (
        await memberFactory
          .student()
          .create({ organization_id: klass.organization_id })
      ).id;
    const row = await db.classSeat.create({
      data: {
        organization_id: klass.organization_id,
        class_id: klass.id,
        member_id,
        status: build.status,
        dropped_at: build.status === "dropped" ? new Date() : null,
      },
    });
    return {
      id: row.id,
      organization_id: klass.organization_id,
      class_id: klass.id,
      member_id,
      status: build.status,
    };
  });
  const defaults: ClassSeatBuild = { status: "active" };
  return defaults;
});

export interface AssignmentBuild {
  class_id?: string;
  title: string;
  description: string | null;
  type: "homework" | "exam" | "quiz" | "project";
  grading_mode: "points" | "band";
  max_points: string | null;
  grading_scale_id: string | null;
  due_at: Date | null;
  max_submissions: number;
  published_at: Date | null;
  deleted_at: Date | null;
}

export interface AssignmentRecord extends AssignmentBuild {
  id: string;
  organization_id: string;
  class_id: string;
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
  pointsGraded(max_points = "100") {
    return this.params({ grading_mode: "points", max_points });
  }
  passFail() {
    return this.params({ grading_mode: "band", max_points: null });
  }
  draft() {
    return this.params({ published_at: null });
  }
  published() {
    return this.params({ published_at: offset(-1) });
  }
  pastDue() {
    return this.params({ due_at: offset(-3) });
  }
  singleAttempt() {
    return this.params({ max_submissions: 1 });
  }
  multiAttempt(attempts = 3) {
    return this.params({ max_submissions: attempts });
  }
  deleted() {
    return this.params({ deleted_at: new Date() });
  }
}

export const assignmentFactory = AssignmentFactory.define(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const klass = await classOr(build.class_id);
      const { class_id: _classId, ...fields } = build;
      void _classId;
      const row = await factoryDb().assignment.create({
        data: {
          ...fields,
          organization_id: klass.organization_id,
          class_id: klass.id,
        },
      });
      return {
        ...build,
        id: row.id,
        organization_id: klass.organization_id,
        class_id: klass.id,
      };
    });
    const defaults: AssignmentBuild = {
      title: `Assignment ${sequence}`,
      description: null,
      type: "homework",
      grading_mode: "points",
      max_points: "100",
      grading_scale_id: null,
      due_at: offset(7),
      max_submissions: 1,
      published_at: offset(-1),
      deleted_at: null,
    };
    return defaults;
  },
);

export interface SubmissionBuild {
  assignment_id?: string;
  class_seat_id?: string;
  attempt_number: number;
  text_content: string | null;
  deleted_at: Date | null;
}

export interface SubmissionRecord {
  id: string;
  organization_id: string;
  assignment_id: string;
  class_seat_id: string;
  attempt_number: number;
  graded_at: string | null;
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
    return this.params({ deleted_at: new Date() });
  }
}

export const submissionFactory = SubmissionFactory.define(
  ({ onCreate, transientParams }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const assignment = build.assignment_id
        ? await db.assignment.findUniqueOrThrow({
            where: { id: build.assignment_id },
          })
        : await assignmentFactory.create();
      const seat = build.class_seat_id
        ? await db.classSeat.findUniqueOrThrow({
            where: { id: build.class_seat_id },
          })
        : await classSeatFactory.create({ class_id: assignment.class_id });

      const row = await db.assignmentSubmission.create({
        data: {
          organization_id: assignment.organization_id,
          assignment_id: assignment.id,
          class_seat_id: seat.id,
          attempt_number: build.attempt_number,
          text_content: build.text_content,
          deleted_at: build.deleted_at,
        },
      });

      let graded_at: string | null = null;
      if (
        transientParams.points !== undefined ||
        transientParams.band !== undefined
      ) {
        graded_at = await gradeDirectly(row.id, assignment.id, transientParams);
      }
      return {
        id: row.id,
        organization_id: assignment.organization_id,
        assignment_id: assignment.id,
        class_seat_id: seat.id,
        attempt_number: build.attempt_number,
        graded_at,
      };
    });
    return {
      attempt_number: 1,
      text_content: "My answer",
      deleted_at: null,
    };
  },
);

async function gradeDirectly(
  submission_id: string,
  assignment_id: string,
  grade: SubmissionTransient,
): Promise<string> {
  const db = factoryDb();
  const assignment = await db.assignment.findUniqueOrThrow({
    where: { id: assignment_id },
  });
  const klass = await db.class.findUniqueOrThrow({
    where: { id: assignment.class_id },
  });
  const teacherLink = await db.classTeacher.findFirst({
    where: { class_id: klass.id },
  });
  const graderId =
    teacherLink?.member_id ??
    (await classTeacherFactory.create({ class_id: klass.id })).member_id;

  const scale = await resolveGradingScale(db, {
    organization_id: assignment.organization_id,
    assignmentScaleId: assignment.grading_scale_id,
    classScaleId: klass.grading_scale_id,
  });
  const max_points = assignment.max_points?.toString() ?? null;
  const band =
    grade.points !== undefined && max_points !== null
      ? lookupBand(scale.bands, grade.points, max_points)
      : findManualBand(scale.bands, grade.band ?? "");
  if (!band)
    throw new Error("factory could not resolve a band for the requested grade");

  const result = await applyGrade(db, {
    organization_id: assignment.organization_id,
    submission_id,
    graded_by_id: graderId,
    now: new Date(),
    scaleId: scale.id,
    band,
    points_awarded: grade.points ?? null,
    max_points,
    teacher_notes: grade.notes ?? null,
    reason: null,
  });
  return result.graded_at;
}
