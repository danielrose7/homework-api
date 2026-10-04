import type {
  CatalogGroup,
  CatalogItem,
} from "@/app/sandbox/console/_components/catalog";
import { SANDBOX_SCHOOL } from "@/app/sandbox/_server/seed-data";
import { EXAMPLES } from "@/lib/docs/examples";
import { fieldsOf } from "@/lib/docs/fields";
import { ROUTE_DOCS } from "@/lib/docs/registry";
import type { RouteGroup } from "@/lib/docs/types";

const GROUPS: RouteGroup[] = ["Auth", "Student", "Teacher", "Shared"];

/** The console shows JSON; a file download has no useful rendering there. */
const NOT_IN_CONSOLE = new Set(["download_attachment"]);

/** The console's request list, built from the docs registry so the two cannot disagree. */
export function readCatalog(): CatalogGroup[] {
  return GROUPS.map((group) => ({
    group,
    items: ROUTE_DOCS.filter(
      (doc) => doc.group === group && !NOT_IN_CONSOLE.has(doc.id),
    ).map((doc): CatalogItem => {
      const example = EXAMPLES.find(
        (candidate) =>
          candidate.route === doc.id && candidate.body?.kind === "json",
      );
      return {
        key: doc.id,
        name: doc.title,
        method: doc.method,
        path: doc.path.replace("{org_slug}", SANDBOX_SCHOOL.slug),
        note: doc.summary,
        auth: doc.roles === "public" ? "none" : undefined,
        query: doc.query
          ? fieldsOf(doc.query).map((field) => field.name)
          : undefined,
        sample:
          example?.body?.kind === "json" &&
          typeof example.body.value === "object"
            ? example.body.value
            : null,
      };
    }),
  })).filter((group) => group.items.length > 0);
}
