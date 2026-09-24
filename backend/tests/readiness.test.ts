import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  calculateReadiness,
  type CompetencyDefinition,
  type AttemptScore,
} from "../src/domain/readiness.js";

const standardCompetencies: CompetencyDefinition[] = [
  { key: "frontend", weight: 30, required: true },
  { key: "backend", weight: 30, required: true },
  { key: "databases", weight: 25, required: true },
  { key: "problem-solving", weight: 15, required: true },
];

function makeAttempts(scores: number[]): AttemptScore[] {
  return scores.map((score, i) => ({
    id: `att-${i}`,
    competencyKey: standardCompetencies[i]!.key,
    score,
    submittedAt: new Date(1_000_000 + i * 1000),
    voided: false,
  }));
}

describe("Readiness Domain Logic", () => {
  describe("Boundary thresholds", () => {
    const cases = [
      { score: 80.0, expected: "READY" },
      { score: 79.99, expected: "NEARLY_READY" },
      { score: 65.0, expected: "NEARLY_READY" },
      { score: 64.99, expected: "DEVELOPING" },
      { score: 50.0, expected: "DEVELOPING" },
      { score: 49.99, expected: "NEEDS_PREPARATION" },
      { score: 0.0, expected: "NEEDS_PREPARATION" },
      { score: 100.0, expected: "READY" },
    ] as const;

    it.each(cases)(
      "score $score maps to status $expected",
      ({ score, expected }) => {
        const attempts = makeAttempts([score, score, score, score]);
        const result = calculateReadiness(standardCompetencies, attempts);
        expect(result.status).toBe(expected);
        expect(result.overallScore).toBe(score);
      }
    );
  });

  describe("Incomplete status on missing competencies", () => {
    it("returns INCOMPLETE when one or more required competencies are missing", () => {
      // Only 3 of 4 provided
      const partialAttempts: AttemptScore[] = [
        {
          id: "att-1",
          competencyKey: "frontend",
          score: 95,
          submittedAt: new Date(),
          voided: false,
        },
        {
          id: "att-2",
          competencyKey: "backend",
          score: 90,
          submittedAt: new Date(),
          voided: false,
        },
        {
          id: "att-3",
          competencyKey: "databases",
          score: 85,
          submittedAt: new Date(),
          voided: false,
        },
      ];

      const result = calculateReadiness(standardCompetencies, partialAttempts);
      expect(result.status).toBe("INCOMPLETE");
      expect(result.overallScore).toBeNull();
      expect(result.scores["problem-solving"]).toBeNull();
    });

    it("returns INCOMPLETE when all attempts for a required competency are voided", () => {
      const attemptsWithVoided: AttemptScore[] = [
        {
          id: "att-1",
          competencyKey: "frontend",
          score: 95,
          submittedAt: new Date(),
          voided: false,
        },
        {
          id: "att-2",
          competencyKey: "backend",
          score: 90,
          submittedAt: new Date(),
          voided: false,
        },
        {
          id: "att-3",
          competencyKey: "databases",
          score: 85,
          submittedAt: new Date(),
          voided: false,
        },
        {
          id: "att-4",
          competencyKey: "problem-solving",
          score: 80,
          submittedAt: new Date(),
          voided: true, // VOIDED
        },
      ];

      const result = calculateReadiness(standardCompetencies, attemptsWithVoided);
      expect(result.status).toBe("INCOMPLETE");
      expect(result.overallScore).toBeNull();
    });
  });

  describe("Tie breaking and latest attempt selection", () => {
    it("selects the latest attempt by submittedAt date", () => {
      const attempts: AttemptScore[] = [
        ...makeAttempts([70, 70, 70, 70]),
        {
          id: "att-newer",
          competencyKey: "frontend",
          score: 95,
          submittedAt: new Date(2_000_000), // Newer
          voided: false,
        },
      ];

      const result = calculateReadiness(standardCompetencies, attempts);
      expect(result.scores.frontend).toBe(95);
    });

    it("deterministically resolves equal timestamps using largest attempt ID", () => {
      const sameTime = new Date("2026-09-24T12:00:00Z");
      const attempts: AttemptScore[] = [
        ...makeAttempts([70, 70, 70, 70]),
        {
          id: "att-aaa",
          competencyKey: "frontend",
          score: 60,
          submittedAt: sameTime,
          voided: false,
        },
        {
          id: "att-zzz",
          competencyKey: "frontend",
          score: 98,
          submittedAt: sameTime,
          voided: false,
        },
      ];

      const result = calculateReadiness(standardCompetencies, attempts);
      // 'att-zzz' > 'att-aaa', so score 98 should win
      expect(result.scores.frontend).toBe(98);
    });
  });

  describe("Property-based invariant testing (fast-check)", () => {
    it("maintains the weighted mean invariant across arbitrary scores in [0, 100]", () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.double({ min: 0, max: 100, noNaN: true }),
            fc.double({ min: 0, max: 100, noNaN: true }),
            fc.double({ min: 0, max: 100, noNaN: true }),
            fc.double({ min: 0, max: 100, noNaN: true })
          ),
          ([fe, be, db, ps]) => {
            const attempts = makeAttempts([fe, be, db, ps]);
            const result = calculateReadiness(standardCompetencies, attempts);

            const expectedWeighted =
              (fe * 30 + be * 30 + db * 25 + ps * 15) / 100;
            const expectedScore = Number(expectedWeighted.toFixed(2));

            expect(result.overallScore).toBe(expectedScore);

            if (expectedScore >= 80) {
              expect(result.status).toBe("READY");
            } else if (expectedScore >= 65) {
              expect(result.status).toBe("NEARLY_READY");
            } else if (expectedScore >= 50) {
              expect(result.status).toBe("DEVELOPING");
            } else {
              expect(result.status).toBe("NEEDS_PREPARATION");
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
