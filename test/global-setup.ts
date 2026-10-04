import { testEnv } from "./env";
import { prepareDatabase } from "./prepare-database";

export default async function setup() {
  await prepareDatabase(testEnv);
}
