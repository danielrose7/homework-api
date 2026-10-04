import type { BandInput } from "@/lib/domain/grading";
import type { DbClient } from "@/lib/server/db-types";
import { toBandRows } from "@/modules/grading-scales/serializers";

export async function addBands(
  db: DbClient,
  organization_id: string,
  grading_scale_id: string,
  bands: readonly BandInput[],
) {
  await db.gradingScaleBand.createMany({
    data: toBandRows(bands).map((band) => ({
      ...band,
      organization_id,
      grading_scale_id,
    })),
  });
}
