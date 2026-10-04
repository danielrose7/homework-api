import { Prisma } from "@/lib/generated/prisma/client";

const SOFT_DELETABLE = new Set([
  "AcademicYear",
  "Term",
  "GradingScale",
  "GradingScaleBand",
  "Class",
  "ClassTeacher",
  "ClassSeat",
  "Assignment",
  "AssignmentSubmission",
  "StorageAttachment",
]);

const APPEND_ONLY = new Set([
  "ActivityLog",
  "SubmissionGradeEvent",
  "StorageBlob",
  "StorageBlobData",
]);

type Where = Record<string, unknown> | undefined;

function live(where: Where): Record<string, unknown> {
  return where ? { AND: [where, { deleted_at: null }] } : { deleted_at: null };
}

/** Prisma types `where` per model while these hooks are generic over models, so the widened filter is asserted here. */
function liveArgs<T extends { where?: unknown }>(args: T): T {
  return { ...args, where: live(args.where as Where) } as T;
}

function liveUniqueArgs<T extends { where?: unknown }>(args: T): T {
  return {
    ...args,
    where: { ...(args.where as Where), deleted_at: null },
  } as T;
}

function refuse(model: string, operation: string, reason: string): never {
  throw new Error(`${operation} is not allowed on ${model}: ${reason}`);
}

/**
 * Top-level reads skip soft-deleted rows. Nested `include`/`select` relations are not filtered by this hook, so
 * services must add `where: { deleted_at: null }` to those explicitly.
 */
export const hideSoftDeleted = Prisma.defineExtension({
  name: "hide-soft-deleted",
  query: {
    $allModels: {
      async findMany({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveArgs(args));
      },
      async findFirst({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveArgs(args));
      },
      async findFirstOrThrow({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveArgs(args));
      },
      async findUnique({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveUniqueArgs(args));
      },
      async findUniqueOrThrow({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveUniqueArgs(args));
      },
      async count({ model, args, query }) {
        if (!SOFT_DELETABLE.has(model)) return query(args);
        return query(liveArgs(args));
      },
      async delete({ model, args, query }) {
        if (SOFT_DELETABLE.has(model)) {
          refuse(model, "delete", "rows are soft-deleted, never removed");
        }
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (SOFT_DELETABLE.has(model)) {
          refuse(model, "deleteMany", "rows are soft-deleted, never removed");
        }
        return query(args);
      },
    },
  },
});

export const appendOnly = Prisma.defineExtension({
  name: "append-only",
  query: {
    $allModels: {
      async update({ model, args, query }) {
        if (APPEND_ONLY.has(model))
          refuse(model, "update", "table is append-only");
        return query(args);
      },
      async updateMany({ model, args, query }) {
        if (APPEND_ONLY.has(model))
          refuse(model, "updateMany", "table is append-only");
        return query(args);
      },
      async upsert({ model, args, query }) {
        if (APPEND_ONLY.has(model))
          refuse(model, "upsert", "table is append-only");
        return query(args);
      },
      async delete({ model, args, query }) {
        if (APPEND_ONLY.has(model))
          refuse(model, "delete", "table is append-only");
        return query(args);
      },
      async deleteMany({ model, args, query }) {
        if (APPEND_ONLY.has(model))
          refuse(model, "deleteMany", "table is append-only");
        return query(args);
      },
    },
  },
});
