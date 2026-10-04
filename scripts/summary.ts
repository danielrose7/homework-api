import type { SeedSummary } from "@/modules/demo/mutations/seed-sandbox";

export function printSummary(summary: SeedSummary) {
  console.log(`Seeded school "${summary.slug}" (${summary.organization_id})`);
  console.log(`Shared password: ${summary.password}`);
  for (const person of summary.people) {
    console.log(`  ${person.username.padEnd(10)} ${person.role}`);
  }
  console.log(`${summary.submissions} submissions`);
}
