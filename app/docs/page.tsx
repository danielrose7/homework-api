import type { Metadata } from "next";
import Link from "next/link";

import { ConsoleCallout } from "@/app/docs/_components/console-callout";
import { ROUTE_DOCS } from "@/app/docs/_lib/registry";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Reference, guides and runnable curl, Python and Node examples for the Homework API.",
};

const PATHS = [
  {
    href: "/docs/getting-started",
    title: "Getting started",
    body: "Sign in, submit and grade in three calls, against a seeded school.",
  },
  {
    href: "/docs/guides/submit-homework",
    title: "Guides",
    body: "Submit work with files, filter what is waiting, regrade with a reason.",
  },
  {
    href: "/docs/api",
    title: "API reference",
    body: `All ${ROUTE_DOCS.length} routes with fields, errors and examples in three languages.`,
  },
  {
    href: "/docs/architecture/decisions",
    title: "Under the hood",
    body: "The decisions behind the code: tenancy, grading scales, validation and more.",
  },
];

const CONCEPTS = [
  ["/docs/authentication", "Authentication"],
  ["/docs/errors", "Errors"],
  ["/docs/pagination", "Pagination"],
  ["/docs/resources/submission", "The submission object"],
  ["/docs/schools-and-roles", "Schools and roles"],
] as const;

export default function DocsHome() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-14 sm:px-8">
      <p className="text-muted-foreground mb-3 text-[11px] tracking-wider uppercase">
        Documentation
      </p>
      <h1 className="font-display font-semibold max-w-2xl text-4xl leading-[1.1] tracking-tight sm:text-5xl">
        Submit homework. List it. Grade it.
      </h1>
      <p className="text-muted-foreground mt-4 max-w-xl font-sans text-lg leading-7">
        A plain REST API for schools, with JSON bodies you can call from curl,
        Python or Node. Every example in these docs is a request that runs.
      </p>

      <div className="mt-8">
        <ConsoleCallout />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PATHS.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className="bg-card hover:border-ring group rounded-xl border p-5"
          >
            <span className="font-bold">
              {path.title}{" "}
              <span className="text-muted-foreground transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
            <span className="text-muted-foreground mt-1.5 block font-sans text-[14.5px] leading-6">
              {path.body}
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="text-muted-foreground text-[11px] tracking-wider uppercase">
          Concepts
        </span>
        {CONCEPTS.map(([href, label]) => (
          <Link key={href} href={href} className="hover:underline">
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
