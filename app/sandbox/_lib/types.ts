export interface Grade {
  label: string;
  group: string | null;
  points_awarded: string | null;
  max_points: string | null;
  percent: string | null;
  scale_id: string;
}

export interface Submission {
  id: string;
  object: "submission";
  assignment: { id: string; title: string };
  student: { member_id: string; name: string; username: string };
  attempt_number: number;
  text: string | null;
  submitted_at: string;
  graded_at: string | null;
  teacher_notes: string | null;
  grade: Grade | null;
}

export interface ListResponse<T> {
  object: "list";
  url: string;
  has_more: boolean;
  data: T[];
}

export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

export interface ErrorBody {
  error: {
    type: string;
    code: string;
    message: string;
    param?: string;
    details?: ErrorDetail[];
  };
}

export const isErrorBody = (value: unknown): value is ErrorBody =>
  typeof value === "object" && value !== null && "error" in value;
