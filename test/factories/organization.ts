import { Factory } from "fishery";

import { createDefaultGradingScale } from "@/lib/server/services/grading-scales";

import { factoryDb } from "./runtime";

export interface OrganizationBuild {
  name: string;
  slug: string;
}

export interface OrganizationRecord extends OrganizationBuild {
  id: string;
}

class OrganizationFactory extends Factory<
  OrganizationBuild,
  unknown,
  OrganizationRecord
> {
  sandbox() {
    return this.params({ name: "Sandbox", slug: "sandbox" });
  }
}

export const organizationFactory = OrganizationFactory.define(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const db = factoryDb();
      const row = await db.organization.create({ data: build });
      await createDefaultGradingScale(db, row.id);
      return { ...build, id: row.id };
    });

    return { name: `School ${sequence}`, slug: `school-${sequence}` };
  },
);
