import { Factory } from "fishery";

import type { RoleName } from "@/lib/server/permissions";

import { organizationFactory, type OrganizationRecord } from "./organization";
import { factoryDb } from "./runtime";
import { userFactory, type UserRecord } from "./user";

export interface MemberBuild {
  role: RoleName;
  organizationId?: string;
  userId?: string;
}

export interface MemberRecord {
  id: string;
  role: RoleName;
  organizationId: string;
  userId: string;
  organization: OrganizationRecord;
  user: UserRecord;
}

class MemberFactory extends Factory<MemberBuild, unknown, MemberRecord> {
  administrator() {
    return this.params({ role: "administrator" });
  }

  teacher() {
    return this.params({ role: "teacher" });
  }

  student() {
    return this.params({ role: "student" });
  }
}

export const memberFactory = MemberFactory.define(({ onCreate }) => {
  onCreate(async (build) => {
    const db = factoryDb();
    const user = build.userId
      ? await findUser(build.userId)
      : await userFactory.create();
    const organization = build.organizationId
      ? await findOrganization(build.organizationId)
      : await organizationFactory.create();

    const row = await db.member.create({
      data: {
        role: build.role,
        organizationId: organization.id,
        userId: user.id,
      },
    });
    return {
      id: row.id,
      role: build.role,
      organizationId: organization.id,
      userId: user.id,
      organization,
      user,
    };
  });

  const role: RoleName = "student";
  return { role };
});

async function findUser(id: string): Promise<UserRecord> {
  const row = await factoryDb().user.findUniqueOrThrow({ where: { id } });
  return {
    id: row.id,
    username: row.username ?? "",
    name: row.name,
    email: row.email,
    password: "password-1234",
  };
}

async function findOrganization(id: string): Promise<OrganizationRecord> {
  const row = await factoryDb().organization.findUniqueOrThrow({
    where: { id },
  });
  return { id: row.id, name: row.name, slug: row.slug };
}
