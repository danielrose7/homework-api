export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: ErrorDetail[] = [],
  ) {
    super(message);
  }
}

export const unauthenticated = () =>
  new ApiError(401, "unauthenticated", "Authentication required");

export const forbidden = () =>
  new ApiError(403, "forbidden", "You do not have permission to do this");

export const notFound = () => new ApiError(404, "not_found", "Not found");

export const conflict = (code: string, message: string) =>
  new ApiError(409, code, message);

export const preconditionFailed = () =>
  new ApiError(
    412,
    "precondition_failed",
    "This grade changed since you loaded it",
  );

export const preconditionRequired = () =>
  new ApiError(
    428,
    "precondition_required",
    "Send the grade version you last saw in If-Match",
  );

export const validationFailed = (details: ErrorDetail[]) =>
  new ApiError(422, "validation_failed", "Request validation failed", details);

export function errorBody(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details.length > 0 ? { details: error.details } : {}),
    },
  };
}
