import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Mail,
  Calendar,
  Layers,
  Activity,
  Edit3,
  Award,
  AlertCircle,
  Loader2,
  Clock,
  Sparkles,
} from "lucide-react";
import { api, ApiError } from "../api/client.js";
import { StatusBadge } from "./StatusBadge.js";
import type { StudentDetail, ActivityEvent } from "../types/index.js";

interface StudentDetailModalProps {
  isOpen: boolean;
  studentId: string | null;
  onClose: () => void;
  onRecordAttempt: (student: StudentDetail) => void;
  onStudentUpdated: () => void;
}

export const StudentDetailModal: React.FC<StudentDetailModalProps> = ({
  isOpen,
  studentId,
  onClose,
  onRecordAttempt,
  onStudentUpdated,
}) => {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<"competencies" | "activity" | "edit">("competencies");

  // Activity events from MongoDB
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editConflict, setEditConflict] = useState<string | null>(null);

  const fetchStudentData = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.students.getById(id);
      setStudent(data);
      setEditName(data.name);
      setEditEmail(data.email);
    } catch (err: any) {
      setError(err?.message || "Failed to load student details");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityEvents = async (id: string) => {
    setLoadingActivity(true);
    try {
      const res = await api.students.getActivity(id, 1, 30);
      setActivities(res.items);
    } catch (err) {
      console.error("Failed to load activity", err);
    } finally {
      setLoadingActivity(false);
    }
  };

  useEffect(() => {
    if (isOpen && studentId) {
      fetchStudentData(studentId);
      fetchActivityEvents(studentId);
      setActiveSubTab("competencies");
      setEditConflict(null);
    }
  }, [isOpen, studentId]);

  if (!isOpen) return null;

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;
    setEditConflict(null);
    setEditLoading(true);

    try {
      await api.students.update(student.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        version: student.version,
      });
      await fetchStudentData(student.id);
      onStudentUpdated();
      setActiveSubTab("competencies");
    } catch (err: any) {
      if (err instanceof ApiError && err.code === "STALE_VERSION") {
        setEditConflict(
          `Optimistic Concurrency Conflict: This student was modified by another request. Current version is ${err.currentVersion ?? "newer"}. Please refresh.`
        );
      } else {
        setEditConflict(err?.message || "Update failed.");
      }
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl text-zinc-100 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <User className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold tracking-tight text-white">
                    {student?.name || "Student Profile"}
                  </h2>
                  {student && <StatusBadge status={student.readinessStatus} size="md" />}
                  {student && (
                    <span className="px-2 py-0.5 text-xs font-mono rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
                      v{student.version}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    {student?.email}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                    Enrolled {student?.createdAt ? new Date(student.createdAt).toLocaleDateString() : "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {student && (
                <button
                  onClick={() => onRecordAttempt(student)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition"
                >
                  <Award className="w-3.5 h-3.5" />
                  + Record Attempt
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex items-center gap-2 mt-5 border-b border-zinc-800 -mb-6 pb-2">
            <button
              onClick={() => setActiveSubTab("competencies")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSubTab === "competencies"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Competency Breakdown
            </button>
            <button
              onClick={() => setActiveSubTab("activity")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSubTab === "activity"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              MongoDB Activity Log ({activities.length})
            </button>
            <button
              onClick={() => setActiveSubTab("edit")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeSubTab === "edit"
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Student (OCC)
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs">Loading student profile...</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && student && activeSubTab === "competencies" && (
            <div className="space-y-6">
              {/* Overall Summary Card */}
              <div className="p-4 rounded-2xl bg-zinc-950/60 border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                      Readiness Engine Evaluation
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Weighted mean of 4 core competencies. Tie-broken deterministically by timestamp & ID.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-indigo-400">
                    {student.currentScore !== null ? `${student.currentScore}%` : "Incomplete"}
                  </div>
                  <p className="text-[11px] text-zinc-500">Overall Weighted Score</p>
                </div>
              </div>

              {/* Competencies Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {student.competencies.map((compEvidence) => {
                  const comp = compEvidence.competency;
                  const att = compEvidence.latestAttempt;
                  const hasAttempt = att !== null;

                  return (
                    <div
                      key={comp.id}
                      className="p-4 rounded-2xl bg-zinc-950/80 border border-zinc-800/90 hover:border-zinc-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-zinc-200">{comp.name}</h4>
                          <span className="text-[11px] font-mono text-zinc-500">
                            Weight: {comp.weight}% {comp.required ? "• Required" : ""}
                          </span>
                        </div>
                        {hasAttempt ? (
                          <span className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            {att.score} / 100
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-zinc-800 text-zinc-400">
                            No attempt
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="mt-3 w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            hasAttempt
                              ? att.score >= 80
                                ? "bg-emerald-500"
                                : att.score >= 65
                                ? "bg-sky-500"
                                : att.score >= 50
                                ? "bg-amber-500"
                                : "bg-rose-500"
                              : "bg-transparent"
                          }`}
                          style={{ width: `${hasAttempt ? att.score : 0}%` }}
                        />
                      </div>

                      {hasAttempt && (
                        <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-500">
                          <span className="flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            {new Date(att.submittedAt).toLocaleTimeString()}
                          </span>
                          <span className="font-mono text-[10px]">ID: {att.id.slice(0, 8)}...</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!loading && activeSubTab === "activity" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Append-Only MongoDB Audit Stream
                </h3>
                <span className="text-[11px] text-zinc-500 font-mono">Collection: activity_events</span>
              </div>

              {loadingActivity ? (
                <div className="py-8 text-center text-xs text-zinc-500">Loading audit events...</div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-zinc-950/40 border border-zinc-800 text-zinc-500 text-xs">
                  No activity events recorded yet for this student.
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map((ev) => (
                    <div
                      key={ev.eventId}
                      className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                            ev.eventType === "attempt.succeeded"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}
                        >
                          {ev.eventType}
                        </span>
                        <div>
                          <div className="font-mono text-zinc-300">
                            {ev.metadata?.competency ? `Competency: ${ev.metadata.competency} | Score: ${ev.metadata.score}` : ev.metadata?.reason || "Event"}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            EventID: {ev.eventId} | Req: {ev.requestId}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[11px] text-zinc-400 font-mono">
                        {new Date(ev.occurredAt).toLocaleTimeString()}
                        {ev.metadata?.latencyMs !== undefined && (
                          <div className="text-[10px] text-indigo-400">{ev.metadata.latencyMs}ms</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!loading && activeSubTab === "edit" && student && (
            <div className="max-w-md mx-auto py-4">
              <h3 className="text-sm font-semibold text-zinc-200 mb-1">
                Optimistic Concurrency Control (OCC)
              </h3>
              <p className="text-xs text-zinc-400 mb-4">
                Changes will only apply if expected version matches current version (v{student.version}).
              </p>

              {editConflict && (
                <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{editConflict}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Student Name</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab("competencies")}
                    className="px-4 py-2 text-xs font-medium rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={editLoading}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                  >
                    {editLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Save Changes (v{student.version})
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
