import React from "react";
import type { User } from "../types/index.js";
import {
  ShieldCheck,
  Users,
  Activity,
  LogOut,
  UserCheck,
  Building2,
  RefreshCw,
} from "lucide-react";

interface NavbarProps {
  currentUser: User | null;
  activeTab: "students" | "metrics";
  onTabChange: (tab: "students" | "metrics") => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  onTabChange,
  onOpenAuth,
  onLogout,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Readiness Control Center
              </span>
              <span className="px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                PROD
              </span>
            </div>
            <p className="text-xs text-zinc-400">Multi-tenant Assessment & Verification</p>
          </div>
        </div>

        {/* Center Tabs */}
        {currentUser && (
          <nav className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800/80">
            <button
              onClick={() => onTabChange("students")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "students"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Users className="w-4 h-4" />
              Students
            </button>
            <button
              onClick={() => onTabChange("metrics")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "metrics"
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <Activity className="w-4 h-4" />
              Anomaly Metrics
            </button>
          </nav>
        )}

        {/* Right User & Actions */}
        <div className="flex items-center gap-3">
          {currentUser ? (
            <>
              {/* Tenant context badge */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-300">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-zinc-400 font-mono">Tenant:</span>
                <span className="font-semibold text-zinc-200" title={currentUser.tenantId}>
                  {currentUser.tenantId.slice(0, 8)}...
                </span>
              </div>

              {/* User Pill */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-zinc-800/50 border border-zinc-700/50 text-xs">
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-medium text-zinc-200">{currentUser.name}</span>
                <span className="px-1.5 py-0.2 rounded bg-zinc-700 text-[10px] text-zinc-300 uppercase">
                  {currentUser.role}
                </span>
              </div>

              {/* Refresh button */}
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Refresh current data"
                className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>

              {/* Switch account / tenant */}
              <button
                onClick={onOpenAuth}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 transition"
              >
                Switch Account
              </button>

              {/* Logout */}
              <button
                onClick={onLogout}
                title="Sign out"
                className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
