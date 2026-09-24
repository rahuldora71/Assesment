import type { Request, Response, NextFunction } from "express";
import { AppError } from "./error.middleware.js";

export function permit(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication required"));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action"
        )
      );
    }

    next();
  };
}
