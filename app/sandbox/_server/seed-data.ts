import type { RoleName } from "@/lib/server/permissions";

export const SANDBOX_SCHOOL = { name: "Sandbox", slug: "sandbox" } as const;
export const SANDBOX_PASSWORD = "sandbox-dev";

export interface PersonSpec {
  username: string;
  name: string;
  role: RoleName;
}

export const PEOPLE: readonly PersonSpec[] = [
  { username: "reyes", name: "Dr. Marta Reyes", role: "administrator" },
  { username: "alvarez", name: "Ms. Inez Alvarez", role: "teacher" },
  { username: "chen", name: "Mr. David Chen", role: "teacher" },
  { username: "okafor", name: "Dr. Ada Okafor", role: "teacher" },
  { username: "maya", name: "Maya Brooks", role: "student" },
  { username: "jon", name: "Jon Whitaker", role: "student" },
  { username: "priya", name: "Priya Nair", role: "student" },
  { username: "theo", name: "Theo Marsh", role: "student" },
  { username: "lena", name: "Lena Fischer", role: "student" },
  { username: "omar", name: "Omar Haddad", role: "student" },
  { username: "sam", name: "Sam Ortiz", role: "student" },
  { username: "noor", name: "Noor Rahman", role: "student" },
];

export type ScaleKey = "standard" | "plus_minus" | "pass_fail";

export interface AssignmentSpec {
  key: string;
  class_key: string;
  title: string;
  type: "homework" | "quiz" | "exam" | "project";
  grading_mode: "points" | "band";
  max_points: string | null;
  scale?: ScaleKey;
  due_in_days: number;
  /** Set to demonstrate a soft-deleted assignment and, later, restore. */
  deleted?: boolean;
}

export interface ClassSpec {
  key: string;
  name: string;
  teacher: string;
  scale?: ScaleKey;
}

export const CLASSES: readonly ClassSpec[] = [
  { key: "algebra", name: "Algebra I", teacher: "alvarez" },
  { key: "english", name: "English 9", teacher: "chen", scale: "plus_minus" },
  { key: "biology", name: "Biology", teacher: "okafor" },
];

export const ASSIGNMENTS: readonly AssignmentSpec[] = [
  {
    key: "quiz",
    class_key: "algebra",
    title: "Linear equations quiz",
    type: "quiz",
    grading_mode: "points",
    max_points: "50",
    due_in_days: -10,
  },
  {
    key: "quadratics",
    class_key: "algebra",
    title: "Quadratics problem set",
    type: "homework",
    grading_mode: "points",
    max_points: "100",
    due_in_days: 4,
  },
  {
    key: "gatsby",
    class_key: "english",
    title: "Gatsby essay",
    type: "project",
    grading_mode: "points",
    max_points: "100",
    due_in_days: -6,
  },
  {
    key: "poetry",
    class_key: "english",
    title: "Poetry close reading",
    type: "homework",
    grading_mode: "points",
    max_points: "20",
    due_in_days: 2,
  },
  {
    key: "rome",
    class_key: "english",
    title: "Ancient Rome map",
    type: "project",
    grading_mode: "points",
    max_points: "40",
    due_in_days: 9,
    deleted: true,
  },
  {
    key: "lab",
    class_key: "biology",
    title: "Lab report: density",
    type: "homework",
    grading_mode: "band",
    max_points: null,
    scale: "pass_fail",
    due_in_days: -3,
  },
  {
    key: "cells",
    class_key: "biology",
    title: "Cell structure worksheet",
    type: "homework",
    grading_mode: "points",
    max_points: "30",
    scale: "pass_fail",
    due_in_days: 5,
  },
];

export interface GradeSpec {
  /** Exactly one of points or band. */
  points?: string;
  band?: string;
  notes?: string;
  /** Hours after submitting. */
  after_hours?: number;
  /** A later regrade, which needs a reason. */
  regrade?: {
    points?: string;
    band?: string;
    notes?: string;
    reason: string;
    after_hours: number;
  };
}

export interface SubmissionSpec {
  student: string;
  assignment: string;
  days_ago: number;
  text: string;
  grade?: GradeSpec;
}

const day = (hours: number) => hours;

/*
 * Students with no row for an assignment are the "missing" cases, for example sam and lena on the quiz.
 * Maya has one open assignment (the cell worksheet) so a demo can submit as her.
 */
export const SUBMISSIONS: readonly SubmissionSpec[] = [
  {
    student: "maya",
    assignment: "quiz",
    days_ago: 12,
    text: "x = 4 for the first, x = -2 for the second. Checked by substitution.",
    grade: {
      points: "47",
      notes: "Clean working on every step.",
      after_hours: day(30),
    },
  },
  {
    student: "maya",
    assignment: "quadratics",
    days_ago: 3,
    text: "Problems 1 to 6 done. I ran out of time on the last four.",
    grade: {
      band: "Incomplete",
      notes: "Problems 7 to 10 are missing.",
      after_hours: day(20),
    },
  },
  {
    student: "maya",
    assignment: "gatsby",
    days_ago: 9,
    text: "Gatsby's green light is a symbol of a future that keeps receding as he reaches for it.",
    grade: {
      points: "84",
      notes: "Strong thesis. Tighten the second paragraph.",
      after_hours: day(40),
    },
  },
  {
    student: "maya",
    assignment: "poetry",
    days_ago: 2,
    text: "The final stanza turns the winter image into a promise of return.",
  },
  {
    student: "maya",
    assignment: "lab",
    days_ago: 6,
    text: "Mass over volume gave 2.7 g/cm3, close to aluminum. Two trials, similar results.",
    grade: {
      band: "Pass",
      notes: "Good procedure notes.",
      after_hours: day(26),
    },
  },

  {
    student: "jon",
    assignment: "quiz",
    days_ago: 12,
    text: "I got 3 and -1 but I am not sure about number six.",
    grade: {
      points: "38",
      notes: "Check your sign errors in problem 6.",
      after_hours: day(28),
    },
  },
  {
    student: "jon",
    assignment: "gatsby",
    days_ago: 8,
    text: "Nick narrates the story, which makes Gatsby seem larger than he is.",
    grade: {
      points: "72",
      notes: "Needs more textual evidence.",
      after_hours: day(36),
    },
  },
  {
    student: "jon",
    assignment: "poetry",
    days_ago: 4,
    text: "The poem is about loss and how the speaker copes with it.",
  },
  {
    student: "jon",
    assignment: "cells",
    days_ago: 1,
    text: "Nucleus, mitochondria, ribosome. I mixed up two labels on the diagram.",
    grade: {
      points: "14",
      notes: "Review organelle functions.",
      after_hours: day(10),
    },
  },

  {
    student: "priya",
    assignment: "quiz",
    days_ago: 11,
    text: "All six solved and verified. Extra: graphed each line.",
    grade: { points: "50", notes: "Perfect.", after_hours: day(22) },
  },
  {
    student: "priya",
    assignment: "quadratics",
    days_ago: 5,
    text: "Factored where possible and used the formula for the rest.",
    grade: { points: "93", notes: "Excellent.", after_hours: day(30) },
  },
  {
    student: "priya",
    assignment: "gatsby",
    days_ago: 7,
    text: "The valley of ashes is the moral counterweight to East Egg's glitter.",
  },

  {
    student: "theo",
    assignment: "quiz",
    days_ago: 10,
    text: "I factored first, then solved. Some of them did not work out.",
    grade: {
      points: "31",
      notes: "See me about factoring.",
      after_hours: day(26),
    },
  },
  {
    student: "theo",
    assignment: "poetry",
    days_ago: 4,
    text: "It rhymes and it is about a bird.",
    grade: {
      points: "11",
      notes: "Where is the analysis?",
      after_hours: day(18),
    },
  },
  {
    student: "theo",
    assignment: "lab",
    days_ago: 2,
    text: "We measured the block and the water. Results are in the table.",
    grade: {
      band: "Fail",
      notes: "Hypothesis is missing.",
      after_hours: day(15),
    },
  },

  {
    student: "lena",
    assignment: "quadratics",
    days_ago: 2,
    text: "Completed the square on every problem, with graphs.",
  },
  {
    student: "lena",
    assignment: "gatsby",
    days_ago: 8,
    text: "Fitzgerald lets Daisy's voice carry the novel's central irony: it sounds like money.",
    grade: { points: "91", notes: "Beautiful voice.", after_hours: day(30) },
  },
  {
    student: "lena",
    assignment: "poetry",
    days_ago: 3,
    text: "The caesura in line nine forces the reader to pause where the speaker cannot.",
    grade: {
      points: "17",
      notes: "Nice reading of the final stanza.",
      after_hours: day(22),
    },
  },

  {
    student: "omar",
    assignment: "quiz",
    days_ago: 12,
    text: "Solved all six; problem 4 needed a second try.",
    grade: { points: "44", notes: "Solid.", after_hours: day(32) },
  },
  {
    student: "omar",
    assignment: "lab",
    days_ago: 1,
    text: "Density of the sample: 1.9 g/cm3. Source of error: air bubbles.",
  },

  {
    student: "sam",
    assignment: "quadratics",
    days_ago: 3,
    text: "Used the quadratic formula for all ten.",
    grade: {
      points: "64",
      notes: "Revisit completing the square.",
      after_hours: day(26),
    },
  },
  {
    student: "sam",
    assignment: "poetry",
    days_ago: 5,
    text: "The speaker moves from anger to acceptance across three stanzas.",
    grade: { points: "15", notes: "Good.", after_hours: day(20) },
  },
  {
    student: "sam",
    assignment: "cells",
    days_ago: 1,
    text: "Labeled every organelle and wrote one sentence on each function.",
    grade: { points: "25", notes: "Nicely done.", after_hours: day(9) },
  },

  {
    student: "noor",
    assignment: "quiz",
    days_ago: 11,
    text: "I solved them but wrote the fractions loosely.",
    grade: {
      points: "40",
      notes: "Careful with fractions.",
      after_hours: day(26),
      regrade: {
        points: "46",
        notes: "Fractions are correct after review.",
        reason: "Recount after parent meeting",
        after_hours: day(120),
      },
    },
  },
  {
    student: "noor",
    assignment: "gatsby",
    days_ago: 6,
    text: "Short draft. I will add the rest soon.",
    grade: {
      points: "55",
      notes: "Resubmit with a full draft next time.",
      after_hours: day(30),
    },
  },
];
