import {
  ExampleBlock,
  type ExampleView,
} from "@/app/docs/_components/example-block";
import { EXAMPLES, type RouteExample } from "@/app/docs/_lib/examples";
import { ROUTE_DOCS } from "@/app/docs/_lib/registry";
import {
  LANGUAGES,
  renderSnippet,
  type Language,
} from "@/app/docs/_lib/snippets";
import type { RouteDoc } from "@/lib/server/route-doc";

export function viewOf(
  doc: RouteDoc,
  example: RouteExample,
  id: string,
): ExampleView {
  return {
    id,
    title: example.title,
    as: example.as,
    status: example.expect.status,
    code: example.expect.code,
    snippets: Object.fromEntries(
      LANGUAGES.map(({ id: language }) => [
        language,
        renderSnippet(doc, example, language),
      ]),
    ) as Record<Language, string>,
  };
}

export function examplesFor(doc: RouteDoc): ExampleView[] {
  return EXAMPLES.filter((example) => example.route === doc.id).map(
    (example, index) => viewOf(doc, example, `${doc.id}-example-${index}`),
  );
}

/** One named example embedded in a guide, from an ```example fence reading `route | title`. */
export function findExample(route: string, title: string) {
  const doc = ROUTE_DOCS.find((candidate) => candidate.id === route);
  const example = EXAMPLES.find(
    (candidate) => candidate.route === route && candidate.title === title,
  );
  return doc && example ? { doc, example } : null;
}

export function ExampleFor({ route, title }: { route: string; title: string }) {
  const found = findExample(route, title);
  if (!found) throw new Error(`No example "${title}" for route ${route}`);
  const view = viewOf(found.doc, found.example, `${route}-${title}`);
  return (
    <div className="my-5">
      <p className="mb-1.5 flex flex-wrap items-baseline gap-2">
        <span className="text-muted-foreground">
          {view.as ? `as ${view.as}` : "no token"}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="font-bold">{view.status}</span>
        {view.code ? (
          <span className="text-muted-foreground">{view.code}</span>
        ) : null}
      </p>
      <ExampleBlock example={view} />
    </div>
  );
}
