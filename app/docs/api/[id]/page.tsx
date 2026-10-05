import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocFrame } from "@/app/docs/_components/doc-frame";
import { RouteBody, routeHeadings } from "@/app/docs/_components/route-body";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";
import { apiHref, routeForApiSlug } from "@/app/docs/_lib/nav";

export async function generateMetadata({
  params,
}: PageProps<"/docs/api/[id]">): Promise<Metadata> {
  const doc = routeForApiSlug((await params).id);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

export default async function ApiRoutePage({
  params,
}: PageProps<"/docs/api/[id]">) {
  const doc = routeForApiSlug((await params).id);
  if (!doc) notFound();

  return (
    <DocFrame
      href={apiHref(doc)}
      section={`API reference / ${doc.group}`}
      title={doc.title}
      description={doc.summary}
      headings={routeHeadings(doc)}
    >
      <RouteBody
        doc={doc}
        consoleHref={
          sandboxEnabled() ? `/sandbox/console?route=${doc.id}` : undefined
        }
      />
    </DocFrame>
  );
}
