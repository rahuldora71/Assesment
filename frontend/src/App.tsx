import { useState, useEffect, useRef, useCallback } from "react";
import { Navbar } from "./components/Navbar.js";
import { StudentList } from "./components/StudentList.js";
import { StudentDetailModal } from "./components/StudentDetailModal.js";
import { CreateStudentModal } from "./components/CreateStudentModal.js";
import { RecordAttemptModal } from "./components/RecordAttemptModal.js";
import { MetricsDashboard } from "./components/MetricsDashboard.js";
import { AuthModal } from "./components/AuthModal.js";
import { api, getAccessToken, ApiError } from "./api/client.js";
import type { User, StudentListItem, StudentDetail, Pagination } from "./types/index.js";
import { Sparkles, Loader2, Key, ShieldCheck } from "lucide-react";

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Active view tab: "students" or "metrics"
  const [activeTab, setActiveTab] = useState<"students" | "metrics">("students");

  // Student directory state
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting with URL persistence
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });
  const [statusFilter, setStatusFilter] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("status") || "ALL";
  });
  const [sortBy, setSortBy] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("sortBy") || "createdAt";
  });
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => {
    const params = new URLSearchParams(window.location.search);
    return (params.get("sortOrder") as "asc" | "desc") || "desc";
  });
  const [currentPage, setCurrentPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return Number(params.get("page")) || 1;
  });

  // Modals state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateStudentModalOpen, setIsCreateStudentModalOpen] = useState(false);
  const [attemptTargetStudent, setAttemptTargetStudent] = useState<StudentDetail | null>(null);
  const [isAttemptModalOpen, setIsAttemptModalOpen] = useState(false);

  // Keep track of active request to prevent out-of-order responses
  const activeRequestIdRef = useRef<number>(0);

  // Update URL search parameters
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.set("q", searchQuery);
    if (statusFilter && statusFilter !== "ALL") params.set("status", statusFilter);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);
    if (currentPage > 1) params.set("page", String(currentPage));

    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }, [searchQuery, statusFilter, sortBy, sortOrder, currentPage]);

  // Initial Auth Check
  useEffect(() => {
    const verifyAuth = async () => {
      setAuthLoading(true);
      try {
        if (getAccessToken()) {
          const user = await api.auth.me();
          setCurrentUser(user);
        } else {
          // Attempt refresh via HTTP-only cookie
          try {
            await api.auth.refresh();
            const user = await api.auth.me();
            setCurrentUser(user);
          } catch {
            // Not authenticated
            setCurrentUser(null);
          }
        }
      } catch (err) {
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    verifyAuth();
  }, []);

  // Fetch Student Directory
  const fetchStudents = useCallback(async () => {
    if (!currentUser) return;

    const currentReqId = ++activeRequestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const data = await api.students.list({
        q: searchQuery.trim() || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        sortBy,
        sortOrder,
        page: currentPage,
        limit: 10,
      });

      // Avoid out-of-order race conditions
      if (currentReqId === activeRequestIdRef.current) {
        setStudents(data.items);
        setPagination(data.pagination);
      }
    } catch (err: any) {
      if (currentReqId === activeRequestIdRef.current) {
        if (err instanceof ApiError && err.status === 401) {
          setCurrentUser(null);
          setIsAuthModalOpen(true);
        } else {
          setError(err?.message || "Failed to load student list.");
        }
      }
    } finally {
      if (currentReqId === activeRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [currentUser, searchQuery, statusFilter, sortBy, sortOrder, currentPage]);

  // Debounced search & refetch
  useEffect(() => {
    if (!currentUser) return;
    updateUrlParams();

    const timer = setTimeout(() => {
      fetchStudents();
    }, 250);

    return () => clearTimeout(timer);
  }, [fetchStudents, updateUrlParams, currentUser]);

  const handleSortChange = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setCurrentPage(1);
  };

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setIsDetailModalOpen(true);
  };

  const handleOpenRecordAttempt = async (studentSummary: StudentListItem | StudentDetail) => {
    try {
      const fullStudent = await api.students.getById(studentSummary.id);
      setAttemptTargetStudent(fullStudent);
      setIsAttemptModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setCurrentUser(null);
    setStudents([]);
    setIsAuthModalOpen(true);
  };

  const handleQuickDemoLogin = async () => {
    setDemoLoading(true);
    try {
      try {
        const res = await api.auth.login({
          email: "admin@apex.edu",
          password: "Password123!",
        });
        setCurrentUser(res.user);
        return;
      } catch {
        // If demo tenant is not yet initialized on this instance, register it then login
        await api.auth.register({
          tenantName: "Apex Technical Institute",
          name: "Campus Admin",
          email: "admin@apex.edu",
          password: "Password123!",
        });
        const res = await api.auth.login({
          email: "admin@apex.edu",
          password: "Password123!",
        });
        setCurrentUser(res.user);
      }
    } catch {
      setIsAuthModalOpen(true);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Navbar */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
        onRefresh={fetchStudents}
        isRefreshing={loading}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!currentUser && !authLoading ? (
          <div className="max-w-xl mx-auto my-10 p-7 rounded-3xl bg-zinc-900 border border-zinc-800 text-center shadow-2xl space-y-6">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Student Readiness Control Center
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400 mt-2">
                Multi-tenant placement assessment platform with real-time competency evaluations, idempotent attempts, and telemetry logging.
              </p>
            </div>

            {/* Quick Test Credentials Box */}
            <div className="p-4 rounded-2xl bg-zinc-950 border border-indigo-500/30 text-left space-y-3 shadow-inner">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded-md bg-indigo-500/20 text-indigo-400">
                    <Key className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-200">Test & Evaluation Credentials</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Pre-configured
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">ORGANIZATION / TENANT</div>
                  <div className="font-medium text-zinc-200 mt-0.5">Apex Technical Institute</div>
                </div>
                <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">ROLE</div>
                  <div className="font-medium text-indigo-400 mt-0.5">Campus Administrator</div>
                </div>
                <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">EMAIL (ADMIN)</div>
                  <div className="font-mono text-zinc-200 mt-0.5 select-all font-semibold">admin@apex.edu</div>
                </div>
                <div className="bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 font-mono">PASSWORD</div>
                  <div className="font-mono text-zinc-200 mt-0.5 select-all font-semibold">Password123!</div>
                </div>
              </div>

              <div className="pt-1 text-[11px] text-zinc-400 flex items-center justify-between">
                <span>Tenant ID: <span className="font-mono text-indigo-300">Auto-derived from email</span></span>
                <span className="text-zinc-500 text-[10px]">(or enter UUID)</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <button
                onClick={handleQuickDemoLogin}
                disabled={demoLoading}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-xl shadow-indigo-600/25 transition disabled:opacity-50"
              >
                {demoLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>⚡ 1-Click Demo Sign In</span>
                )}
              </button>
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs border border-zinc-700 transition"
              >
                Custom Sign In / Register
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === "students" ? (
              <StudentList
                students={students}
                pagination={pagination}
                loading={loading}
                error={error}
                searchQuery={searchQuery}
                onSearchChange={(q) => {
                  setSearchQuery(q);
                  setCurrentPage(1);
                }}
                statusFilter={statusFilter}
                onStatusFilterChange={(st) => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                onPageChange={(page) => setCurrentPage(page)}
                onSelectStudent={handleSelectStudent}
                onRecordAttempt={handleOpenRecordAttempt}
                onOpenCreateStudent={() => setIsCreateStudentModalOpen(true)}
                onRetry={fetchStudents}
              />
            ) : (
              <MetricsDashboard />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <StudentDetailModal
        isOpen={isDetailModalOpen}
        studentId={selectedStudentId}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedStudentId(null);
        }}
        onRecordAttempt={(st) => {
          setAttemptTargetStudent(st);
          setIsAttemptModalOpen(true);
        }}
        onStudentUpdated={fetchStudents}
      />

      <CreateStudentModal
        isOpen={isCreateStudentModalOpen}
        onClose={() => setIsCreateStudentModalOpen(false)}
        onSuccess={() => {
          fetchStudents();
        }}
      />

      <RecordAttemptModal
        isOpen={isAttemptModalOpen}
        student={attemptTargetStudent}
        onClose={() => {
          setIsAttemptModalOpen(false);
          setAttemptTargetStudent(null);
        }}
        onSuccess={() => {
          fetchStudents();
          if (selectedStudentId) {
            // refresh details if open
            setSelectedStudentId(selectedStudentId);
          }
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          fetchStudents();
        }}
      />
    </div>
  );
}

export default App;
