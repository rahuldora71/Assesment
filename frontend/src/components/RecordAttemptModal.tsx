import React, { useState, useEffect } from "react";
import { X, Award, RotateCcw, Loader2, CheckCircle2, AlertTriangle, Key } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import type { StudentDetail } from "../types/index.js";

interface RecordAttemptModalProps {
  isOpen: boolean;
  student: StudentDetail | null;
  onClose: () => void;
  onSuccess: (updatedStudent: any) => void;
}

const defaultCompetencies = [
  { key: "frontend", name: "Frontend Engineering (30%)" },
  { key: "backend", name: "Backend Architecture (30%)" },
  { key: "databases", name: "Databases & Schemas (25%)" },
  { key: "problem-solving", name: "Problem Solving & Algorithmic (15%)" },
];

export const RecordAttemptModal: React.FC<RecordAttemptModalProps> = ({
  isOpen,
  student,
  onClose,
  onSuccess,
}) => {
  const [competency, setCompetency] = useState("frontend");
  const [score, setScore] = useState<number>(85);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [isReplaySimulation, setIsReplaySimulation] = useState(false);

  const generateNewKey = () => {
    const newKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    setIdempotencyKey(newKey);
    setIsReplaySimulation(false);
  };

  useEffect(() => {
    if (isOpen) {
      generateNewKey();
      setError(null);
      setSuccessInfo(null);
    }
  }, [isOpen]);

  if (!isOpen || !student) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessInfo(null);

    if (score < 0 || score > 100) {
      setError("Score must be between 0 and 100.");
      return;
    }
    if (!idempotencyKey.trim()) {
      setError("Idempotency key is required.");
      return;
    }

    setLoading(true);
    try {
      const result = await api.students.createAttempt(
        student.id,
        {
          competency,
          score,
        },
        idempotencyKey.trim()
      );

      setSuccessInfo(
        `Attempt submitted! New Status: ${result.readiness?.status || "UPDATED"}, Current Score: ${result.student?.currentScore ?? "Incomplete"}`
      );

      onSuccess(result.student);

      // If not simulating replay, regenerate key for next attempt
      if (!isReplaySimulation) {
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "IDEMPOTENCY_CONFLICT") {
          setError(
            "Conflict: This Idempotency-Key was already used with a different request payload!"
          );
        } else if (err.code === "STALE_VERSION") {
          setError("Student record was updated concurrently. Please refresh.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Failed to submit attempt. Check network or server connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Record Competency Attempt</h2>
              <p className="text-xs text-zinc-400">
                Evaluating candidate: <span className="text-zinc-200 font-medium">{student.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {successInfo && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successInfo}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Competency Selection */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">
              Select Competency *
            </label>
            <select
              value={competency}
              onChange={(e) => setCompetency(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            >
              {defaultCompetencies.map((comp) => (
                <option key={comp.key} value={comp.key}>
                  {comp.name}
                </option>
              ))}
            </select>
          </div>

          {/* Score Slider & Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-zinc-300">
                Score (0 to 100) *
              </label>
              <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                {score} / 100
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={score}
                onChange={(e) => setScore(Number(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                className="w-20 px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-center font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Idempotency Key Section */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-300">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Idempotency-Key Header</span>
              </div>
              <button
                type="button"
                onClick={generateNewKey}
                className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition"
              >
                <RotateCcw className="w-3 h-3" />
                Regenerate
              </button>
            </div>
            <input
              type="text"
              required
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full px-3 py-1.5 text-xs font-mono rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 focus:outline-none focus:border-indigo-500"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Protects against network retry duplication. Same key + payload replays identical response.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-400 select-none">
              <input
                type="checkbox"
                checked={isReplaySimulation}
                onChange={(e) => setIsReplaySimulation(e.target.checked)}
                className="rounded accent-indigo-500"
              />
              <span>Keep key to test duplicate replay</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium rounded-xl text-zinc-300 hover:text-white hover:bg-zinc-800 transition"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Submit Attempt
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
