const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/postgres";

function databaseEnv(database: string) {
  return {
    adminUrl,
    database,
    appUrl: `postgresql://app_user:app_user@localhost:5433/${database}`,
    owner_url: `postgresql://app_owner:app_owner@localhost:5433/${database}`,
  } as const;
}

export type DatabaseEnv = ReturnType<typeof databaseEnv>;

export const testEnv = databaseEnv("homework_test");
export const raceEnv = databaseEnv("homework_race");
