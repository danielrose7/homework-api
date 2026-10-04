export function listJson<T>(url: string, data: T[], has_more = false) {
  return { object: "list" as const, url, has_more: has_more, data };
}
