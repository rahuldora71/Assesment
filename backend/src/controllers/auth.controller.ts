import type { Response } from "express";
import type { Request } from "express";

import { prisma } from "../config/db.js";

import {
  generateAccessToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

import * as authService from "../services/auth.service.js";

const isProd = process.env.NODE_ENV === "production";

const refreshCookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: (isProd ? "none" : "lax") as "none" | "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export async function register(
  req: Request,
  res: Response
) {
  try {
    const user =
      await authService.register(req.body);

    return res.status(201).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(400).json({
      success: false,
      error: {
        code: "REGISTRATION_FAILED",
        message: "Registration failed",
      },
    });
  }
}

export async function login(
  req: Request,
  res: Response
) {
  try {
    const result =
      await authService.login(req.body);

    res.cookie(
      "refreshToken",
      result.refreshToken,
      refreshCookieOptions
    );

    return res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      },
    });
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid login credentials",
      },
    });
  }
}

export async function refresh(
  req: Request,
  res: Response
) {
  const refreshToken =
    req.cookies?.refreshToken ||
    req.body?.refreshToken ||
    (req.headers["x-refresh-token"] as string);

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      error: {
        code: "REFRESH_TOKEN_MISSING",
        message: "Authentication required",
      },
    });
  }

  try {
    const payload =
      verifyRefreshToken(refreshToken);

    if (payload.type !== "refresh") {
      throw new Error("Invalid token type");
    }

    const user =
      await prisma.user.findFirst({
        where: {
          id: payload.sub,
          tenantId: payload.tenantId,
        },
        include: {
          tenant: true,
        },
      });

    if (
      !user ||
      user.tenant.status !== "ACTIVE"
    ) {
      throw new Error("Invalid user");
    }

    const accessToken =
      generateAccessToken({
        sub: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });

    return res.status(200).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
      },
    });
  } catch {
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_REFRESH_TOKEN",
        message: "Authentication required",
      },
    });
  }
}

export async function logout(
  req: Request,
  res: Response
) {
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/api/auth",
  });

  return res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
}

export async function me(
  req: Request,
  res: Response
) {
  const userId = req.user!.id;
  const tenantId = req.user!.tenantId;

  const user =
    await prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
      },
    });

  if (!user) {
    return res.status(401).json({
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "Authentication required",
      },
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      user,
    },
  });
}