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
    readonly denial = false,
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
    [],
    true,
  );

export const notFound = () =>
  new ApiError(STATUS.not_found, "not_found", "Not found");

/** A refused access that answers 404 so the caller cannot tell it from a missing record, but is still logged as a denial. */
export const deniedAsNotFound = () =>
  new ApiError(STATUS.not_found, "not_found", "Not found", [], true);

export const conflict = (code: string, message: string) =>
  new ApiError(STATUS.conflict, code, message);

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

function errorType(status: StatusCode) {
  switch (status) {
    case STATUS.unauthorized:
      return "authentication_error";
    case STATUS.forbidden:
      return "permission_error";
    case STATUS.internal_server_error:
      return "api_error";
    default:
      return "invalid_request_error";
  }
}

export function errorBody(error: ApiError) {
  const details = error.details.map((detail) => ({
    ...detail,
    field: wireField(detail.field),
  }));
  return {
    error: {
      type: errorType(error.status),
      code: error.code,
      message: error.message,
      ...(details[0]?.field ? { param: details[0].field } : {}),
      ...(details.length > 0 ? { details } : {}),
    },
  };
}
