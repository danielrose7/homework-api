import { AppView } from "@/app/sandbox/app/_components/app-view";
import { readDemoOptions } from "@/modules/demo/queries/read-options";

export default async function AppPage() {
  return <AppView options={await readDemoOptions()} />;
}
