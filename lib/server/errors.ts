import { STATUS, type StatusCode } from "@/lib/http-status";

export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: StatusCode,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const unauthenticated = () =>
  new ApiError(
    STATUS.unauthorized,
    "unauthenticated",
    "Authentication required",
  );

export const forbidden = () =>
  new ApiError(
    STATUS.forbidden,
    "forbidden",
    "You do not have permission to do this",
  );

export const notFound = () =>
  new ApiError(STATUS.not_found, "not_found", "Not found");

export const conflict = (code: string, message: string) =>
  new ApiError(STATUS.conflict, code, message);

export const preconditionFailed = () =>
  new ApiError(
    STATUS.precondition_failed,
    "precondition_failed",
    "This grade changed since you loaded it",
  );

export const preconditionRequired = () =>
  new ApiError(
    STATUS.precondition_required,
    "precondition_required",
    "Send the grade version you last saw in If-Match",
  );

export const validationFailed = (details: ErrorDetail[]) =>
  new ApiError(
    STATUS.unprocessable_content,
    "validation_failed",
    "Request validation failed",
    details,
  );

/** Services name fields as their TypeScript properties; the wire format is snake_case, path segment by segment. */
export function wireField(field: string): string {
  return field
    .split(".")
    .map((segment) =>
      segment.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase(),
    )
    .join(".");
}

export function errorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details.length > 0
        ? {
            details: error.details.map((detail) => ({
              ...detail,
              field: wireField(detail.field),
            })),
          }
        : {}),
    },
  };
}
