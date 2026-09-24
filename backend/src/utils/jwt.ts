import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  role: string;
}

export interface RefreshTokenPayload {
  sub: string;
  tenantId: string;
  type: "refresh";
}

export function generateAccessToken(payload: AccessTokenPayload) {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
  });
}

export function generateRefreshToken(userId: string, tenantId: string) {
  return jwt.sign(
    {
      sub: userId,
      tenantId,
      type: "refresh",
    },
    env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: "7d",
    }
  );
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string) {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
}