import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ConsoleCallout } from "@/app/docs/_components/console-callout";
import { DocFrame } from "@/app/docs/_components/doc-frame";
import { Markdown } from "@/app/docs/_components/markdown";
import { RunExamplesVariables } from "@/app/docs/_components/example-variables";
import { contentPath, headingsOf, readContent } from "@/app/docs/_lib/content";
import { ARCHITECTURE_SECTION, CONTENT_SECTIONS } from "@/app/docs/_lib/nav";

const CONSOLE_ROUTE: Record<string, string | null> = {
  introduction: null,
  "getting-started": "sign_in",
  "guides/submit-homework": "submit",
  "guides/grade-submissions": "grade",
};

const SECTIONS = [...CONTENT_SECTIONS, ARCHITECTURE_SECTION];

function find(slug: string[]) {
  const path = slug.join("/");
  for (const section of SECTIONS) {
    const page = section.pages.find((candidate) => candidate.slug === path);
    if (page) return { section, page };
  }
  return null;
}

export async function generateMetadata({
  params,
}: PageProps<"/docs/[...slug]">): Promise<Metadata> {
  const found = find((await params).slug);
  return found
    ? { title: found.page.title, description: found.page.description }
    : {};
}

export default async function DocPage({
  params,
}: PageProps<"/docs/[...slug]">) {
  const { slug } = await params;
  const found = find(slug);
  if (!found) notFound();
  const { section, page } = found;
  const markdown = await readContent(page.slug);

  return (
    <DocFrame
      href={`/docs/${page.slug}`}
      section={section.title}
      title={page.title}
      description={page.description}
      headings={headingsOf(markdown)}
      source={contentPath(page.slug).replace(`${process.cwd()}/`, "")}
    >
      {page.slug in CONSOLE_ROUTE ? (
        <ConsoleCallout route={CONSOLE_ROUTE[page.slug] ?? undefined} />
      ) : null}
      <Markdown>{markdown}</Markdown>
      {page.slug === "run-the-examples" ? <RunExamplesVariables /> : null}
    </DocFrame>
  );
}
