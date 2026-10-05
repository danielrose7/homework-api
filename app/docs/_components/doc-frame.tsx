import Link from "next/link";
import type { ReactNode } from "react";

import { GITHUB_URL } from "@/app/_components/site-nav";
import { Toc } from "@/app/docs/_components/toc";
import type { Heading } from "@/app/docs/_lib/content";
import { readingOrder } from "@/app/docs/_lib/nav";

export function DocFrame({
  href,
  section,
  title,
  description,
  headings,
  source,
  children,
}: {
  href: string;
  section: string;
  title: string;
  description: string;
  headings: Heading[];
  /** Repo path of the Markdown behind the page, for the edit link. */
  source?: string;
  children: ReactNode;
}) {
  const order = readingOrder();
  const index = order.findIndex((link) => link.href === href);
  const previous = index > 0 ? order[index - 1] : undefined;
  const next = index >= 0 ? order[index + 1] : undefined;

  return (
    <div className="mx-auto grid w-full max-w-5xl min-w-0 gap-10 px-5 py-10 sm:px-8 xl:max-w-6xl xl:grid-cols-[minmax(0,1fr)_12rem]">
      <article className="min-w-0 xl:max-w-3xl">
        <p className="text-muted-foreground mb-3 text-[11px] tracking-wider uppercase">
          <Link href="/docs" className="hover:text-foreground">
            Docs
          </Link>{" "}
          / {section}
        </p>
        <h1 className="font-display font-semibold text-4xl leading-[1.1] tracking-tight">
          {title}
        </h1>
        <p className="text-muted-foreground mt-3 mb-10 max-w-xl font-sans text-lg leading-7">
          {description}
        </p>
        {children}
        <footer className="mt-16 border-t pt-6">
          {source ? (
            <a
              href={`${GITHUB_URL}/blob/main/${source}`}
              className="text-muted-foreground hover:text-foreground"
            >
              Edit this page on GitHub ↗
            </a>
          ) : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {previous ? (
              <Link
                href={previous.href}
                className="hover:border-ring rounded-lg border px-4 py-3"
              >
                <span className="text-muted-foreground block text-[11px] uppercase">
                  ← Previous
                </span>
                <span className="font-bold">{previous.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                href={next.href}
                className="hover:border-ring rounded-lg border px-4 py-3 text-right"
              >
                <span className="text-muted-foreground block text-[11px] uppercase">
                  Next →
                </span>
                <span className="font-bold">{next.title}</span>
              </Link>
            ) : null}
          </div>
        </footer>
      </article>
      <aside className="hidden xl:block">
        <div className="sticky top-[73px]">
          <Toc headings={headings} />
        </div>
      </aside>
    </div>
  );
}
