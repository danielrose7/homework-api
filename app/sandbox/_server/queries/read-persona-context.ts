import { ownerPool } from "@/app/sandbox/_server/owner-pool";
import type { SandboxOptions } from "@/app/sandbox/_server/queries/read-options";
import { PEOPLE } from "@/app/sandbox/_server/seed-data";

export interface PersonaContext extends SandboxOptions {
  username: string;
}

/** What one persona can legitimately reference through the API: the records their role is allowed to read. */
export async function readPersonaContext(
  username: string,
): Promise<PersonaContext | null> {
  const person = PEOPLE.find((candidate) => candidate.username === username);
  if (!person) return null;
  const everything = person.role === "administrator";
  const pool = ownerPool();
  const assignments = await pool.query(
    `SELECT a.id, a.title, c.name AS class_name, a.grading_mode, a.max_points::text
     FROM assignment a JOIN class c ON c.id = a.class_id
     WHERE a.deleted_at IS NULL
       AND ($2 OR c.id IN (
         SELECT cs.class_id FROM class_seat cs
           JOIN member m ON m.id = cs.member_id JOIN "user" u ON u.id = m.user_id
          WHERE u.username = $1 AND cs.deleted_at IS NULL AND cs.status = 'active'
         UNION
         SELECT ct.class_id FROM class_teacher ct
           JOIN member m ON m.id = ct.member_id JOIN "user" u ON u.id = m.user_id
          WHERE u.username = $1 AND ct.deleted_at IS NULL))
     ORDER BY c.name, a.title`,
    [username, everything],
  );
  const submissions = await pool.query(
    `SELECT id, assignment_id, assignment_title, grading_mode, max_points, student, teacher, grade_label
     FROM (
       SELECT DISTINCT ON (s.id) s.id, s.assignment_id, a.title AS assignment_title, a.grading_mode,
              a.max_points::text, su.username AS student, tu.username AS teacher, s.grade_label,
              s.submitted_at
       FROM assignment_submission s
       JOIN assignment a ON a.id = s.assignment_id
       JOIN class_seat cs ON cs.id = s.class_seat_id
       JOIN member sm ON sm.id = cs.member_id
       JOIN "user" su ON su.id = sm.user_id
       JOIN class_teacher ct ON ct.class_id = a.class_id AND ct.deleted_at IS NULL
       JOIN member tm ON tm.id = ct.member_id
       JOIN "user" tu ON tu.id = tm.user_id
       WHERE s.deleted_at IS NULL AND a.deleted_at IS NULL
         AND ($2 OR su.username = $1 OR tu.username = $1)
       ORDER BY s.id, (tu.username = $1) DESC
     ) visible
     ORDER BY submitted_at DESC, id DESC`,
    [username, everything],
  );
  return {
    username,
    assignments: assignments.rows,
    submissions: submissions.rows,
  };
}
