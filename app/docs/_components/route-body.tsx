import Link from "next/link";

import { ExampleBlock } from "@/app/docs/_components/example-block";
import { examplesFor } from "@/app/docs/_components/example-for";
import { FieldTable } from "@/app/docs/_components/field-table";
import { InlineMarkdown, Markdown } from "@/app/docs/_components/markdown";
import { fieldsOf, type FieldDoc } from "@/app/docs/_lib/fields";
import type { Heading } from "@/app/docs/_lib/content";
import { MethodTag } from "@/app/_components/method-tag";
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

function Label({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="mt-10 mb-3 scroll-mt-20 font-display font-semibold text-2xl"
    >
      {children}
    </h2>
  );
}

function sectionsOf(doc: RouteDoc) {
  const hasParams = doc.path.includes("{org_slug}") || Boolean(doc.params);
  return [
    hasParams && { id: "path-parameters", text: "Path parameters" },
    doc.query && { id: "query-parameters", text: "Query parameters" },
    (doc.bodies ?? []).length > 0 && {
      id: "request-body",
      text: "Request body",
    },
    { id: "response", text: "Response" },
    doc.errors.length > 0 && { id: "errors", text: "Errors" },
    examplesFor(doc).length > 0 && { id: "examples", text: "Examples" },
  ].filter((entry): entry is { id: string; text: string } => Boolean(entry));
}

export function routeHeadings(doc: RouteDoc): Heading[] {
  return sectionsOf(doc).map((entry) => ({ ...entry, level: 2 }));
}

export function RouteBody({
  doc,
  consoleHref,
}: {
  doc: RouteDoc;
  consoleHref?: string;
}) {
  const params = [
    ...(doc.path.includes("{org_slug}") ? [ORG_SLUG_FIELD] : []),
    ...(doc.params ? fieldsOf(doc.params) : []),
  ];
  const examples = examplesFor(doc);

  return (
    <section>
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border bg-card px-3 py-2.5 text-[13px] break-all">
        <MethodTag method={doc.method} className="text-[13px]" />
        <span>{doc.path}</span>
        {consoleHref ? (
          <Link
            href={consoleHref}
            className="ml-auto font-bold underline underline-offset-4"
          >
            Try in the console →
          </Link>
        ) : null}
      </p>
      <p className="text-muted-foreground mt-3 text-[12.5px]">
        {doc.roles === "public"
          ? "No token needed."
          : `Who: ${doc.roles.join(", ")}.`}
      </p>
      <Markdown className="mt-4">{doc.description}</Markdown>

      {params.length > 0 ? (
        <>
          <Label id="path-parameters">Path parameters</Label>
          <FieldTable fields={params} />
        </>
      ) : null}
      {doc.query ? (
        <>
          <Label id="query-parameters">Query parameters</Label>
          <FieldTable fields={fieldsOf(doc.query)} />
        </>
      ) : null}
      {(doc.bodies ?? []).map((body, index) => (
        <div key={body.content_type}>
          <Label
            id={index === 0 ? "request-body" : `request-body-${index}`}
          >{`Request body (${body.content_type})`}</Label>
          <FieldTable fields={fieldsOf(body.schema)} />
        </div>
      ))}

      <Label id="response">Response</Label>
      <p className="flex items-baseline gap-2 text-sm">
        <StatusChip status={doc.success.status} />
        <span>
          <InlineMarkdown>{doc.success.description}</InlineMarkdown>
        </span>
      </p>

      {doc.errors.length > 0 ? (
        <>
          <Label id="errors">Errors</Label>
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
          <Label id="examples">Examples</Label>
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
