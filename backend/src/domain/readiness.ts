export interface CompetencyDefinition {
  id?: string;
  key: string;
  name?: string;
  weight: number;
  required: boolean;
}

export interface AttemptScore {
  id: string;
  competencyId?: string;
  competencyKey: string;
  score: number;
  submittedAt: Date;
  voided: boolean;
}

export type ReadinessStatus =
  | "INCOMPLETE"
  | "READY"
  | "NEARLY_READY"
  | "DEVELOPING"
  | "NEEDS_PREPARATION";

export interface ReadinessResult {
  scores: Record<string, number | null>;
  latestAttempts: Record<string, AttemptScore | null>;
  overallScore: number | null;
  status: ReadinessStatus;
}

export function calculateReadiness(
  competencies: CompetencyDefinition[],
  attempts: AttemptScore[]
): ReadinessResult {
  const latest = new Map<string, AttemptScore>();

  // Filter out voided attempts and deterministically resolve ties:
  // Most recent submittedAt wins; if equal timestamp, larger attempt ID wins.
  for (const attempt of attempts) {
    if (attempt.voided) continue;
    const existing = latest.get(attempt.competencyKey);
    if (!existing) {
      latest.set(attempt.competencyKey, attempt);
    } else {
      const currentTime = new Date(attempt.submittedAt).getTime();
      const existingTime = new Date(existing.submittedAt).getTime();
      if (
        currentTime > existingTime ||
        (currentTime === existingTime && attempt.id > existing.id)
      ) {
        latest.set(attempt.competencyKey, attempt);
      }
    }
  }

  const scores: Record<string, number | null> = {};
  const latestAttempts: Record<string, AttemptScore | null> = {};

  for (const comp of competencies) {
    const att = latest.get(comp.key) ?? null;
    latestAttempts[comp.key] = att;
    scores[comp.key] = att !== null ? att.score : null;
  }

  const requiredCompetencies = competencies.filter((c) => c.required);
  const hasMissingRequired = requiredCompetencies.some(
    (c) => scores[c.key] === null
  );

  if (hasMissingRequired) {
    return {
      scores,
      latestAttempts,
      overallScore: null,
      status: "INCOMPLETE",
    };
  }

  // Calculate weighted mean
  // Normalize weights in case integer weights (e.g. 30, 30, 25, 15) or decimals are used
  const totalWeight = requiredCompetencies.reduce((sum, c) => sum + c.weight, 0);
  const weightedSum = requiredCompetencies.reduce((sum, c) => {
    const score = scores[c.key] ?? 0;
    return sum + score * c.weight;
  }, 0);

  const rawOverall = totalWeight > 0 ? weightedSum / totalWeight : 0;
  const overallScore = Number(rawOverall.toFixed(2));

  let status: ReadinessStatus;
  if (overallScore >= 80) {
    status = "READY";
  } else if (overallScore >= 65) {
    status = "NEARLY_READY";
  } else if (overallScore >= 50) {
    status = "DEVELOPING";
  } else {
    status = "NEEDS_PREPARATION";
  }

  return {
    scores,
    latestAttempts,
    overallScore,
    status,
  };
}
