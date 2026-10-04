import {
  academicYearFactory,
  assignmentFactory,
  classFactory,
  classSeatFactory,
  classTeacherFactory,
  submissionFactory,
  termFactory,
  type AcademicYearRecord,
  type AssignmentBuild,
  type AssignmentRecord,
  type ClassRecord,
  type ClassSeatRecord,
  type SubmissionRecord,
  type TermRecord,
} from "../factories/academics";

import {
  seedSchool,
  type SeedSchoolOptions,
  type SeededSchool,
} from "./school";

export interface SeedClassOptions extends SeedSchoolOptions {
  school?: SeededSchool;
  className?: string;
}

export interface SeededClass {
  school: SeededSchool;
  year: AcademicYearRecord;
  term: TermRecord;
  klass: ClassRecord;
  seats: ClassSeatRecord[];
}

/** A school plus a current term and a class that every seeded teacher teaches and every seeded student attends. */
export async function seedClass(
  options: SeedClassOptions = {},
): Promise<SeededClass> {
  const school = options.school ?? (await seedSchool(options));
  const organizationId = school.organization.id;

  const year = await academicYearFactory.create({ organizationId });
  const term = await termFactory.current().create({
    academicYearId: year.id,
  });
  const klass = await classFactory.create({
    termId: term.id,
    ...(options.className ? { name: options.className } : {}),
  });

  for (const teacher of school.teachers) {
    await classTeacherFactory.create({
      classId: klass.id,
      memberId: teacher.member.id,
    });
  }
  const seats: ClassSeatRecord[] = [];
  for (const student of school.students) {
    seats.push(
      await classSeatFactory.create({
        classId: klass.id,
        memberId: student.member.id,
      }),
    );
  }
  return { school, year, term, klass, seats };
}

export interface SeedAssignmentOptions extends SeedClassOptions {
  seeded?: SeededClass;
  assignment?: Partial<AssignmentBuild>;
}

export interface SeededAssignment extends SeededClass {
  assignment: AssignmentRecord;
}

/** `seedClass` plus a published, points-graded homework assignment, unless overridden. */
export async function seedAssignment(
  options: SeedAssignmentOptions = {},
): Promise<SeededAssignment> {
  const seeded = options.seeded ?? (await seedClass(options));
  const assignment = await assignmentFactory.create({
    ...options.assignment,
    classId: seeded.klass.id,
  });
  return { ...seeded, assignment };
}

export interface SeedSubmissionOptions extends SeedAssignmentOptions {
  seededAssignment?: SeededAssignment;
  grade?: { points: string | number } | { band: string };
  notes?: string;
}

export interface SeededSubmission extends SeededAssignment {
  submission: SubmissionRecord;
}

/** `seedAssignment` plus the first student's submission, optionally already graded. */
export async function seedSubmission(
  options: SeedSubmissionOptions = {},
): Promise<SeededSubmission> {
  const seeded = options.seededAssignment ?? (await seedAssignment(options));
  const seat = seeded.seats[0];
  if (!seat) throw new Error("seedSubmission needs at least one student");

  let factory = submissionFactory;
  if (options.grade && "points" in options.grade) {
    factory = factory.graded(options.grade.points, options.notes);
  } else if (options.grade) {
    factory = factory.markedBand(options.grade.band, options.notes);
  }
  const submission = await factory.create({
    assignmentId: seeded.assignment.id,
    classSeatId: seat.id,
  });
  return { ...seeded, submission };
}
