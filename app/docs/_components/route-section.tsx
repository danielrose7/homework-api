import {
  ExampleBlock,
  type ExampleView,
} from "@/app/docs/_components/example-block";
import { FieldTable } from "@/app/docs/_components/field-table";
import { InlineMarkdown, Markdown } from "@/app/docs/_components/markdown";
import { EXAMPLES } from "@/app/docs/_lib/examples";
import { fieldsOf, type FieldDoc } from "@/app/docs/_lib/fields";
import {
  LANGUAGES,
  renderSnippet,
  type Language,
} from "@/app/docs/_lib/snippets";
import type { RouteDoc } from "@/lib/server/route-doc";
import { cn } from "@/lib/utils";

const ORG_SLUG_FIELD: FieldDoc = {
  name: "org_slug",
  type: "string",
  required: true,
  default: null,
  description: "The school's slug, such as `sandbox`.",
  constraints: [],
};

function methodColor(method: string) {
  if (method === "GET") return "text-method-get";
  if (method === "POST") return "text-method-post";
  if (method === "DELETE") return "text-destructive";
  return "text-method-put";
}

function StatusChip({ status }: { status: number }) {
  const tone =
    status < 300
      ? "bg-good/15 text-good"
      : status < 500
        ? "bg-warn/15 text-warn"
        : "bg-destructive/15 text-destructive";
  return (
    <span className={cn("rounded px-1.5 font-mono text-xs", tone)}>
      {status}
    </span>
  );
}

function Label({ children }: { children: string }) {
  return (
    <h5 className="text-muted-foreground mt-5 mb-1 text-xs font-medium tracking-wider uppercase">
      {children}
    </h5>
  );
}

function examplesFor(doc: RouteDoc): ExampleView[] {
  return EXAMPLES.filter((example) => example.route === doc.id).map(
    (example, index) => ({
      id: `${doc.id}-example-${index}`,
      title: example.title,
      as: example.as,
      status: example.expect.status,
      code: example.expect.code,
      snippets: Object.fromEntries(
        LANGUAGES.map(({ id }) => [id, renderSnippet(doc, example, id)]),
      ) as Record<Language, string>,
    }),
  );
}

export function RouteSection({ doc }: { doc: RouteDoc }) {
  const params = [
    ...(doc.path.includes("{org_slug}") ? [ORG_SLUG_FIELD] : []),
    ...(doc.params ? fieldsOf(doc.params) : []),
  ];
  const examples = examplesFor(doc);

  return (
    <section id={doc.id} className="scroll-mt-6 border-t py-8">
      <h4 className="text-xl font-semibold">{doc.title}</h4>
      <p className="my-3 flex flex-wrap items-baseline gap-x-2 font-mono text-[13.5px] break-all">
        <span className={cn("font-bold", methodColor(doc.method))}>
          {doc.method}
        </span>
        <span>{doc.path}</span>
      </p>
      <p className="text-muted-foreground text-sm">
        {doc.roles === "public"
          ? "No token needed."
          : `Who: ${doc.roles.join(", ")}.`}
      </p>
      <Markdown className="mt-3">{`${doc.summary}\n\n${doc.description}`}</Markdown>

      {params.length > 0 ? (
        <>
          <Label>Path parameters</Label>
          <FieldTable fields={params} />
        </>
      ) : null}
      {doc.query ? (
        <>
          <Label>Query parameters</Label>
          <FieldTable fields={fieldsOf(doc.query)} />
        </>
      ) : null}
      {(doc.bodies ?? []).map((body) => (
        <div key={body.content_type}>
          <Label>{`Body (${body.content_type})`}</Label>
          <FieldTable fields={fieldsOf(body.schema)} />
        </div>
      ))}

      <Label>Response</Label>
      <p className="flex items-baseline gap-2 text-sm">
        <StatusChip status={doc.success.status} />
        <span>
          <InlineMarkdown>{doc.success.description}</InlineMarkdown>
        </span>
      </p>

      {doc.errors.length > 0 ? (
        <>
          <Label>Errors</Label>
          <div className="my-3 overflow-x-auto rounded-lg border">
            <table className="w-full border-collapse text-left text-sm">
              <tbody>
                {doc.errors.map((error) => (
                  <tr
                    key={`${error.status}-${error.code}-${error.description}`}
                  >
                    <td className="border-b px-3 py-2 align-top whitespace-nowrap last:border-b-0">
                      <StatusChip status={error.status} />
                    </td>
                    <td className="border-b px-3 py-2 align-top font-mono text-[12.5px] last:border-b-0">
                      {error.code}
                    </td>
                    <td className="border-b px-3 py-2 align-top last:border-b-0">
                      <InlineMarkdown>{error.description}</InlineMarkdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {examples.length > 0 ? (
        <>
          <Label>Examples</Label>
          <div className="space-y-2">
            {examples.map((example, index) => (
              <details key={example.id} open={index === 0} className="group">
                <summary className="hover:bg-muted flex cursor-pointer flex-wrap items-baseline gap-2 rounded px-2 py-1 text-sm">
                  <span className="font-medium">{example.title}</span>
                  <span className="text-muted-foreground text-xs">
                    {example.as ? `as ${example.as}` : "no token"}
                  </span>
                  <StatusChip status={example.status} />
                  {example.code ? (
                    <span className="text-muted-foreground font-mono text-xs">
                      {example.code}
                    </span>
                  ) : null}
                </summary>
                <div className="mt-1">
                  <ExampleBlock example={example} />
                </div>
              </details>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
