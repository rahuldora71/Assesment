import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import {
  createStudentSchema,
  studentListQuerySchema,
  updateStudentSchema,
  attemptInputSchema,
  activityQuerySchema,
} from "../validators/student.validator.js";
import * as studentService from "../services/student.service.js";
import * as attemptService from "../services/attempt.service.js";
import * as mongoActivityService from "../services/mongo-activity.service.js";
import { AppError } from "../middleware/error.middleware.js";

export async function createStudent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = createStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(parsed.error);
    }

    const tenantId = req.user!.tenantId;
    const student = await studentService.createStudent(tenantId, parsed.data);

    return res.status(201).json({
      success: true,
      data: {
        student,
      },
    });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return res.status(409).json({
        success: false,
        code: "STUDENT_EMAIL_EXISTS",
        message: "A student with this email already exists in this tenant",
        requestId: req.requestId,
      });
    }
    next(error);
  }
}

export async function listStudents(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = studentListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return next(parsed.error);
    }

    const tenantId = req.user!.tenantId;
    const result = await studentService.listStudents(tenantId, parsed.data);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getStudentById(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const studentId = req.params.id as string;
    const tenantId = req.user!.tenantId;

    const student = await studentService.getStudentById(tenantId, studentId);
    if (!student) {
      return next(new AppError(404, "STUDENT_NOT_FOUND", "Student not found"));
    }

    return res.status(200).json({
      success: true,
      data: {
        student,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateStudent(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const parsed = updateStudentSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(parsed.error);
    }

    const tenantId = req.user!.tenantId;
    const studentId = req.params.id as string;

    const result = await studentService.updateStudent(
      tenantId,
      studentId,
      parsed.data
    );

    if (result.type === "NOT_FOUND") {
      return next(new AppError(404, "STUDENT_NOT_FOUND", "Student not found"));
    }

    if (result.type === "CONFLICT") {
      return res.status(409).json({
        success: false,
        code: "STALE_VERSION",
        message: "Student was modified by another request",
        requestId: req.requestId,
        currentVersion: result.currentVersion,
      });
    }

    if (result.type === "EMAIL_EXISTS") {
      return res.status(409).json({
        success: false,
        code: "STUDENT_EMAIL_EXISTS",
        message: "A student with this email already exists in this tenant",
        requestId: req.requestId,
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        student: result.student,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createAttempt(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (!idempotencyKey || typeof idempotencyKey !== "string" || idempotencyKey.trim().length === 0 || idempotencyKey.length > 255) {
      return next(
        new AppError(
          400,
          "VALIDATION_ERROR",
          "An Idempotency-Key header (up to 255 characters) is required",
          { "Idempotency-Key": "Header is missing or invalid" }
        )
      );
    }

    const parsed = attemptInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return next(parsed.error);
    }

    const tenantId = req.user!.tenantId;
    const userId = req.user!.id;
    const studentId = req.params.id as string;
    const requestId = req.requestId || (req.headers["x-request-id"] as string) || randomUUID();

    const competency = parsed.data.competency || parsed.data.competencyId!;

    const result = await attemptService.createAttempt({
      tenantId,
      userId,
      studentId,
      competency,
      score: parsed.data.score,
      idempotencyKey: idempotencyKey.trim(),
      requestId,
    });

    res.setHeader("X-Idempotency-Replayed", String(result.replayed));
    return res.status(result.status).json(result.body);
  } catch (error) {
    next(error);
  }
}

export async function getStudentActivity(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const studentId = req.params.id as string;
    const tenantId = req.user!.tenantId;

    // Check student existence and tenant boundary (non-disclosing 404)
    const student = await studentService.getStudentById(tenantId, studentId);
    if (!student) {
      return next(new AppError(404, "STUDENT_NOT_FOUND", "Student not found"));
    }

    const parsed = activityQuerySchema.safeParse(req.query);
    const { page, limit } = parsed.success ? parsed.data : { page: 1, limit: 20 };

    const activity = await mongoActivityService.getStudentActivity(
      tenantId,
      studentId,
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    next(error);
  }
}

export async function getActivityAggregation(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const tenantId = req.user!.tenantId;
    const aggregation = await mongoActivityService.getActivityAggregation(tenantId);

    return res.status(200).json({
      success: true,
      data: aggregation,
    });
  } catch (error) {
    next(error);
  }
}