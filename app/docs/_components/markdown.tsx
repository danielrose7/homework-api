import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const components: Components = {
  h2: ({ children }) => (
    <h3 className="mt-8 mb-2 text-lg font-semibold">{children}</h3>
  ),
  h3: ({ children }) => (
    <h4 className="mt-6 mb-2 text-base font-semibold">{children}</h4>
  ),
  p: ({ children }) => <p className="my-3 leading-7">{children}</p>,
  ul: ({ children }) => (
    <ul className="my-3 list-disc space-y-1.5 pl-6 leading-7">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 list-decimal space-y-1.5 pl-6 leading-7">{children}</ol>
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
    <pre className="bg-muted my-4 overflow-x-auto rounded-lg border p-3 font-mono text-[13px] leading-6">
      {children}
    </pre>
  ),
  code: ({ className, children }) =>
    className ? (
      <code className={className}>{children}</code>
    ) : (
      <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.9em]">
        {children}
      </code>
    ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-lg border">
      <table className="w-full border-collapse text-left text-sm">
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

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
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
