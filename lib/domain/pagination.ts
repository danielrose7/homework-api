import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

/** The paging parameters every list route accepts. */
export const pageQuery = {
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE)
    .describe(`Page size, 1 to ${MAX_PAGE_SIZE}.`),
  starting_after: z
    .uuid()
    .optional()
    .describe(
      "The id of the last item you already have; the page starts after it.",
    ),
};
