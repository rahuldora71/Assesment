export type ReadinessStatus =
  | "INCOMPLETE"
  | "READY"
  | "NEARLY_READY"
  | "DEVELOPING"
  | "NEEDS_PREPARATION";

export interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "EVALUATOR";
  tenantId: string;
}

export interface StudentListItem {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  currentScore: number | null;
  readinessStatus: ReadinessStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompetencyInfo {
  id: string;
  key: string;
  name: string;
  weight: number;
  required: boolean;
}

export interface CompetencyEvidence {
  competency: CompetencyInfo;
  latestAttempt: {
    id: string;
    score: number;
    submittedAt: string;
  } | null;
}

export interface StudentDetail {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  currentScore: number | null;
  readinessStatus: ReadinessStatus;
  version: number;
  readiness: {
    scores: Record<string, number | null>;
    overallScore: number | null;
    status: ReadinessStatus;
  };
  competencies: CompetencyEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEvent {
  eventId: string;
  tenantId: string;
  studentId: string | null;
  assessmentId?: string | null;
  attemptId: string | null;
  eventType: "attempt.succeeded" | "attempt.rejected";
  requestId: string;
  occurredAt: string;
  metadata?: {
    score?: number;
    competency?: string;
    readinessStatus?: string;
    overallScore?: number | null;
    latencyMs?: number;
    reason?: string;
  };
}

export interface TenantMetrics {
  tenantId: string;
  totalEvents: number;
  successEvents: number;
  rejectedEvents: number;
  rejectionRatePercent: number;
  p95SubmissionLatencyMs: number | null;
  uniqueSuccessfulAssessments: number;
  duplicateSuccessAssessments: number;
  duplicateAssessmentsList: Array<{ assessmentId: string; count: number }>;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
