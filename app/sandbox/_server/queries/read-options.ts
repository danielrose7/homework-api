import { ownerPool } from "@/app/sandbox/_server/owner-pool";

export interface SandboxOptions {
  assignments: Array<{
    id: string;
    title: string;
    class_name: string;
    grading_mode: string;
    max_points: string | null;
  }>;
  submissions: Array<{
    id: string;
    assignment_id: string;
    assignment_title: string;
    grading_mode: string;
    max_points: string | null;
    student: string;
    teacher: string;
    grade_label: string | null;
  }>;
}

/** Ids and readable labels for the console's pickers; the public API has no assignment listing yet. */
export async function readSandboxOptions(): Promise<SandboxOptions> {
  const pool = ownerPool();
  const assignments = await pool.query(
    `SELECT a.id, a.title, c.name AS class_name, a.grading_mode, a.max_points::text
     FROM assignment a JOIN class c ON c.id = a.class_id
     WHERE a.deleted_at IS NULL ORDER BY c.name, a.title`,
  );
  const submissions = await pool.query(
    `SELECT s.id, s.assignment_id, a.title AS assignment_title, a.grading_mode,
            a.max_points::text, su.username AS student, tu.username AS teacher, s.grade_label
     FROM assignment_submission s
     JOIN assignment a ON a.id = s.assignment_id
     JOIN class_seat cs ON cs.id = s.class_seat_id
     JOIN member sm ON sm.id = cs.member_id
     JOIN "user" su ON su.id = sm.user_id
     JOIN class_teacher ct ON ct.class_id = a.class_id AND ct.deleted_at IS NULL
     JOIN member tm ON tm.id = ct.member_id
     JOIN "user" tu ON tu.id = tm.user_id
     WHERE s.deleted_at IS NULL AND a.deleted_at IS NULL
     ORDER BY s.submitted_at DESC, s.id DESC`,
  );
  return { assignments: assignments.rows, submissions: submissions.rows };
}
