export const STATUS = {
  ok: 200,
  created: 201,
  no_content: 204,
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  precondition_failed: 412,
  unprocessable_content: 422,
  precondition_required: 428,
  internal_server_error: 500,
} as const;

export type StatusCode = (typeof STATUS)[keyof typeof STATUS];
