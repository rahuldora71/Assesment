import { createHash } from "node:crypto";
import { prisma } from "../config/db.js";
import { AppError } from "../middleware/error.middleware.js";
import { calculateReadiness } from "../domain/readiness.js";
import { recordAttemptEvent } from "./mongo-activity.service.js";

function hashFingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export interface CreateAttemptInput {
  tenantId: string;
  userId: string;
  studentId: string;
  competency: string;
  score: number;
  idempotencyKey: string;
  requestId: string;
}

export async function createAttempt(input: CreateAttemptInput) {
  const startTime = Date.now();
  const fingerprint = hashFingerprint({
    studentId: input.studentId,
    competency: input.competency,
    score: input.score,
  });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Idempotency Check
      const existingIdempotency = await tx.idempotencyRecord.findUnique({
        where: {
          tenantId_key: {
            tenantId: input.tenantId,
            key: input.idempotencyKey,
          },
        },
      });

      if (existingIdempotency) {
        if (existingIdempotency.requestFingerprint !== fingerprint) {
          throw new AppError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Idempotency key was previously used with a different request payload"
          );
        }

        return {
          status: existingIdempotency.responseStatus,
          body: existingIdempotency.responseJson,
          attempt: null,
          replayed: true,
        };
      }

      // 2. Validate Student with Tenant Isolation
      const student = await tx.student.findFirst({
        where: {
          id: input.studentId,
          tenantId: input.tenantId,
        },
      });

      if (!student) {
        throw new AppError(404, "NOT_FOUND", "Student not found");
      }

      // 3. Validate Competency (support by id or key)
      const competency = await tx.competency.findFirst({
        where: {
          OR: [
            { id: input.competency },
            { key: input.competency },
          ],
        },
      });

      if (!competency) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          "Invalid competency specified",
          { competency: `Competency '${input.competency}' does not exist` }
        );
      }

      // 4. Create Attempt
      const attempt = await tx.attempt.create({
        data: {
          studentId: student.id,
          competencyId: competency.id,
          evaluatorId: input.userId,
          score: input.score,
          requestId: input.requestId,
        },
        include: {
          competency: true,
        },
      });

      // 5. Recompute Student Readiness
      const allAttempts = await tx.attempt.findMany({
        where: {
          studentId: student.id,
          voided: false,
        },
        include: {
          competency: true,
        },
        orderBy: [
          { submittedAt: "desc" },
          { id: "desc" },
        ],
      });

      const allCompetencies = await tx.competency.findMany({
        orderBy: { key: "asc" },
      });

      const readiness = calculateReadiness(
        allCompetencies.map((c) => ({
          id: c.id,
          key: c.key,
          weight: c.weight,
          required: c.required,
        })),
        allAttempts.map((a) => ({
          id: a.id,
          competencyId: a.competencyId,
          competencyKey: a.competency.key,
          score: a.score,
          submittedAt: a.submittedAt,
          voided: a.voided,
        }))
      );

      // 6. Update Student Current Score and Version atomically
      const updatedStudent = await tx.student.update({
        where: {
          id: student.id,
          tenantId: input.tenantId,
        },
        data: {
          currentScore: readiness.overallScore,
          readinessStatus: readiness.status,
          version: { increment: 1 },
        },
      });

      const responseBody = {
        success: true,
        data: {
          attempt: {
            id: attempt.id,
            studentId: attempt.studentId,
            competency: {
              id: competency.id,
              key: competency.key,
              name: competency.name,
              weight: competency.weight,
            },
            score: attempt.score,
            submittedAt: attempt.submittedAt,
          },
          student: {
            id: updatedStudent.id,
            name: updatedStudent.name,
            email: updatedStudent.email,
            currentScore: updatedStudent.currentScore,
            readinessStatus: updatedStudent.readinessStatus,
            version: updatedStudent.version,
          },
          readiness: {
            scores: readiness.scores,
            overallScore: readiness.overallScore,
            status: readiness.status,
          },
        },
      };

      // 7. Store Idempotency Record
      await tx.idempotencyRecord.create({
        data: {
          tenantId: input.tenantId,
          key: input.idempotencyKey,
          requestFingerprint: fingerprint,
          responseStatus: 201,
          responseJson: responseBody,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      return {
        status: 201,
        body: responseBody,
        attempt,
        readiness,
        replayed: false,
      };
    });

    // 8. Record Mongo Event if not replayed
    if (!result.replayed && result.attempt) {
      const latencyMs = Date.now() - startTime;
      await recordAttemptEvent({
        eventId: `attempt:${result.attempt.id}`,
        tenantId: input.tenantId,
        studentId: input.studentId,
        assessmentId: result.attempt.id,
        attemptId: result.attempt.id,
        eventType: "attempt.succeeded",
        requestId: input.requestId,
        occurredAt: result.attempt.submittedAt,
        metadata: {
          score: input.score,
          competency: result.attempt.competency.key,
          readinessStatus: result.readiness?.status,
          overallScore: result.readiness?.overallScore,
          latencyMs,
        },
      });
    }

    return result;
  } catch (error: any) {
    // Record rejected event in MongoDB
    const latencyMs = Date.now() - startTime;
    await recordAttemptEvent({
      eventId: `rejected:${input.requestId}`,
      tenantId: input.tenantId,
      studentId: input.studentId || null,
      attemptId: null,
      assessmentId: null,
      eventType: "attempt.rejected",
      requestId: input.requestId,
      occurredAt: new Date(),
      metadata: {
        reason: error?.message || "Attempt rejected",
        code: error?.code || "ATTEMPT_REJECTED",
        score: input.score,
        competency: input.competency,
        latencyMs,
      },
    });

    throw error;
  }
}
