export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "QUOTA_EXCEEDED"
  | "CONFIG_MISSING"
  | "UPSTREAM_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export const jsonOk = <T>(data: T, init?: ResponseInit) =>
  Response.json({ ok: true, ...data }, init);

export const jsonError = (error: unknown) => {
  if (error instanceof ApiError) {
    return Response.json(
      { ok: false, code: error.code, error: error.message },
      { status: error.status },
    );
  }

  console.error(error);
  return Response.json(
    { ok: false, code: "UPSTREAM_ERROR", error: "服务暂时不可用，请稍后再试。" },
    { status: 500 },
  );
};
