export function listJson<T>(url: string, data: T[], hasMore = false) {
  return { object: "list" as const, url, has_more: hasMore, data };
}
