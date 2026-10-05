import type { Metadata } from "next";
import Link from "next/link";

import { MethodTag } from "@/app/_components/method-tag";
import { DocFrame } from "@/app/docs/_components/doc-frame";
import { ROUTE_DOCS } from "@/app/docs/_lib/registry";
import { API_GROUPS, apiHref } from "@/app/docs/_lib/nav";

export const metadata: Metadata = {
  title: "API reference",
  description: "Every route, who may call it, and what it answers.",
};

export default function ApiIndexPage() {
  return (
    <DocFrame
      href="/docs/api"
      section="API reference"
      title="API reference"
      description="Every route, who may call it, and what it answers. All paths below start with the host and, for school routes, name the school: /api/v1/orgs/{org_slug}/…"
      headings={API_GROUPS.map((group) => ({
        id: group.toLowerCase(),
        text: group,
        level: 2 as const,
      }))}
    >
      {API_GROUPS.map((group) => (
        <section key={group}>
          <h2
            id={group.toLowerCase()}
            className="font-display mt-10 mb-3 scroll-mt-20 text-3xl first:mt-0"
          >
            {group}
          </h2>
          <ul className="divide-y rounded-lg border">
            {ROUTE_DOCS.filter((doc) => doc.group === group).map((doc) => (
              <li key={doc.id}>
                <Link
                  href={apiHref(doc)}
                  className="hover:bg-muted grid gap-x-4 gap-y-0.5 px-3 py-2.5 sm:grid-cols-[3.5rem_minmax(0,1fr)]"
                >
                  <MethodTag method={doc.method} className="text-[12px]" />
                  <span className="min-w-0">
                    <span className="font-bold">{doc.title}</span>
                    <span className="text-muted-foreground block break-all">
                      {doc.path.replace("/api/v1/orgs/{org_slug}", "…")}
                    </span>
                    <span className="text-muted-foreground block font-sans text-[13.5px]">
                      {doc.summary}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </DocFrame>
  );
}
