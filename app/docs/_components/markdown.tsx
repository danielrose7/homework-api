import Link from "next/link";
import { isValidElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { ExampleFor } from "@/app/docs/_components/example-for";
import { headingId } from "@/app/docs/_lib/content";
import { cn } from "@/lib/utils";

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node))
    return textOf(node.props.children);
  return "";
}

const components: Components = {
  h2: ({ children }) => (
    <h2
      id={headingId(textOf(children))}
      className="mt-12 mb-3 scroll-mt-20 border-t pt-8 font-display font-semibold text-2xl first:mt-0 first:border-t-0 first:pt-0"
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      id={headingId(textOf(children))}
      className="mt-8 mb-2 scroll-mt-20 text-lg font-semibold"
    >
      {children}
    </h3>
  ),
  p: ({ children }) => <p className="my-4 leading-7">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-2 pl-6 leading-7">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-2 pl-6 leading-7">{children}</ol>
  ),
  a: ({ href = "", children }) =>
    href.startsWith("/") ? (
      <Link href={href} className="underline underline-offset-4">
        {children}
      </Link>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-4"
      >
        {children}
      </a>
    ),
  pre: ({ children }) => (
    <pre className="bg-muted my-5 overflow-x-auto rounded-lg border p-3 font-mono text-[12.5px] leading-6">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="my-5 overflow-x-auto rounded-lg border font-(family-name:--font-app)">
      <table className="w-full border-collapse text-left text-[12.5px]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="bg-muted border-b px-3 py-2 font-medium">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border-b px-3 py-2 align-top last:border-b-0">{children}</td>
  ),
};

const EXAMPLE_FENCE = /^```example\n(.+?)\n```$/gm;

/** Splits on ```example fences, which stand for a tested example instead of literal code. */
function segments(markdown: string) {
  const parts: Array<
    { kind: "text"; text: string } | { kind: "example"; spec: string }
  > = [];
  let last = 0;
  for (const match of markdown.matchAll(EXAMPLE_FENCE)) {
    parts.push({ kind: "text", text: markdown.slice(last, match.index) });
    parts.push({ kind: "example", spec: match[1] ?? "" });
    last = match.index + match[0].length;
  }
  parts.push({ kind: "text", text: markdown.slice(last) });
  return parts;
}

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 font-sans text-[15px]", className)}>
      {segments(children).map((part, index) => {
        if (part.kind === "text")
          return (
            <ReactMarkdown
              key={index}
              remarkPlugins={[remarkGfm]}
              components={components}
            >
              {part.text}
            </ReactMarkdown>
          );
        const [route = "", title = ""] = part.spec
          .split("|")
          .map((piece) => piece.trim());
        return <ExampleFor key={index} route={route} title={title} />;
      })}
    </div>
  );
}

/** Inline Markdown for table cells and captions: code, emphasis and links, with no paragraph around them. */
export function InlineMarkdown({ children }: { children: string }) {
  return (
    <ReactMarkdown
      allowedElements={["p", "code", "strong", "em", "a"]}
      unwrapDisallowed
      components={{
        ...components,
        p: ({ children: text }) => <>{text}</>,
      }}
    >
      {children}
    </ReactMarkdown>
  );
}
