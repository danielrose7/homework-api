import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Workbench } from "@/app/sandbox/_components/workbench";
import { demoModeEnabled } from "@/modules/demo/guard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sandbox · Homework API" };

export default function SandboxLayout({ children }: LayoutProps<"/sandbox">) {
  if (!demoModeEnabled()) notFound();
  return <Workbench>{children}</Workbench>;
}
