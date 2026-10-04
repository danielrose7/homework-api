import { describe, expect, it } from "vitest";

import { STATUS } from "@/lib/http-status";
import { ApiError } from "@/lib/server/errors";
import { submitAssignment } from "@/modules/submissions/mutations/submit-assignment";
import { seedAssignment } from "@/test/scenarios/class";

import { raceDb, withCommittedDb } from "./committed-db";

withCommittedDb();

async function submitTogether(
  count: number,
  seeded: Awaited<ReturnType<typeof seedAssignment>>,
) {
  const ctx = await seeded.school.students[0]!.context();
  return Promise.allSettled(
    Array.from({ length: count }, (_, index) =>
      submitAssignment(ctx, seeded.assignment.id, {
        text: `attempt ${index}`,
        files: [],
      }),
    ),
  );
}

function rejections(results: PromiseSettledResult<unknown>[]) {
  return results.flatMap((result) => {
    if (result.status === "fulfilled") return [];
    if (!(result.reason instanceof ApiError)) throw result.reason;
    return [result.reason];
  });
}

describe("submitting at the same time", () => {
  it("lets exactly one of many parallel submits through when the limit is 1", async () => {
    const seeded = await seedAssignment();

    const results = await submitTogether(8, seeded);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failures = rejections(results);
    expect(failures).toHaveLength(7);
    for (const failure of failures) {
      expect(failure.status).toBe(STATUS.conflict);
      expect(failure.code).toBe("submission_limit_reached");
    }
    expect(await raceDb().assignmentSubmission.count()).toBe(1);
    expect(
      await raceDb().activityLog.count({ where: { action: "create" } }),
    ).toBe(1);
  });

  it("numbers every accepted attempt once when the limit is higher", async () => {
    const seeded = await seedAssignment({ assignment: { max_submissions: 3 } });

    const results = await submitTogether(6, seeded);

    const saved = results.flatMap((r) =>
      r.status === "fulfilled" ? [r.value.submission.attempt_number] : [],
    );
    expect(saved.toSorted()).toEqual([1, 2, 3]);
    for (const failure of rejections(results)) {
      expect(failure.code).toBe("submission_limit_reached");
    }
    const rows = await raceDb().assignmentSubmission.findMany({
      orderBy: { attempt_number: "asc" },
    });
    expect(rows.map((row) => row.attempt_number)).toEqual([1, 2, 3]);
  });

  it("does not let two students block each other", async () => {
    const seeded = await seedAssignment({ students: 2 });
    const contexts = await Promise.all(
      seeded.school.students.map((student) => student.context()),
    );

    const results = await Promise.all(
      contexts.map((ctx) =>
        submitAssignment(ctx, seeded.assignment.id, {
          text: "mine",
          files: [],
        }),
      ),
    );

    expect(results.map((r) => r.submission.attempt_number)).toEqual([1, 1]);
  });
});
