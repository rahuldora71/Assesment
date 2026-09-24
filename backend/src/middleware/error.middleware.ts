import type { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(req: Request, res: Response, next: NextFunction) {
  next(new AppError(404, "NOT_FOUND", "Resource not found"));
}

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requestId = req.requestId || (req.headers["x-request-id"] as string) || "unknown";

  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "An internal server error occurred";
  let fieldErrors: Record<string, any> | undefined = undefined;

  if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed";
    fieldErrors = err.flatten().fieldErrors;
  } else if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    fieldErrors = err.fieldErrors;
  } else if (err?.code === "P2002") {
    status = 409;
    code = "CONFLICT";
    message = "A unique constraint was violated";
  } else if (err?.code === "P2025") {
    status = 404;
    code = "NOT_FOUND";
    message = "Resource not found";
  } else if (typeof err?.status === "number") {
    status = err.status;
    code = err.code || "REQUEST_FAILED";
    message = err.message || message;
  }

  // Safe logging without leaking sensitive tokens or credentials
  if (status >= 500) {
    console.error(`[Error] req=${requestId} ${err?.message || err}`);
  }

  return res.status(status).json({
    success: false,
    code,
    message,
    requestId,
    ...(fieldErrors ? { fieldErrors, fields: fieldErrors } : {}),
    error: {
      code,
      message,
      requestId,
      ...(fieldErrors ? { fields: fieldErrors, fieldErrors } : {}),
    },
  });
};
