import { ConsoleView } from "@/app/sandbox/console/_components/console-view";
import { readCatalog } from "@/app/sandbox/_server/queries/read-catalog";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export default async function ConsolePage({
  searchParams,
}: PageProps<"/sandbox/console">) {
  const { route } = await searchParams;
  return (
    <ConsoleView
      catalog={readCatalog()}
      options={await readSandboxOptions()}
      initialKey={typeof route === "string" ? route : undefined}
    />
  );
}
