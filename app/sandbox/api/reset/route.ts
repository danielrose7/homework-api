import { auth } from "@/lib/server/auth";
import { prisma } from "@/lib/server/db";
import {
  sandboxDisabledResponse,
  sandboxEnabled,
} from "@/app/sandbox/_server/guard";
import { resetSandboxData } from "@/app/sandbox/_server/mutations/reset-sandbox";

export async function POST() {
  if (!sandboxEnabled()) return sandboxDisabledResponse();
  const owner_url = process.env.MIGRATION_DATABASE_URL;
  if (!owner_url) throw new Error("MIGRATION_DATABASE_URL is not set");

  const summary = await resetSandboxData({ db: prisma, auth, owner_url });
  return Response.json({
    object: "reset",
    school: summary.slug,
    people: summary.people.length,
    submissions: summary.submissions,
  });
}
