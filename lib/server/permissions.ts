import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

export const statements = {
  ...defaultStatements,
  gradingScale: ["create", "read", "update", "delete"],
  class: ["create", "read", "update", "delete"],
  assignment: ["create", "read", "update", "delete"],
  submission: ["create", "read", "readAll", "delete"],
  grade: ["create", "read", "update"],
  activity: ["read"],
} as const;

export const ac = createAccessControl(statements);

export const administrator = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  gradingScale: ["create", "read", "update", "delete"],
  class: ["create", "read", "update", "delete"],
  assignment: ["create", "read", "update", "delete"],
  submission: ["read", "readAll", "delete"],
  grade: ["read", "update"],
  activity: ["read"],
});

export const teacher = ac.newRole({
  gradingScale: ["read"],
  class: ["read", "update"],
  assignment: ["create", "read", "update", "delete"],
  submission: ["read", "readAll"],
  grade: ["create", "read", "update"],
});

export const student = ac.newRole({
  gradingScale: ["read"],
  class: ["read"],
  assignment: ["read"],
  submission: ["create", "read"],
  grade: ["read"],
});

export const roles = { administrator, teacher, student } as const;
export type RoleName = keyof typeof roles;
