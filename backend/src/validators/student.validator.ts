import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email format").max(254),
});

export const studentListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .enum([
      "INCOMPLETE",
      "READY",
      "NEARLY_READY",
      "DEVELOPING",
      "NEEDS_PREPARATION",
    ])
    .optional(),
  sortBy: z.enum(["name", "score", "createdAt"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateStudentSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
    email: z.string().trim().toLowerCase().email("Invalid email format").max(254).optional(),
    version: z.coerce.number().int().min(1, "Expected version is required"),
  })
  .refine(
    (data) => data.name !== undefined || data.email !== undefined,
    {
      message: "At least one mutable field (name or email) is required",
    }
  );

export const attemptInputSchema = z.object({
  competency: z.string().trim().min(1, "Competency identifier or key is required").optional(),
  competencyId: z.string().trim().min(1).optional(),
  score: z.coerce
    .number()
    .min(0, "Score must be at least 0")
    .max(100, "Score cannot exceed 100"),
}).refine(
  (data) => Boolean(data.competency || data.competencyId),
  {
    message: "Competency is required",
    path: ["competency"],
  }
);

export const activityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type StudentListQuery = z.infer<typeof studentListQuerySchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type AttemptInput = z.infer<typeof attemptInputSchema>;