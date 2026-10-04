import { Factory } from "fishery";

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
      const row = await factoryDb().organization.create({ data: build });
      return { ...build, id: row.id };
    });

    return { name: `School ${sequence}`, slug: `school-${sequence}` };
  },
);
