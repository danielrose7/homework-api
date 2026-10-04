import { auth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import { demoDisabledResponse, demoModeEnabled } from "@/modules/demo/guard";
import { resetDemoData } from "@/modules/demo/mutations/reset-demo";

export async function POST() {
  if (!demoModeEnabled()) return demoDisabledResponse();
  const owner_url = process.env.MIGRATION_DATABASE_URL;
  if (!owner_url) throw new Error("MIGRATION_DATABASE_URL is not set");

  const summary = await resetDemoData({ db: prisma, auth, owner_url });
  return Response.json({
    object: "reset",
    school: summary.slug,
    people: summary.people.length,
    submissions: summary.submissions,
  });
}
