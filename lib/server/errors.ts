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
