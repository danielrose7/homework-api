import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { ApiError } from "@/lib/server/errors";
import { addClassSeat } from "@/modules/academics/mutations/add-class-seat";
import { addClassTeacher } from "@/modules/academics/mutations/add-class-teacher";
import { createAcademicYear } from "@/modules/academics/mutations/create-academic-year";
import { createAssignment } from "@/modules/academics/mutations/create-assignment";
import { createClass } from "@/modules/academics/mutations/create-class";
import { createTerm } from "@/modules/academics/mutations/create-term";
import {
  validateAssignmentInput,
  type AssignmentInput,
} from "@/modules/academics/validation";
import { createGradingScale } from "@/modules/grading-scales/mutations/create-grading-scale";
import { PASS_FAIL } from "@/lib/domain/grading";
import { seedSchool } from "@/test/scenarios/school";
import { testDb, withRollbackDb } from "@/test/rollback-db";

withRollbackDb();

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  if (!(error instanceof ApiError)) throw new Error("expected an ApiError");
  return error;
}

const codes = (error: ApiError) => error.details.map((d) => d.code);

async function structure() {
  const school = await seedSchool({ teachers: 2, students: 2 });
  const admin = await school.admin.context();
  const year = await createAcademicYear(admin, {
    name: "2026-2027",
    starts_on: "2026-09-01",
    ends_on: "2027-06-15",
  });
  const fall = await createTerm(admin, {
    academic_year_id: year.id,
    name: "Fall",
    starts_on: "2026-09-01",
    ends_on: "2026-12-20",
  });
  const klass = await createClass(admin, {
    term_id: fall.id,
    name: "Algebra I",
  });
  return { school, admin, year, fall, klass };
}

describe("academic years and terms", () => {
  it("are administrator-only", async () => {
    const school = await seedSchool();
    const teacher = await school.teachers[0]!.context();
    const error = await failure(
      createAcademicYear(teacher, {
        name: "2026",
        starts_on: "2026-09-01",
        ends_on: "2027-06-15",
      }),
    );
    expect(error.status).toBe(STATUS.forbidden);
  });

  it("validate dates and names", async () => {
    const school = await seedSchool();
    const admin = await school.admin.context();
    const error = await failure(
      createAcademicYear(admin, {
        name: " ",
        starts_on: "2027-06-15",
        ends_on: "2026-09-01",
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(codes(error)).toEqual(["name_required", "end_not_after_start"]);
  });

  it("reject a duplicate year name", async () => {
    const { admin } = await structure();
    const error = await failure(
      createAcademicYear(admin, {
        name: "2026-2027",
        starts_on: "2027-09-01",
        ends_on: "2028-06-15",
      }),
    );
    expect(codes(error)).toEqual(["name_taken"]);
  });

  it("keep terms inside the year and out of each other's way", async () => {
    const { admin, year } = await structure();

    const overlapping = await failure(
      createTerm(admin, {
        academic_year_id: year.id,
        name: "Winter",
        starts_on: "2026-12-01",
        ends_on: "2027-02-01",
      }),
    );
    expect(codes(overlapping)).toEqual(["overlaps_term"]);

    const outside = await failure(
      createTerm(admin, {
        academic_year_id: year.id,
        name: "Summer",
        starts_on: "2027-06-01",
        ends_on: "2027-08-01",
      }),
    );
    expect(codes(outside)).toContain("outside_academic_year");

    const spring = await createTerm(admin, {
      academic_year_id: year.id,
      name: "Spring",
      starts_on: "2027-01-05",
      ends_on: "2027-06-15",
    });
    expect(spring.name).toBe("Spring");
  });

  it("report an unknown year as a field error, not a 404", async () => {
    const { admin } = await structure();
    const error = await failure(
      createTerm(admin, {
        academic_year_id: "00000000-0000-7000-8000-000000000000",
        name: "X",
        starts_on: "2026-09-01",
        ends_on: "2026-12-01",
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(error.details[0]).toMatchObject({
      field: "academic_year_id",
      code: "not_found",
    });
  });
});

describe("classes, teachers and seats", () => {
  it("create a class and reject a duplicate name in the term", async () => {
    const { admin, fall, klass } = await structure();
    expect(klass.name).toBe("Algebra I");
    const error = await failure(
      createClass(admin, { term_id: fall.id, name: "Algebra I" }),
    );
    expect(codes(error)).toEqual(["name_taken"]);
  });

  it("reject a scale from another school without revealing it exists", async () => {
    const { admin, fall } = await structure();
    const other = await seedSchool();
    const otherScale = await createGradingScale(await other.admin.context(), {
      name: "Theirs",
      bands: [...PASS_FAIL],
    });
    const error = await failure(
      createClass(admin, {
        term_id: fall.id,
        name: "Geometry",
        grading_scale_id: otherScale.id,
      }),
    );
    expect(error.details[0]).toMatchObject({
      field: "grading_scale_id",
      code: "not_found",
    });
  });

  it("assign teachers and seat students, checking roles and duplicates", async () => {
    const { school, admin, klass } = await structure();
    const teacher = school.teachers[0]!.member;
    const student = school.students[0]!.member;

    await addClassTeacher(admin, klass.id, teacher.id);
    await addClassSeat(admin, klass.id, student.id);

    expect(
      (await failure(addClassTeacher(admin, klass.id, teacher.id))).status,
    ).toBe(STATUS.conflict);
    expect(
      (await failure(addClassSeat(admin, klass.id, student.id))).status,
    ).toBe(STATUS.conflict);

    const wrongRole = await failure(
      addClassTeacher(admin, klass.id, student.id),
    );
    expect(wrongRole.details[0]).toMatchObject({
      field: "member_id",
      code: "wrong_role",
    });
    const wrongRole2 = await failure(addClassSeat(admin, klass.id, teacher.id));
    expect(wrongRole2.details[0]?.code).toBe("wrong_role");
  });

  it("do not reach into another school", async () => {
    const { admin, klass } = await structure();
    const other = await seedSchool();
    const foreignStudent = other.students[0]!.member;

    const error = await failure(
      addClassSeat(admin, klass.id, foreignStudent.id),
    );
    expect(error.details[0]?.code).toBe("not_found");

    const foreignClass = await failure(
      addClassSeat(await other.admin.context(), klass.id, foreignStudent.id),
    );
    expect(foreignClass.status).toBe(STATUS.not_found);
  });
});

describe("assignments", () => {
  const base: AssignmentInput = {
    title: "Chapter 1",
    type: "homework",
    max_points: "50",
  };

  it("lets a teacher of the class create one, and records it", async () => {
    const { school, admin, klass } = await structure();
    const teacher = school.teachers[0]!;
    await addClassTeacher(admin, klass.id, teacher.member.id);

    const row = await createAssignment(await teacher.context(), klass.id, {
      ...base,
      publish: true,
    });
    expect(row.published_at).toBeInstanceOf(Date);
    expect(row.max_submissions).toBe(1);
    expect(row.grading_mode).toBe("points");
    expect(String(row.max_points)).toBe("50");
    expect(
      await testDb().activityLog.count({
        where: { resource_type: "assignment" },
      }),
    ).toBe(1);
  });

  it("hides a class from teachers who do not teach it, and from students", async () => {
    const { school, admin, klass } = await structure();
    await addClassTeacher(admin, klass.id, school.teachers[0]!.member.id);

    const otherTeacher = await school.teachers[1]!.context();
    expect(
      (await failure(createAssignment(otherTeacher, klass.id, base))).status,
    ).toBe(STATUS.not_found);

    const student = await school.students[0]!.context();
    expect(
      (await failure(createAssignment(student, klass.id, base))).status,
    ).toBe(STATUS.forbidden);
  });

  it("lets an administrator create one in any class", async () => {
    const { admin, klass } = await structure();
    const row = await createAssignment(admin, klass.id, base);
    expect(row.published_at).toBeNull();
  });

  it("creates pass/fail work with no points", async () => {
    const { admin, klass } = await structure();
    const row = await createAssignment(admin, klass.id, {
      title: "Lab safety",
      type: "quiz",
      grading_mode: "band",
    });
    expect(row.max_points).toBeNull();
    expect(row.grading_mode).toBe("band");
  });

  it("reports every problem in one 422", async () => {
    const { admin, klass } = await structure();
    const error = await failure(
      createAssignment(admin, klass.id, {
        title: "",
        type: "exam",
        max_points: "0",
        max_submissions: 0,
        grading_scale_id: "00000000-0000-7000-8000-000000000000",
      }),
    );
    expect(error.status).toBe(STATUS.unprocessable_content);
    expect(codes(error)).toEqual([
      "name_required",
      "must_be_positive",
      "invalid_max_submissions",
      "not_found",
    ]);
  });

  it("applies the mode rules for points", () => {
    const run = (input: Partial<AssignmentInput>) =>
      validateAssignmentInput({ ...base, ...input }).map((i) => i.code);

    expect(run({ max_points: null })).toEqual(["max_points_required"]);
    expect(run({ max_points: undefined })).toEqual(["max_points_required"]);
    expect(run({ max_points: "10.555" })).toEqual(["invalid_number"]);
    expect(run({ max_points: "100000" })).toEqual(["too_large"]);
    expect(run({ max_points: "99999.99" })).toEqual([]);
    expect(run({ grading_mode: "band" })).toEqual(["max_points_not_allowed"]);
    expect(run({ grading_mode: "band", max_points: null })).toEqual([]);
    expect(run({ max_submissions: 21 })).toEqual(["invalid_max_submissions"]);
    expect(run({ max_submissions: 1.5 })).toEqual(["invalid_max_submissions"]);
    expect(run({ max_submissions: 20 })).toEqual([]);
  });
});
