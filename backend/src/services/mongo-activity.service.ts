import {
  getActivityEventsCollection,
  type ActivityEventDocument,
} from "../config/mongo.js";

// Retry queue for events that failed to write due to temporary MongoDB outage
const retryQueue: ActivityEventDocument[] = [];
let retryInterval: NodeJS.Timeout | null = null;

async function processRetryQueue() {
  if (retryQueue.length === 0) return;
  try {
    const collection = await getActivityEventsCollection();
    const batch = retryQueue.splice(0, 50);
    for (const event of batch) {
      try {
        await collection.updateOne(
          { eventId: event.eventId },
          { $setOnInsert: event },
          { upsert: true }
        );
      } catch (err) {
        // Requeue if still failing
        retryQueue.push(event);
      }
    }
  } catch (err) {
    // MongoDB still down, will retry next interval
  }
}

export function startEventRetryWorker() {
  if (!retryInterval) {
    retryInterval = setInterval(processRetryQueue, 5000);
    retryInterval.unref();
  }
}

export async function recordAttemptEvent(
  event: ActivityEventDocument
): Promise<void> {
  startEventRetryWorker();
  try {
    const collection = await getActivityEventsCollection();
    await collection.updateOne(
      { eventId: event.eventId },
      { $setOnInsert: event },
      { upsert: true }
    );
  } catch (error: any) {
    console.warn(
      `[MongoActivity] Failed to write event ${event.eventId} to MongoDB (will queue for retry): ${error?.message || error}`
    );
    retryQueue.push(event);
  }
}

export async function getStudentActivity(
  tenantId: string,
  studentId: string,
  page: number = 1,
  limit: number = 20
) {
  const boundedLimit = Math.min(Math.max(limit, 1), 100);
  const boundedPage = Math.max(page, 1);

  try {
    const collection = await getActivityEventsCollection();
    const filter = {
      tenantId,
      studentId,
    };

    const [items, total] = await Promise.all([
      collection
        .find(filter, { projection: { _id: 0 } })
        .sort({ occurredAt: -1, eventId: -1 })
        .skip((boundedPage - 1) * boundedLimit)
        .limit(boundedLimit)
        .toArray(),
      collection.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: boundedPage,
        limit: boundedLimit,
        total,
        totalPages: Math.ceil(total / boundedLimit),
      },
    };
  } catch (error: any) {
    console.error("[MongoActivity] Error fetching student activity:", error);
    return {
      items: [],
      pagination: {
        page: boundedPage,
        limit: boundedLimit,
        total: 0,
        totalPages: 0,
      },
    };
  }
}

export async function getActivityAggregation(tenantId?: string) {
  const collection = await getActivityEventsCollection();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const matchStage: Record<string, any> = {
    occurredAt: { $gte: since },
  };

  if (tenantId) {
    matchStage.tenantId = tenantId;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $facet: {
        byTenant: [
          {
            $group: {
              _id: "$tenantId",
              totalEvents: { $sum: 1 },
              successEvents: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "attempt.succeeded"] }, 1, 0],
                },
              },
              rejectedEvents: {
                $sum: {
                  $cond: [{ $eq: ["$eventType", "attempt.rejected"] }, 1, 0],
                },
              },
              latencies: {
                $push: {
                  $cond: [
                    { $gt: ["$metadata.latencyMs", null] },
                    "$metadata.latencyMs",
                    "$$REMOVE",
                  ],
                },
              },
            },
          },
        ],
        successAttempts: [
          { $match: { eventType: "attempt.succeeded" } },
          {
            $group: {
              _id: {
                tenantId: "$tenantId",
                assessmentId: { $ifNull: ["$assessmentId", "$attemptId"] },
              },
              count: { $sum: 1 },
            },
          },
          {
            $group: {
              _id: "$_id.tenantId",
              uniqueSuccessfulAssessments: { $sum: 1 },
              duplicateSuccessAssessments: {
                $sum: {
                  $cond: [{ $gt: ["$count", 1] }, 1, 0],
                },
              },
              duplicateAssessmentsList: {
                $push: {
                  $cond: [
                    { $gt: ["$count", 1] },
                    { assessmentId: "$_id.assessmentId", count: "$count" },
                    "$$REMOVE",
                  ],
                },
              },
            },
          },
        ],
      },
    },
  ];

  const [results] = await collection.aggregate(pipeline).toArray();

  const byTenantMap = new Map<string, any>();
  for (const tenantStat of results?.byTenant || []) {
    // Calculate p95 latency
    const sortedLatencies = (tenantStat.latencies || []).sort(
      (a: number, b: number) => a - b
    );
    let p95Latency = null;
    if (sortedLatencies.length > 0) {
      const idx = Math.min(
        Math.floor(sortedLatencies.length * 0.95),
        sortedLatencies.length - 1
      );
      p95Latency = sortedLatencies[idx];
    }

    const rejectionRate =
      tenantStat.totalEvents > 0
        ? Number(
            ((tenantStat.rejectedEvents / tenantStat.totalEvents) * 100).toFixed(
              2
            )
          )
        : 0;

    byTenantMap.set(tenantStat._id, {
      tenantId: tenantStat._id,
      totalEvents: tenantStat.totalEvents,
      successEvents: tenantStat.successEvents,
      rejectedEvents: tenantStat.rejectedEvents,
      rejectionRatePercent: rejectionRate,
      p95SubmissionLatencyMs: p95Latency,
      uniqueSuccessfulAssessments: 0,
      duplicateSuccessAssessments: 0,
      duplicateAssessmentsList: [],
    });
  }

  for (const succ of results?.successAttempts || []) {
    const existing = byTenantMap.get(succ._id);
    if (existing) {
      existing.uniqueSuccessfulAssessments = succ.uniqueSuccessfulAssessments;
      existing.duplicateSuccessAssessments = succ.duplicateSuccessAssessments;
      existing.duplicateAssessmentsList = succ.duplicateAssessmentsList;
    } else {
      byTenantMap.set(succ._id, {
        tenantId: succ._id,
        totalEvents: succ.uniqueSuccessfulAssessments,
        successEvents: succ.uniqueSuccessfulAssessments,
        rejectedEvents: 0,
        rejectionRatePercent: 0,
        p95SubmissionLatencyMs: null,
        uniqueSuccessfulAssessments: succ.uniqueSuccessfulAssessments,
        duplicateSuccessAssessments: succ.duplicateSuccessAssessments,
        duplicateAssessmentsList: succ.duplicateAssessmentsList,
      });
    }
  }

  return Array.from(byTenantMap.values());
}
