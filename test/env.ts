const adminUrl =
  process.env.ADMIN_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5433/postgres";

export const testEnv = {
  adminUrl,
  database: "homework_test",
  appUrl: "postgresql://app_user:app_user@localhost:5433/homework_test",
  ownerUrl: "postgresql://app_owner:app_owner@localhost:5433/homework_test",
} as const;
