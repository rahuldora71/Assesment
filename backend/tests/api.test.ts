import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { closeMongo, getActivityEventsCollection } from "../src/config/mongo.js";

describe("API Endpoints & Integration Tests", () => {
  let tenantAToken: string;
  let tenantAId: string;
  let tenantBToken: string;
  let tenantBId: string;
  let studentAId: string;

  const testSuffix = Date.now().toString().slice(-6);

  beforeAll(async () => {
    // 1. Register Tenant A
    const resA = await request(app)
      .post("/api/auth/register")
      .send({
        tenantName: `Tenant Alpha ${testSuffix}`,
        name: `Admin Alpha ${testSuffix}`,
        email: `alpha_${testSuffix}@example.com`,
        password: "Password123!",
      });

    expect(resA.status).toBe(201);
    tenantAId = resA.body.data.user.tenantId;

    // Login Tenant A
    const loginA = await request(app)
      .post("/api/auth/login")
      .send({
        tenantId: tenantAId,
        email: `alpha_${testSuffix}@example.com`,
        password: "Password123!",
      });
    expect(loginA.status).toBe(200);
    tenantAToken = loginA.body.data.accessToken;

    // 2. Register Tenant B
    const resB = await request(app)
      .post("/api/auth/register")
      .send({
        tenantName: `Tenant Beta ${testSuffix}`,
        name: `Admin Beta ${testSuffix}`,
        email: `beta_${testSuffix}@example.com`,
        password: "Password123!",
      });
    expect(resB.status).toBe(201);
    tenantBId = resB.body.data.user.tenantId;

    // Login Tenant B
    const loginB = await request(app)
      .post("/api/auth/login")
      .send({
        tenantId: tenantBId,
        email: `beta_${testSuffix}@example.com`,
        password: "Password123!",
      });
    expect(loginB.status).toBe(200);
    tenantBToken = loginB.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await closeMongo();
  });

  describe("Health & Authentication", () => {
    it("GET /api/health returns 200 ok", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    });

    it("GET /api/auth/me returns current authenticated user", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.tenantId).toBe(tenantAId);
    });

    it("Rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/students");
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("AUTHENTICATION_REQUIRED");
    });
  });

  describe("Student Lifecycle & Tenant Isolation", () => {
    it("POST /api/students creates a student for Tenant A", async () => {
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          name: "Alice Walker",
          email: `alice_${testSuffix}@example.com`,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.student.name).toBe("Alice Walker");
      expect(res.body.data.student.readinessStatus).toBe("INCOMPLETE");
      expect(res.body.data.student.version).toBe(1);
      studentAId = res.body.data.student.id;
    });

    it("POST /api/students rejects duplicate email in same tenant with 409", async () => {
      const res = await request(app)
        .post("/api/students")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          name: "Alice Duplicate",
          email: `alice_${testSuffix}@example.com`,
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("STUDENT_EMAIL_EXISTS");
    });

    it("GET /api/students lists students with pagination and tenant scoping", async () => {
      const res = await request(app)
        .get("/api/students")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.some((s: any) => s.id === studentAId)).toBe(true);
      expect(res.body.data.pagination.page).toBe(1);
    });

    it("GET /api/students/:id returns student details with competencies", async () => {
      const res = await request(app)
        .get(`/api/students/${studentAId}`)
        .set("Authorization", `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.student.id).toBe(studentAId);
      expect(res.body.data.student.readinessStatus).toBe("INCOMPLETE");
      expect(res.body.data.student.competencies.length).toBeGreaterThanOrEqual(4);
    });

    it("Cross-Tenant: Tenant B cannot access Tenant A student (returns 404 non-disclosing)", async () => {
      const res = await request(app)
        .get(`/api/students/${studentAId}`)
        .set("Authorization", `Bearer ${tenantBToken}`);

      expect(res.status).toBe(404);
      expect(res.body.code).toBe("STUDENT_NOT_FOUND");
    });
  });

  describe("Optimistic Concurrency & Version Updates", () => {
    it("PATCH /api/students/:id updates allowlisted fields with matching version", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentAId}`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          name: "Alice W. Updated",
          version: 1,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.student.name).toBe("Alice W. Updated");
      expect(res.body.data.student.version).toBe(2);
    });

    it("PATCH /api/students/:id rejects stale version with 409 STALE_VERSION", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentAId}`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          name: "Alice Stale",
          version: 1, // Stale! Current version is 2
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("STALE_VERSION");
      expect(res.body.currentVersion).toBe(2);
    });

    it("Cross-Tenant: Tenant B cannot update Tenant A student (returns 404)", async () => {
      const res = await request(app)
        .patch(`/api/students/${studentAId}`)
        .set("Authorization", `Bearer ${tenantBToken}`)
        .send({
          name: "Hacked by Tenant B",
          version: 2,
        });

      expect(res.status).toBe(404);
    });
  });

  describe("Attempt Creation, Atomic Readiness & Idempotency", () => {
    const idempKey1 = `key-attempt-1-${testSuffix}`;

    it("POST /api/students/:id/attempts requires Idempotency-Key header", async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({
          competency: "frontend",
          score: 85,
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("POST /api/students/:id/attempts creates attempt and updates student readiness", async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", idempKey1)
        .send({
          competency: "frontend",
          score: 85,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.attempt.score).toBe(85);
      expect(res.body.data.student.readinessStatus).toBe("INCOMPLETE"); // other 3 missing
      expect(res.headers["x-idempotency-replayed"]).toBe("false");
    });

    it("Idempotent retry: Re-sending identical request replays original response without duplicate", async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", idempKey1)
        .send({
          competency: "frontend",
          score: 85,
        });

      expect(res.status).toBe(201);
      expect(res.headers["x-idempotency-replayed"]).toBe("true");

      // Verify no duplicate attempt created in DB
      const count = await prisma.attempt.count({
        where: {
          studentId: studentAId,
          competency: { key: "frontend" },
        },
      });
      expect(count).toBe(1);
    });

    it("Idempotent conflict: Reusing key with different score returns 409", async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", idempKey1)
        .send({
          competency: "frontend",
          score: 99, // Different score!
        });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe("IDEMPOTENCY_CONFLICT");
    });

    it("Submitting all competencies transitions readiness to READY with weighted score", async () => {
      // Backend: 90 (30%)
      await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", `key-be-${testSuffix}`)
        .send({ competency: "backend", score: 90 });

      // Databases: 80 (25%)
      await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", `key-db-${testSuffix}`)
        .send({ competency: "databases", score: 80 });

      // Problem Solving: 85 (15%)
      const finalRes = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", `key-ps-${testSuffix}`)
        .send({ competency: "problem-solving", score: 85 });

      expect(finalRes.status).toBe(201);
      // Expected weighted score: (85*0.30 + 90*0.30 + 80*0.25 + 85*0.15) = 25.5 + 27 + 20 + 12.75 = 85.25
      expect(finalRes.body.data.student.currentScore).toBe(85.25);
      expect(finalRes.body.data.student.readinessStatus).toBe("READY");
    });

    it("Validation error: Score outside [0, 100] is rejected", async () => {
      const res = await request(app)
        .post(`/api/students/${studentAId}/attempts`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .set("Idempotency-Key", `key-inv-${testSuffix}`)
        .send({ competency: "frontend", score: 150 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("MongoDB Activity Events & Aggregation", () => {
    it("GET /api/students/:id/activity returns recorded operational events", async () => {
      const res = await request(app)
        .get(`/api/students/${studentAId}/activity`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .query({ page: 1, limit: 10 });

      expect(res.status).toBe(200);
      expect(res.body.data.items).toBeInstanceOf(Array);
      expect(res.body.data.items.length).toBeGreaterThan(0);
      expect(res.body.data.items[0]).toHaveProperty("eventType");
      expect(res.body.data.items[0].tenantId).toBe(tenantAId);
    });

    it("GET /api/students/activity/aggregation returns 24h tenant metrics", async () => {
      const res = await request(app)
        .get("/api/students/activity/aggregation")
        .set("Authorization", `Bearer ${tenantAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      if (res.body.data.length > 0) {
        const tenantMetrics = res.body.data[0];
        expect(tenantMetrics).toHaveProperty("uniqueSuccessfulAssessments");
        expect(tenantMetrics).toHaveProperty("rejectionRatePercent");
      }
    });
  });
});
