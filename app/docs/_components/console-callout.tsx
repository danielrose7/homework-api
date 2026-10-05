import Link from "next/link";

import { GITHUB_URL } from "@/app/_components/github";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";

export const RUN_LOCALLY_URL = `${GITHUB_URL}#run-it-locally`;

export function ConsoleCallout({ route }: { route?: string }) {
  const enabled = sandboxEnabled();
  return (
    <div className="bg-muted mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border px-5 py-4">
      <p className="max-w-lg font-sans text-[14.5px] leading-6">
        {enabled
          ? "Rather click than type? The sandbox console makes each of these calls as a seeded student or teacher, and shows the request to copy as curl."
          : "The sandbox console only runs where SANDBOX_MODE is on. Run the project locally to click through every call."}
      </p>
      {enabled ? (
        <Link
          href={route ? `/sandbox/console?route=${route}` : "/sandbox/console"}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-bold"
        >
          Open the console
        </Link>
      ) : (
        <a
          href={RUN_LOCALLY_URL}
          className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-bold"
        >
          Run it locally
        </a>
      )}
    </div>
  );
}
