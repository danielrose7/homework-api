import { resolveContext, type RequestContext } from "@/lib/server/context";

import { memberFactory, type MemberRecord } from "../factories/member";
import {
  organizationFactory,
  type OrganizationRecord,
} from "../factories/organization";
import { factoryAuth, factoryDb } from "../factories/runtime";

export interface Persona {
  member: MemberRecord;
  headers: Headers;
  context: () => Promise<RequestContext>;
}

export interface BaselineSchool {
  organization: OrganizationRecord;
  admin: Persona;
  teachers: Persona[];
  students: Persona[];
}

export interface BaselineOptions {
  teachers?: number;
  students?: number;
  organization?: Partial<OrganizationRecord>;
}

async function persona(member: MemberRecord): Promise<Persona> {
  const auth = factoryAuth();
  const signIn = await auth.api.signInUsername({
    body: { username: member.user.username, password: member.user.password },
    returnHeaders: true,
  });
  const token = signIn.headers.get("set-auth-token");
  if (!token) throw new Error("sign-in returned no bearer token");
  const headers = new Headers({ authorization: `Bearer ${token}` });

  return {
    member,
    headers,
    context: () =>
      resolveContext({
        auth,
        db: factoryDb(),
        headers,
        organizationSlug: member.organization.slug,
      }),
  };
}

export async function baselineSchool(
  options: BaselineOptions = {},
): Promise<BaselineSchool> {
  const organization = await organizationFactory.create(options.organization);
  const inSchool = { organizationId: organization.id };

  const admin = await persona(
    await memberFactory.administrator().create(inSchool),
  );
  const teachers: Persona[] = [];
  for (let i = 0; i < (options.teachers ?? 2); i++) {
    teachers.push(
      await persona(await memberFactory.teacher().create(inSchool)),
    );
  }
  const students: Persona[] = [];
  for (let i = 0; i < (options.students ?? 3); i++) {
    students.push(
      await persona(await memberFactory.student().create(inSchool)),
    );
  }

  return { organization, admin, teachers, students };
}

export async function baselineTwoSchools() {
  const school = await baselineSchool();
  const other = await baselineSchool();
  return { school, other };
}
