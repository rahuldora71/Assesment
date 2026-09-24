import { prisma } from "../config/db.js";
import {
  comparePassword,
  hashPassword,
} from "../utils/password.js";

import {
  generateAccessToken,
  generateRefreshToken,
} from "../utils/jwt.js";

interface RegisterInput {
  tenantName: string;
  name: string;
  email: string;
  password: string;
}

interface LoginInput {
  tenantId?: string;
  email: string;
  password: string;
}

export async function register(
  input: RegisterInput
) {
  const passwordHash =
    await hashPassword(input.password);

  const result = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          name: input.name,
          email: input.email.toLowerCase(),
          passwordHash,
          role: "ADMIN",
        },
      });

      return {
        tenant,
        user,
      };
    }
  );

  return {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
    role: result.user.role,
    tenantId: result.user.tenantId,
  };
}

export async function login(
  input: LoginInput
) {
  // If tenantId is provided, scope by both tenantId and email;
  // otherwise, find active user by email and derive tenantId from the database record.
  const user = await prisma.user.findFirst({
    where: {
      email: input.email.toLowerCase(),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      tenant: {
        status: "ACTIVE",
      },
    },
    include: {
      tenant: true,
    },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validPassword =
    await comparePassword(
      input.password,
      user.passwordHash
    );

  if (!validPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const accessToken =
    generateAccessToken({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

  const refreshToken =
    generateRefreshToken(
      user.id,
      user.tenantId
    );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    },
    accessToken,
    refreshToken,
  };
}