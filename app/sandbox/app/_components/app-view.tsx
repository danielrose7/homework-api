"use client";

import { roleOf } from "@/app/sandbox/_lib/people";
import { useSession } from "@/app/sandbox/_lib/session";
import { StudentView } from "@/app/sandbox/app/_components/student-view";
import { TeacherView } from "@/app/sandbox/app/_components/teacher-view";
import type { DemoOptions } from "@/modules/demo/queries/read-options";

export function AppView({ options }: { options: DemoOptions }) {
  const { active } = useSession();
  const role = roleOf(active);
  if (!role) {
    return <div className="text-muted-foreground p-6">Signing in…</div>;
  }
  // Keyed by persona so filters, selection and drafts reset on a switch.
  return role === "student" ? (
    <StudentView key={active} options={options} />
  ) : (
    <TeacherView key={active} options={options} />
  );
}
