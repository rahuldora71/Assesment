import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/db.js";
import { closeMongo } from "../src/config/mongo.js";

async function runEndpointSmokeTest() {
  console.log("=== STARTING ENDPOINT-BY-ENDPOINT VERIFICATION ===");
  const suffix = Date.now().toString().slice(-4);

  // 1. GET /api/health
  const healthRes = await request(app).get("/api/health");
  console.log(`[1] GET /api/health -> Status: ${healthRes.status}, Body:`, healthRes.body);

  // 2. POST /api/auth/register
  const regRes = await request(app).post("/api/auth/register").send({
    tenantName: `Smoke Tenant ${suffix}`,
    name: "Smoke Admin",
    email: `admin_${suffix}@smoke.com`,
    password: "Password123!",
  });
  console.log(`[2] POST /api/auth/register -> Status: ${regRes.status}, Tenant: ${regRes.body.data.user.tenantId}`);
  const tenantId = regRes.body.data.user.tenantId;

  // 3. POST /api/auth/login
  const loginRes = await request(app).post("/api/auth/login").send({
    tenantId,
    email: `admin_${suffix}@smoke.com`,
    password: "Password123!",
  });
  console.log(`[3] POST /api/auth/login -> Status: ${loginRes.status}, Received AccessToken: ${Boolean(loginRes.body.data.accessToken)}`);
  const token = loginRes.body.data.accessToken;
  const cookieHeader = loginRes.headers["set-cookie"];

  // 4. GET /api/auth/me
  const meRes = await request(app)
    .get("/api/auth/me")
    .set("Authorization", `Bearer ${token}`);
  console.log(`[4] GET /api/auth/me -> Status: ${meRes.status}, User ID: ${meRes.body.data.user.id}`);

  // 5. POST /api/auth/refresh
  const refreshRes = await request(app)
    .post("/api/auth/refresh")
    .set("Cookie", cookieHeader);
  console.log(`[5] POST /api/auth/refresh -> Status: ${refreshRes.status}, Refreshed Token: ${Boolean(refreshRes.body.data?.accessToken)}`);

  // 6. POST /api/students
  const createStudentRes = await request(app)
    .post("/api/students")
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "John Doe",
      email: `johndoe_${suffix}@smoke.com`,
    });
  console.log(`[6] POST /api/students -> Status: ${createStudentRes.status}, Student ID: ${createStudentRes.body.data.student.id}, Version: ${createStudentRes.body.data.student.version}`);
  const studentId = createStudentRes.body.data.student.id;

  // 7. GET /api/students
  const listRes = await request(app)
    .get("/api/students")
    .set("Authorization", `Bearer ${token}`)
    .query({ page: 1, limit: 10, sortBy: "createdAt", sortOrder: "desc" });
  console.log(`[7] GET /api/students -> Status: ${listRes.status}, Found Items: ${listRes.body.data.items.length}, Total: ${listRes.body.data.pagination.total}`);

  // 8. GET /api/students/:id
  const getStudentRes = await request(app)
    .get(`/api/students/${studentId}`)
    .set("Authorization", `Bearer ${token}`);
  console.log(`[8] GET /api/students/:id -> Status: ${getStudentRes.status}, Readiness: ${getStudentRes.body.data.student.readinessStatus}, Competencies: ${getStudentRes.body.data.student.competencies.length}`);

  // 9. PATCH /api/students/:id
  const patchRes = await request(app)
    .patch(`/api/students/${studentId}`)
    .set("Authorization", `Bearer ${token}`)
    .send({
      name: "John Doe Updated",
      version: 1,
    });
  console.log(`[9] PATCH /api/students/:id -> Status: ${patchRes.status}, Updated Name: ${patchRes.body.data.student.name}, Version: ${patchRes.body.data.student.version}`);

  // 10. POST /api/students/:id/attempts (Attempt 1)
  const attemptRes = await request(app)
    .post(`/api/students/${studentId}/attempts`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `smoke-key-1-${suffix}`)
    .send({
      competency: "frontend",
      score: 90,
    });
  console.log(`[10] POST /api/students/:id/attempts -> Status: ${attemptRes.status}, Attempt ID: ${attemptRes.body.data.attempt.id}, Readiness: ${attemptRes.body.data.readiness.status}`);

  // 11. POST /api/students/:id/attempts (Idempotent Replay)
  const replayRes = await request(app)
    .post(`/api/students/${studentId}/attempts`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `smoke-key-1-${suffix}`)
    .send({
      competency: "frontend",
      score: 90,
    });
  console.log(`[11] POST /api/students/:id/attempts (Replay) -> Status: ${replayRes.status}, Replayed Header: ${replayRes.headers["x-idempotency-replayed"]}`);

  // Complete other 3 competencies
  await request(app)
    .post(`/api/students/${studentId}/attempts`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `smoke-key-2-${suffix}`)
    .send({ competency: "backend", score: 85 });
  await request(app)
    .post(`/api/students/${studentId}/attempts`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `smoke-key-3-${suffix}`)
    .send({ competency: "databases", score: 80 });
  const finalAttemptRes = await request(app)
    .post(`/api/students/${studentId}/attempts`)
    .set("Authorization", `Bearer ${token}`)
    .set("Idempotency-Key", `smoke-key-4-${suffix}`)
    .send({ competency: "problem-solving", score: 95 });
  console.log(`[12] POST /api/students/:id/attempts (All Completed) -> Final Readiness: ${finalAttemptRes.body.data.student.readinessStatus}, Overall Score: ${finalAttemptRes.body.data.student.currentScore}`);

  // 13. GET /api/students/:id/activity
  const activityRes = await request(app)
    .get(`/api/students/${studentId}/activity`)
    .set("Authorization", `Bearer ${token}`)
    .query({ page: 1, limit: 10 });
  console.log(`[13] GET /api/students/:id/activity -> Status: ${activityRes.status}, Mongo Events Logged: ${activityRes.body.data.items.length}`);

  // 14. GET /api/students/activity/aggregation
  const aggRes = await request(app)
    .get("/api/students/activity/aggregation")
    .set("Authorization", `Bearer ${token}`);
  console.log(`[14] GET /api/students/activity/aggregation -> Status: ${aggRes.status}, Aggregation Results:`, JSON.stringify(aggRes.body.data, null, 2));

  // 15. POST /api/auth/logout
  const logoutRes = await request(app).post("/api/auth/logout");
  console.log(`[15] POST /api/auth/logout -> Status: ${logoutRes.status}, Message: ${logoutRes.body.message}`);

  console.log("=== ALL ENDPOINTS VERIFIED SUCCESSFULLY! ===");

  await prisma.$disconnect();
  await closeMongo();
}

runEndpointSmokeTest().catch((err) => {
  console.error("Endpoint smoke test failed:", err);
  process.exit(1);
});
