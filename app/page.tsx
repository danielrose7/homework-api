import Link from "next/link";

import { PersonalNote } from "@/app/_components/personal-note";
import { GITHUB_URL } from "@/app/_components/github";
import { SiteHeader } from "@/app/_components/site-header";
import { ExampleFor } from "@/app/docs/_components/example-for";
import { LanguageProvider } from "@/app/docs/_components/language";
import { EXAMPLES } from "@/app/docs/_lib/examples";
import { ROUTE_DOCS } from "@/app/docs/_lib/registry";
import { sandboxEnabled } from "@/app/sandbox/_server/guard";

const STEPS = [
  {
    route: "sign_in",
    title: "Sign in",
    heading: "Get a token",
    body: "A username and password trade for a bearer token.",
  },
  {
    route: "submit",
    title: "Submit text",
    heading: "A student hands in work",
    body: "Text, files or both, once per assignment unless the teacher allows more.",
  },
  {
    route: "grade",
    title: "Grade with points",
    heading: "A teacher grades it",
    body: "The school's scale turns points into a grade, stored with the submission.",
  },
] as const;

const BRIEF = [
  ["Students submit homework", "/docs/api/submit", "Submit homework"],
  [
    "Students list their own, filtered by grade and assignment",
    "/docs/api/list-own",
    "My submissions",
  ],
  [
    "Teachers see everything handed in, filtered by assignment, dates and student",
    "/docs/api/list-overview",
    "Submissions overview",
  ],
  [
    "Teachers grade with A to F and comments",
    "/docs/api/grade",
    "Grade a submission",
  ],
  [
    "Each homework carries assignment, student, dates, grade and teacher notes",
    "/docs/api/get",
    "Read one submission",
  ],
  [
    "Tests for the business logic",
    "/docs/architecture/testing",
    "How it is tested",
  ],
] as const;

const DECISIONS = [
  [
    "Schools are the tenant",
    "Every query is scoped by school; another school's records answer 404.",
  ],
  [
    "Grading scales are data",
    "Letters, plus/minus or pass/fail, snapshotted when graded so edits never relabel past work.",
  ],
  [
    "Nothing is hard-deleted",
    "Soft deletes with who and why, and an audit log of ids only.",
  ],
  [
    "Race-safe submits",
    "Two parallel submits give one 201 and one 409, proven by a race test.",
  ],
  [
    "Two layers of validation",
    "Zod for shape, validate functions for meaning; 422 lists every problem.",
  ],
  [
    "Docs that cannot drift",
    "Zod schemas feed the validation and the field tables, and every example is a test.",
  ],
] as const;

export const dynamic = "force-dynamic";

export default function Home() {
  const sandbox = sandboxEnabled();
  return (
    <LanguageProvider>
      <div className="flex min-h-dvh flex-col font-(family-name:--font-app) text-[12.5px] leading-normal">
        <SiteHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-16 sm:px-8">
          <p className="text-muted-foreground mb-4 text-[11px] tracking-wider uppercase">
            A take-home for Stride
          </p>
          <h1 className="font-display font-semibold max-w-3xl text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Homework in. Grades out.
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl font-sans text-lg leading-7">
            A multi-school REST API where students submit work and teachers
            grade it, with docs whose examples run and a sandbox to try every
            route.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/docs/getting-started"
              className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-bold"
            >
              Get started
            </Link>
            {sandbox ? (
              <Link
                href="/sandbox/console"
                className="hover:border-ring rounded-md border px-4 py-2 font-bold"
              >
                Open the sandbox
              </Link>
            ) : null}
            <Link
              href="/docs/api"
              className="hover:border-ring rounded-md border px-4 py-2 font-bold"
            >
              API reference
            </Link>
            <a
              href={`${GITHUB_URL}#run-it-locally`}
              className="hover:border-ring rounded-md border px-4 py-2 font-bold"
            >
              Repo and setup
            </a>
          </div>

          <PersonalNote />

          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">
            {[
              [ROUTE_DOCS.length, "routes"],
              [EXAMPLES.length, "tested examples"],
              [3, "languages: curl, Python, Node"],
              [3, "roles: student, teacher, administrator"],
            ].map(([value, label]) => (
              <div key={label} className="bg-card px-4 py-3">
                <dt className="font-display font-semibold text-3xl">{value}</dt>
                <dd className="text-muted-foreground mt-0.5">{label}</dd>
              </div>
            ))}
          </dl>

          <section className="mt-20">
            <h2 className="font-display font-semibold text-3xl">Three calls</h2>
            <p className="text-muted-foreground mt-2 font-sans text-base">
              Every request here is a real one, run against a seeded school.
            </p>
            <ol className="mt-6 space-y-8">
              {STEPS.map((step, index) => (
                <li key={step.route}>
                  <p className="flex items-baseline gap-3">
                    <span className="text-muted-foreground">0{index + 1}</span>
                    <span className="font-bold">{step.heading}</span>
                    <span className="text-muted-foreground font-sans text-[14px]">
                      {step.body}
                    </span>
                  </p>
                  <ExampleFor route={step.route} title={step.title} />
                </li>
              ))}
            </ol>
          </section>

          <section className="mt-20">
            <h2 className="font-display font-semibold text-3xl">
              The brief, mapped
            </h2>
            <p className="text-muted-foreground mt-2 font-sans text-base">
              Each requirement from the assignment and where it lives.
            </p>
            <ul className="mt-6 divide-y rounded-xl border">
              {BRIEF.map(([requirement, href, label]) => (
                <li
                  key={href}
                  className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 py-3"
                >
                  <span className="font-sans text-[14.5px]">{requirement}</span>
                  <Link
                    href={href}
                    className="font-bold underline underline-offset-4"
                  >
                    {label} →
                  </Link>
                </li>
              ))}
            </ul>
            {sandbox ? (
              <p className="text-muted-foreground mt-3">
                The sandbox walks each of these through the real routes on its{" "}
                <Link
                  href="/sandbox/checks"
                  className="text-foreground underline underline-offset-4"
                >
                  brief checks
                </Link>
                .
              </p>
            ) : null}
          </section>

          <section className="mt-20">
            <h2 className="font-display font-semibold text-3xl">
              Decisions worth a look
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DECISIONS.map(([title, body]) => (
                <Link
                  key={title}
                  href="/docs/architecture/decisions"
                  className="bg-card hover:border-ring rounded-xl border p-4"
                >
                  <span className="font-bold">{title}</span>
                  <span className="text-muted-foreground mt-1.5 block font-sans text-[14px] leading-6">
                    {body}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        </main>
        <footer className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 border-t px-5 py-6 sm:px-8">
          <a href={GITHUB_URL} className="hover:text-foreground">
            Source on GitHub
          </a>
          <a
            href={`${GITHUB_URL}#run-it-locally`}
            className="hover:text-foreground"
          >
            Run it locally
          </a>
          <Link
            href="/docs/architecture/deferred"
            className="hover:text-foreground"
          >
            What is deferred
          </Link>
          <Link
            href="/docs/architecture/overview"
            className="hover:text-foreground"
          >
            Codebase layout
          </Link>
        </footer>
      </div>
    </LanguageProvider>
  );
}
