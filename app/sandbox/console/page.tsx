import { ConsoleView } from "@/app/sandbox/console/_components/console-view";
import { readCatalog } from "@/app/sandbox/_server/queries/read-catalog";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export default async function ConsolePage({
  searchParams,
}: PageProps<"/sandbox/console">) {
  const params = Object.fromEntries(
    Object.entries(await searchParams).flatMap(([name, value]) => {
      const first = Array.isArray(value) ? value[0] : value;
      return first === undefined ? [] : [[name, first]];
    }),
  );
  return (
    <ConsoleView
      catalog={readCatalog()}
      options={await readSandboxOptions()}
      initialParams={params}
    />
  );
}
