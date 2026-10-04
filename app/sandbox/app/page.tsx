import { AppView } from "@/app/sandbox/app/_components/app-view";
import { readSandboxOptions } from "@/app/sandbox/_server/queries/read-options";

export default async function AppPage() {
  return <AppView options={await readSandboxOptions()} />;
}
