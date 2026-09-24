import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { closeMongo, getActivityEventsCollection } from "../src/config/mongo.js";

describe("Concurrency, Resilience, and Defect Verification Tests", () => {
  let tenant1Token: string;
  let tenant1Id: string;
  let tenant2Token: string;
  let tenant2Id: string;
  let student1Id: string;
  let student2Id: string;

  const suffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    // Setup Tenant 1
    const reg1 = await request(app).post("/api/auth/register").send({
      tenantName: `Concurrency Tenant 1 ${suffix}`,
      name: "User One",
      email: `user1_${suffix}@test.com`,
      password: "Password123!",
    });
    tenant1Id = reg1.body.data.user.tenantId;

    const login1 = await request(app).post("/api/auth/login").send({
      tenantId: tenant1Id,
      email: `user1_${suffix}@test.com`,
      password: "Password123!",
    });
    tenant1Token = login1.body.data.accessToken;

    const s1 = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${tenant1Token}`)
      .send({
        name: "Student Alpha",
        email: `student1_${suffix}@test.com`,
      });
    student1Id = s1.body.data.student.id;

    // Setup Tenant 2
    const reg2 = await request(app).post("/api/auth/register").send({
      tenantName: `Concurrency Tenant 2 ${suffix}`,
      name: "User Two",
      email: `user2_${suffix}@test.com`,
      password: "Password123!",
    });
    tenant2Id = reg2.body.data.user.tenantId;

    const login2 = await request(app).post("/api/auth/login").send({
      tenantId: tenant2Id,
      email: `user2_${suffix}@test.com`,
      password: "Password123!",
    });
    tenant2Token = login2.body.data.accessToken;

    const s2 = await request(app)
      .post("/api/students")
      .set("Authorization", `Bearer ${tenant2Token}`)
      .send({
        name: "Student Beta",
        email: `student2_${suffix}@test.com`,
      });
    student2Id = s2.body.data.student.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeMongo();
  });

  describe("Parallel Concurrent Idempotent Requests", () => {
    it("two parallel requests with same idempotency key create exactly one database attempt", async () => {
      const parallelKey = `parallel-key-${suffix}`;

      // Launch 2 parallel requests simultaneously
      const [req1, req2] = await Promise.all([
        request(app)
          .post(`/api/students/${student1Id}/attempts`)
          .set("Authorization", `Bearer ${tenant1Token}`)
          .set("Idempotency-Key", parallelKey)
          .send({ competency: "frontend", score: 88 }),
        request(app)
          .post(`/api/students/${student1Id}/attempts`)
          .set("Authorization", `Bearer ${tenant1Token}`)
          .set("Idempotency-Key", parallelKey)
          .send({ competency: "frontend", score: 88 }),
      ]);

      // Both should succeed (one creates, other replays)
      expect([200, 201]).toContain(req1.status);
      expect([200, 201]).toContain(req2.status);

      // Verify that in the database, only ONE attempt was created
      const attemptsCount = await prisma.attempt.count({
        where: {
          studentId: student1Id,
          score: 88,
        },
      });

      expect(attemptsCount).toBe(1);
    });
  });

  describe("Database Rollback on Failure Injection", () => {
    it("rolls back attempt creation and leaves student score/version unchanged on invalid input", async () => {
      const initialStudent = await prisma.student.findUniqueOrThrow({
        where: { id: student1Id },
      });

      const res = await request(app)
        .post(`/api/students/${student1Id}/attempts`)
        .set("Authorization", `Bearer ${tenant1Token}`)
        .set("Idempotency-Key", `fail-key-${suffix}`)
        .send({
          competency: "non-existent-competency-xyz",
          score: 75,
        });

      expect(res.status).toBe(400);

      // Verify student was NOT updated
      const studentAfter = await prisma.student.findUniqueOrThrow({
        where: { id: student1Id },
      });

      expect(studentAfter.version).toBe(initialStudent.version);
      expect(studentAfter.currentScore).toBe(initialStudent.currentScore);
    });
  });

  describe("Seeded Defect Fix: Fast Account Switch & Trust Boundary Verification", () => {
    it("rapid login switch between tenants strictly isolates student listings and rejects spoofed headers", async () => {
      // 1. Query Tenant 1
      const res1 = await request(app)
        .get("/api/students")
        .set("Authorization", `Bearer ${tenant1Token}`);
      expect(res1.body.data.items.some((s: any) => s.id === student1Id)).toBe(true);
      expect(res1.body.data.items.some((s: any) => s.id === student2Id)).toBe(false);

      // 2. Immediate switch to Tenant 2
      const res2 = await request(app)
        .get("/api/students")
        .set("Authorization", `Bearer ${tenant2Token}`);
      expect(res2.body.data.items.some((s: any) => s.id === student2Id)).toBe(true);
      expect(res2.body.data.items.some((s: any) => s.id === student1Id)).toBe(false);

      // 3. Attempt to spoof tenant ID in query/header
      const spoofRes = await request(app)
        .get(`/api/students?tenantId=${tenant1Id}`)
        .set("x-tenant-id", tenant1Id)
        .set("Authorization", `Bearer ${tenant2Token}`);

      // Still only sees Tenant 2 data!
      expect(spoofRes.body.data.items.some((s: any) => s.id === student2Id)).toBe(true);
      expect(spoofRes.body.data.items.some((s: any) => s.id === student1Id)).toBe(false);
    });
  });
});
