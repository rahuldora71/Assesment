import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "./error.middleware.js";

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(
      new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required")
    );
  }

  const token = authorization.substring(7);

  try {
    const payload = verifyAccessToken(token);

    req.user = {
      id: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
    };

    next();
  } catch {
    return next(
      new AppError(401, "INVALID_ACCESS_TOKEN", "Authentication required")
    );
  }
}