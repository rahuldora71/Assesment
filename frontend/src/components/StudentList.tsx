import React from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  Loader2,
  AlertCircle,
  Eye,
  Award,
  Sparkles,
} from "lucide-react";
import { StatusBadge } from "./StatusBadge.js";
import type { StudentListItem, Pagination } from "../types/index.js";

interface StudentListProps {
  students: StudentListItem[];
  pagination: Pagination;
  loading: boolean;
  error: string | null;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (column: string) => void;
  onPageChange: (newPage: number) => void;
  onSelectStudent: (studentId: string) => void;
  onRecordAttempt: (student: StudentListItem) => void;
  onOpenCreateStudent: () => void;
  onRetry: () => void;
}

export const StudentList: React.FC<StudentListProps> = ({
  students,
  pagination,
  loading,
  error,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  sortBy,
  sortOrder,
  onSortChange,
  onPageChange,
  onSelectStudent,
  onRecordAttempt,
  onOpenCreateStudent,
  onRetry,
}) => {
  const statusOptions: Array<{ label: string; value: string }> = [
    { label: "All Statuses", value: "ALL" },
    { label: "Ready (>= 80)", value: "READY" },
    { label: "Nearly Ready (>= 65)", value: "NEARLY_READY" },
    { label: "Developing (>= 50)", value: "DEVELOPING" },
    { label: "Needs Prep (< 50)", value: "NEEDS_PREPARATION" },
    { label: "Incomplete", value: "INCOMPLETE" },
  ];

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="w-3 h-3 text-zinc-500" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-indigo-400" />
    ) : (
      <ArrowDown className="w-3 h-3 text-indigo-400" />
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search & Filter */}
        <div className="flex flex-1 items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by candidate name or email..."
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition shadow-sm"
            />
          </div>

          {/* Status Dropdown */}
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              aria-label="Filter candidates by readiness status"
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-medium text-zinc-300 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Student Button */}
        <button
          onClick={onOpenCreateStudent}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          Enroll Student
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={onRetry}
            className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-[11px] uppercase tracking-wider text-zinc-400 font-mono">
              <tr>
                <th
                  onClick={() => onSortChange("name")}
                  className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Student Candidate</span>
                    {renderSortIcon("name")}
                  </div>
                </th>
                <th
                  onClick={() => onSortChange("score")}
                  className="py-3 px-4 cursor-pointer hover:text-white transition select-none text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Overall Score</span>
                    {renderSortIcon("score")}
                  </div>
                </th>
                <th className="py-3 px-4">Readiness Status</th>
                <th className="py-3 px-4 text-center">Version (OCC)</th>
                <th
                  onClick={() => onSortChange("createdAt")}
                  className="py-3 px-4 cursor-pointer hover:text-white transition select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Enrolled Date</span>
                    {renderSortIcon("createdAt")}
                  </div>
                </th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-zinc-800/60">
              {loading && students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                      <span className="text-xs">Fetching candidate directory...</span>
                    </div>
                  </td>
                </tr>
              ) : students.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Sparkles className="w-6 h-6 text-zinc-600" />
                      <span className="text-sm font-medium text-zinc-400">No students found</span>
                      <span className="text-xs text-zinc-500">
                        {searchQuery || statusFilter !== "ALL"
                          ? "Try adjusting your search query or filters"
                          : "Enroll a new candidate to begin evaluations"}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr
                    key={student.id}
                    className="hover:bg-zinc-800/40 transition group cursor-pointer"
                    onClick={() => onSelectStudent(student.id)}
                  >
                    {/* Name & Email */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-100 group-hover:text-indigo-400 transition">
                        {student.name}
                      </div>
                      <div className="text-xs text-zinc-400 font-mono">{student.email}</div>
                    </td>

                    {/* Overall Score */}
                    <td className="py-3.5 px-4 text-right">
                      {student.currentScore !== null ? (
                        <span className="font-mono font-bold text-sm text-zinc-100">
                          {student.currentScore}%
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 font-mono">—</span>
                      )}
                    </td>

                    {/* Readiness Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={student.readinessStatus} size="sm" />
                    </td>

                    {/* Version */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800/80 text-zinc-400 border border-zinc-700/60">
                        v{student.version}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-xs text-zinc-400 font-mono">
                      {new Date(student.createdAt).toLocaleDateString()}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectStudent(student.id)}
                          title="View Competencies & Details"
                          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onRecordAttempt(student)}
                          title="Record Attempt"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 text-xs font-medium transition"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Attempt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-zinc-950/40 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
          <div>
            Showing <span className="font-medium text-zinc-200">{students.length}</span> of{" "}
            <span className="font-medium text-zinc-200">{pagination.total}</span> candidates
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-mono px-2">
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
