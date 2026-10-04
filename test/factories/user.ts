import { Factory } from "fishery";

import { factoryAuth } from "./runtime";

export interface UserBuild {
  username: string;
  name: string;
  email: string;
  password: string;
}

export interface UserRecord extends UserBuild {
  id: string;
}

export const userFactory = Factory.define<UserBuild, unknown, UserRecord>(
  ({ sequence, onCreate }) => {
    onCreate(async (build) => {
      const { user } = await factoryAuth().api.signUpEmail({ body: build });
      return { ...build, id: user.id };
    });

    return {
      username: `user${sequence}`,
      name: `User ${sequence}`,
      email: `user${sequence}@sandbox.test`,
      password: "password-1234",
    };
  },
);
