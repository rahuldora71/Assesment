import { prisma } from "../config/db.js";
import { calculateReadiness } from "../domain/readiness.js";
import type {
  CreateStudentInput,
  StudentListQuery,
  UpdateStudentInput,
} from "../validators/student.validator.js";

export async function createStudent(
  tenantId: string,
  input: CreateStudentInput
) {
  return prisma.student.create({
    data: {
      tenantId,
      name: input.name,
      email: input.email,
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      currentScore: true,
      readinessStatus: true,
      version: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function listStudents(
  tenantId: string,
  query: StudentListQuery
) {
  const {
    q,
    status,
    sortBy,
    sortOrder,
    page,
    limit,
  } = query;

  const where = {
    tenantId,

    ...(status
      ? {
          readinessStatus: status,
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: q,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const orderBy =
    sortBy === "name"
      ? [
          { name: sortOrder },
          { id: "asc" as const },
        ]
      : sortBy === "score"
        ? [
            { currentScore: sortOrder },
            { id: "asc" as const },
          ]
        : [
            { createdAt: sortOrder },
            { id: "asc" as const },
          ];

  const [students, total] = await prisma.$transaction([
    prisma.student.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        currentScore: true,
        readinessStatus: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.student.count({
      where,
    }),
  ]);

  return {
    items: students,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getStudentById(
  tenantId: string,
  studentId: string
) {
  const student = await prisma.student.findFirst({
    where: {
      id: studentId,
      tenantId,
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      email: true,
      currentScore: true,
      readinessStatus: true,
      version: true,
      createdAt: true,
      updatedAt: true,
      attempts: {
        where: {
          voided: false,
        },
        orderBy: [
          { submittedAt: "desc" },
          { id: "desc" },
        ],
        select: {
          id: true,
          competencyId: true,
          score: true,
          submittedAt: true,
          evaluatorId: true,
          voided: true,
          competency: {
            select: {
              id: true,
              key: true,
              name: true,
              weight: true,
              required: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    return null;
  }

  const competencies = await prisma.competency.findMany({
    orderBy: {
      key: "asc",
    },
    select: {
      id: true,
      key: true,
      name: true,
      weight: true,
      required: true,
    },
  });

  const readiness = calculateReadiness(
    competencies.map((c) => ({
      id: c.id,
      key: c.key,
      weight: c.weight,
      required: c.required,
    })),
    student.attempts.map((a) => ({
      id: a.id,
      competencyId: a.competencyId,
      competencyKey: a.competency.key,
      score: a.score,
      submittedAt: a.submittedAt,
      voided: a.voided,
    }))
  );

  const competencyEvidence = competencies.map((competency) => {
    const attempt = readiness.latestAttempts[competency.key] ?? null;

    return {
      competency: {
        id: competency.id,
        key: competency.key,
        name: competency.name,
        weight: competency.weight,
        required: competency.required,
      },
      latestAttempt: attempt
        ? {
            id: attempt.id,
            score: attempt.score,
            submittedAt: attempt.submittedAt,
          }
        : null,
    };
  });

  return {
    id: student.id,
    tenantId: student.tenantId,
    name: student.name,
    email: student.email,
    currentScore: student.currentScore,
    readinessStatus: student.readinessStatus,
    version: student.version,
    readiness: {
      scores: readiness.scores,
      overallScore: readiness.overallScore,
      status: readiness.status,
    },
    competencies: competencyEvidence,
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
}

export async function updateStudent(
  tenantId: string,
  studentId: string,
  input: UpdateStudentInput
) {
  try {
    const result = await prisma.student.updateMany({
      where: {
        id: studentId,
        tenantId,
        version: input.version,
      },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      const currentStudent = await prisma.student.findFirst({
        where: {
          id: studentId,
          tenantId,
        },
        select: {
          id: true,
          version: true,
        },
      });

      if (!currentStudent) {
        return {
          type: "NOT_FOUND" as const,
        };
      }

      return {
        type: "CONFLICT" as const,
        currentVersion: currentStudent.version,
      };
    }

    const updated = await prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        currentScore: true,
        readinessStatus: true,
        version: true,
        updatedAt: true,
      },
    });

    return {
      type: "UPDATED" as const,
      student: updated!,
    };
  } catch (error: any) {
    if (error?.code === "P2002") {
      return {
        type: "EMAIL_EXISTS" as const,
      };
    }
    throw error;
  }
}