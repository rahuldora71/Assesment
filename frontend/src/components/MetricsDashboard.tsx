import React, { useState, useEffect } from "react";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
  RefreshCw,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { api } from "../api/client.js";
import type { TenantMetrics } from "../types/index.js";

export const MetricsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<TenantMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.students.getAggregation();
      setMetrics(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load activity aggregation metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const currentMetric = metrics[0] || null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-white">
              24-Hour Operational Metrics & Anomaly Detection
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              MongoDB Pipeline
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Aggregated operational analytics from the append-only activity event store.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700/80 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Metrics
        </button>
      </div>

      {loading && (
        <div className="py-16 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          <p className="text-xs">Computing aggregation pipeline in MongoDB...</p>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!loading && currentMetric && (
        <>
          {/* Key Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Events */}
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Total Activity Events</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono text-white">
                  {currentMetric.totalEvents}
                </span>
                <span className="text-xs text-zinc-500 ml-2">in last 24h</span>
              </div>
            </div>

            {/* Unique Successful Assessments */}
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Successful Assessments</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono text-emerald-400">
                  {currentMetric.uniqueSuccessfulAssessments}
                </span>
                <span className="text-xs text-zinc-500 ml-2">evaluated</span>
              </div>
            </div>

            {/* p95 Submission Latency */}
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">p95 Submission Latency</span>
                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono text-sky-400">
                  {currentMetric.p95SubmissionLatencyMs !== null
                    ? `${currentMetric.p95SubmissionLatencyMs}ms`
                    : "N/A"}
                </span>
                <span className="text-xs text-zinc-500 ml-2">95th percentile</span>
              </div>
            </div>

            {/* Validation Rejection Rate */}
            <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Validation Rejection Rate</span>
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold font-mono text-amber-400">
                  {currentMetric.rejectionRatePercent}%
                </span>
                <span className="text-xs text-zinc-500 ml-2">
                  ({currentMetric.rejectedEvents} rejected)
                </span>
              </div>
            </div>
          </div>

          {/* Anomaly Detection Banner */}
          <div className="p-6 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-xl ${
                    currentMetric.duplicateSuccessAssessments > 0
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Duplicate Success Events (Anomaly Check)
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Detects assessments committed more than once without idempotency gating.
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 text-xs font-mono font-bold rounded-full ${
                  currentMetric.duplicateSuccessAssessments > 0
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {currentMetric.duplicateSuccessAssessments === 0
                  ? "Zero Anomalies Detected"
                  : `${currentMetric.duplicateSuccessAssessments} Anomalies Detected`}
              </span>
            </div>

            {currentMetric.duplicateSuccessAssessments > 0 ? (
              <div className="mt-4 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-300 text-xs">
                <p className="font-semibold mb-2">Duplicate Assessments Identified:</p>
                <div className="space-y-1 font-mono">
                  {currentMetric.duplicateAssessmentsList.map((item, idx) => (
                    <div key={idx} className="flex justify-between">
                      <span>Assessment ID: {item.assessmentId}</span>
                      <span className="font-bold">{item.count} occurrences</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-500 mt-2">
                All assessment creations in the last 24 hours have been strictly idempotent.
                No duplicate successful attempts detected.
              </p>
            )}
          </div>
        </>
      )}

      {!loading && !currentMetric && !error && (
        <div className="p-12 text-center rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs">
          No operational events recorded yet in MongoDB. Create students and submit attempts to see real-time aggregations.
        </div>
      )}
    </div>
  );
};
