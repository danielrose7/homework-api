import { ROUTE_DOCS } from "@/app/docs/_lib/registry";
import type { RouteDoc, RouteGroup } from "@/lib/server/route-doc";

export interface DocPageMeta {
  /** Path under `/docs`, and the name of the Markdown file in `_content`. */
  slug: string;
  title: string;
  description: string;
}

export interface NavSection {
  title: string;
  pages: readonly DocPageMeta[];
}

export const CONTENT_SECTIONS: readonly NavSection[] = [
  {
    title: "Start",
    pages: [
      {
        slug: "introduction",
        title: "Introduction",
        description: "What the Homework API does and who it is for.",
      },
      {
        slug: "getting-started",
        title: "Getting started",
        description: "Sign in, submit and grade in three calls.",
      },
      {
        slug: "sandbox-school",
        title: "The Sandbox school",
        description: "The seeded school every example runs against.",
      },
    ],
  },
  {
    title: "Guides",
    pages: [
      {
        slug: "guides/submit-homework",
        title: "Submit homework",
        description: "Hand in text and files, and handle what can go wrong.",
      },
      {
        slug: "guides/grade-submissions",
        title: "Grade submissions",
        description: "Find work waiting, grade it, and regrade with a reason.",
      },
      {
        slug: "run-the-examples",
        title: "Run the examples",
        description: "The variables the curl, Python and Node snippets read.",
      },
    ],
  },
  {
    title: "Concepts",
    pages: [
      {
        slug: "authentication",
        title: "Authentication",
        description: "Bearer tokens, schools in the path, and who sees what.",
      },
      {
        slug: "schools-and-roles",
        title: "Schools and roles",
        description: "Tenancy, the three roles, and grading scales as data.",
      },
      {
        slug: "data-formats",
        title: "Data formats",
        description: "Field names, timestamps and time zones.",
      },
      {
        slug: "pagination",
        title: "Pagination",
        description: "List objects, limits and starting_after.",
      },
      {
        slug: "errors",
        title: "Errors",
        description:
          "One error shape, stable codes and what each status means.",
      },
    ],
  },
];

export const ARCHITECTURE_SECTION: NavSection = {
  title: "Under the hood",
  pages: [
    {
      slug: "architecture/overview",
      title: "Codebase layout",
      description: "Where things live and how a request flows through them.",
    },
    {
      slug: "architecture/decisions",
      title: "Key decisions",
      description: "The choices worth discussing, and why they were made.",
    },
    {
      slug: "architecture/testing",
      title: "Testing",
      description: "Rolled-back transactions, factories and tested examples.",
    },
    {
      slug: "architecture/deferred",
      title: "What is deferred",
      description: "What the brief did not need and the plan leaves for later.",
    },
  ],
};

/** The Markdown file name behind a page: its slug without the folder. */
export function contentFile(slug: string): string {
  return slug.replace(/^(guides|architecture)\//, "");
}

export const API_GROUPS: readonly RouteGroup[] = [
  "Auth",
  "Student",
  "Teacher",
  "Shared",
];

export const apiHref = (doc: Pick<RouteDoc, "id">) =>
  `/docs/api/${doc.id.replaceAll("_", "-")}`;

export const routeForApiSlug = (slug: string): RouteDoc | undefined =>
  ROUTE_DOCS.find((doc) => doc.id.replaceAll("_", "-") === slug);

export interface DocLink {
  href: string;
  title: string;
  section: string;
}

/** Every page in reading order, for previous and next links. */
export function readingOrder(): DocLink[] {
  const content = (section: NavSection): DocLink[] =>
    section.pages.map((page) => ({
      href: `/docs/${page.slug}`,
      title: page.title,
      section: section.title,
    }));
  return [
    ...CONTENT_SECTIONS.flatMap(content),
    { href: "/docs/api", title: "API overview", section: "API reference" },
    ...API_GROUPS.flatMap((group) =>
      ROUTE_DOCS.filter((doc) => doc.group === group).map((doc) => ({
        href: apiHref(doc),
        title: doc.title,
        section: "API reference",
      })),
    ),
    ...content(ARCHITECTURE_SECTION),
  ];
}

export interface TreeItem {
  href: string;
  label: string;
  method?: RouteDoc["method"];
}

export interface TreeSection {
  title: string;
  items: TreeItem[];
}

/** The sidebar, as plain data so the client component that highlights the current page stays small. */
export function treeSections(): TreeSection[] {
  const content = (section: NavSection): TreeSection => ({
    title: section.title,
    items: section.pages.map((page) => ({
      href: `/docs/${page.slug}`,
      label: page.title,
    })),
  });
  return [
    ...CONTENT_SECTIONS.map(content),
    {
      title: "API reference",
      items: [
        { href: "/docs/api", label: "Overview" },
        ...API_GROUPS.flatMap((group) =>
          ROUTE_DOCS.filter((doc) => doc.group === group).map((doc) => ({
            href: apiHref(doc),
            label: doc.title,
            method: doc.method,
          })),
        ),
      ],
    },
    content(ARCHITECTURE_SECTION),
  ];
}
