import type { Metadata } from "next";

import { LanguageProvider } from "@/app/docs/_components/language";
import { Markdown } from "@/app/docs/_components/markdown";
import { RouteSection } from "@/app/docs/_components/route-section";
import { readContent } from "@/app/docs/_lib/content";
import { EXAMPLE_VARIABLES } from "@/lib/docs/examples";
import { ROUTE_DOCS } from "@/lib/docs/registry";
import type { RouteGroup } from "@/lib/docs/types";

export const metadata: Metadata = {
  title: "API docs · Homework API",
  description:
    "Reference for the Homework API: authentication, conventions, every route, and runnable curl, Python and Node examples.",
};

const GROUPS: RouteGroup[] = ["Auth", "Student", "Teacher", "Shared"];

const SECTIONS = [
  ["background", "Background"],
  ["authentication", "Authentication"],
  ["conventions", "Conventions"],
  ["resources", "Resources"],
  ["examples", "Running the examples"],
  ["routes", "Routes"],
  ["codebase", "Codebase guide"],
] as const;

function Heading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="scroll-mt-6 pt-10 pb-1 text-2xl font-semibold">
      {children}
    </h2>
  );
}

export default async function DocsPage() {
  const [
    background,
    authentication,
    conventions,
    resources,
    examples,
    codebase,
  ] = await Promise.all([
    readContent("background"),
    readContent("authentication"),
    readContent("conventions"),
    readContent("resources"),
    readContent("examples"),
    readContent("codebase"),
  ]);

  return (
    <LanguageProvider>
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-8 md:grid-cols-[14rem_minmax(0,1fr)]">
        <nav
          aria-label="Documentation"
          className="text-sm md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:self-start md:overflow-y-auto"
        >
          <p className="mb-3 font-semibold">Homework API</p>
          <ul className="space-y-1">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <a href={`#${id}`} className="hover:underline">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="text-muted-foreground mt-4 mb-1 text-xs tracking-wider uppercase">
                {group}
              </p>
              <ul className="space-y-1">
                {ROUTE_DOCS.filter((doc) => doc.group === group).map((doc) => (
                  <li key={doc.id}>
                    <a href={`#${doc.id}`} className="hover:underline">
                      {doc.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <main className="min-w-0">
          <h1 className="text-3xl font-semibold">Homework API</h1>
          <p className="text-muted-foreground mt-1">
            Submit homework, list it, grade it.
          </p>

          <Heading id="background">Background</Heading>
          <Markdown>{background}</Markdown>
          <Heading id="authentication">Authentication</Heading>
          <Markdown>{authentication}</Markdown>
          <Heading id="conventions">Conventions</Heading>
          <Markdown>{conventions}</Markdown>
          <Heading id="resources">Resources</Heading>
          <Markdown>{resources}</Markdown>
          <Heading id="examples">Running the examples</Heading>
          <Markdown>{examples}</Markdown>
          <div className="my-3 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {EXAMPLE_VARIABLES.map((variable) => (
                  <tr key={variable.name}>
                    <td className="border-b px-3 py-2 align-top font-mono text-[13px] last:border-b-0">
                      {variable.name}
                    </td>
                    <td className="border-b px-3 py-2 align-top last:border-b-0">
                      {variable.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Heading id="routes">Routes</Heading>
          {GROUPS.map((group) => (
            <div key={group}>
              <h3 className="text-muted-foreground mt-8 text-sm font-medium tracking-wider uppercase">
                {group}
              </h3>
              {ROUTE_DOCS.filter((doc) => doc.group === group).map((doc) => (
                <RouteSection key={doc.id} doc={doc} />
              ))}
            </div>
          ))}
          <Heading id="codebase">Codebase guide</Heading>
          <Markdown>{codebase}</Markdown>
        </main>
      </div>
    </LanguageProvider>
  );
}
