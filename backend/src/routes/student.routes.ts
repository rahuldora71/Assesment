import { Router } from "express";

import {
  createStudent,
  listStudents,
  getStudentById,
  updateStudent,
  createAttempt,
  getStudentActivity,
  getActivityAggregation,
} from "../controllers/student.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";
import { permit } from "../middleware/role.middleware.js";

const router = Router();

router.use(authenticate);

// List students with search, filters, pagination, sorting
router.get("/", listStudents);

// Create student in current tenant
router.post("/", permit("ADMIN"), createStudent);

// Aggregation endpoint (must precede :id route)
router.get("/activity/aggregation", getActivityAggregation);

// Student details by ID
router.get("/:id", getStudentById);

// Update student allowlisted fields with version check
router.patch("/:id", updateStudent);

// Create validated attempt with Idempotency-Key
router.post("/:id/attempts", permit("ADMIN", "EVALUATOR"), createAttempt);

// Student activity history from MongoDB
router.get("/:id/activity", getStudentActivity);

export default router;