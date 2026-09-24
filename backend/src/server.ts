import "dotenv/config";
import app from "./app.js";
import { prisma } from "./config/db.js";
import { getActivityEventsCollection } from "./config/mongo.js";
import { env } from "./config/env.js";

import { hashPassword } from "./utils/password.js";

const PORT = env.PORT || 5000;

async function ensureDefaultDemoTenant() {
  try {
    const demoTenantName = "Apex Technical Institute";
    let tenant = await prisma.tenant.findFirst({
      where: { name: demoTenantName },
    });
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: demoTenantName,
          status: "ACTIVE",
        },
      });
      console.log(`Created default demo tenant with ID: ${tenant.id}`);
    }

    const demoAdminEmail = "admin@apex.edu";
    const existingUser = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: demoAdminEmail },
    });
    if (!existingUser) {
      const passwordHash = await hashPassword("Password123!");
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: "Campus Admin",
          email: demoAdminEmail,
          passwordHash,
          role: "ADMIN",
        },
      });
      console.log(`Created default demo admin: ${demoAdminEmail}`);
    }

    const demoEvaluatorEmail = "evaluator@apex.edu";
    const existingEval = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: demoEvaluatorEmail },
    });
    if (!existingEval) {
      const passwordHash = await hashPassword("Password123!");
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: "Lead Evaluator",
          email: demoEvaluatorEmail,
          passwordHash,
          role: "EVALUATOR",
        },
      });
      console.log(`Created default demo evaluator: ${demoEvaluatorEmail}`);
    }
  } catch (err: any) {
    console.warn("Failed to check/seed default demo tenant:", err?.message);
  }
}

async function ensureDefaultCompetencies() {
  try {
    const count = await prisma.competency.count();
    if (count === 0) {
      console.log("Seeding default competencies...");
      const defaultCompetencies = [
        { key: "frontend", name: "Frontend", weight: 30, required: true },
        { key: "backend", name: "Backend", weight: 30, required: true },
        { key: "databases", name: "Databases", weight: 25, required: true },
        { key: "problem-solving", name: "Problem Solving", weight: 15, required: true },
        { key: "dsa", name: "Data Structures & Algorithms", weight: 20, required: false },
        { key: "system-design", name: "System Design", weight: 20, required: false },
      ];
      for (const comp of defaultCompetencies) {
        await prisma.competency.upsert({
          where: { key: comp.key },
          update: {},
          create: comp,
        });
      }
      console.log("Default competencies seeded successfully");
    }
  } catch (err: any) {
    console.warn("Failed to check/seed competencies:", err?.message);
  }
}

async function startServer() {
  try {
    await prisma.$connect();
    console.log("PostgreSQL connected successfully");
    await ensureDefaultCompetencies();
    await ensureDefaultDemoTenant();

    try {
      await getActivityEventsCollection();
      console.log("MongoDB connected and event indexes verified");
    } catch (mongoErr: any) {
      console.warn("MongoDB connection warning (service will retry on demand):", mongoErr?.message);
    }

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = async () => {
      console.log("Gracefully shutting down...");
      server.close(async () => {
        await prisma.$disconnect();
        process.exit(0);
      });
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
}

startServer();