import React, { useState } from "react";
import { X, Lock, Building, Mail, User, Key, Loader2, AlertCircle } from "lucide-react";
import { api, ApiError } from "../api/client.js";
import type { User as UserType } from "../types/index.js";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tenantId, setTenantId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await api.auth.login({
          tenantId: tenantId.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
        });
        onSuccess(res.user);
        onClose();
      } else {
        if (!tenantName.trim()) {
          setError("Organization Name is required.");
          setLoading(false);
          return;
        }
        const res = await api.auth.register({
          tenantName: tenantName.trim(),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });

        // After register, automatically log in
        const loginRes = await api.auth.login({
          tenantId: res.data.user.tenantId,
          email: email.trim().toLowerCase(),
          password,
        });

        onSuccess(loginRes.user);
        onClose();
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.code === "INVALID_CREDENTIALS") {
          setError("Invalid email, password, or tenant ID.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Connection failed. Please ensure the backend server is running.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                {mode === "login" ? "Sign In to Organization" : "Create New Tenant"}
              </h2>
              <p className="text-xs text-zinc-400">
                {mode === "login"
                  ? "Enter your tenant credentials"
                  : "Register organization and admin account"}
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

        {/* Mode Toggle Tabs */}
        <div className="flex p-1 bg-zinc-950 rounded-xl border border-zinc-800 my-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg transition ${
              mode === "login" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Sign In (Existing Tenant)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
            }}
            className={`flex-1 py-1.5 rounded-lg transition ${
              mode === "register" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Register Organization
          </button>
        </div>

        {/* Demo / Quick Test Credentials Box */}
        <div className="mb-4 p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 text-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-indigo-400" />
              Demo / Test Credentials
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
              Ready to Test
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-zinc-950/70 p-2.5 rounded-lg border border-zinc-800/90">
            <div>
              <span className="text-zinc-500 block text-[10px]">Email (Admin)</span>
              <span className="text-zinc-200 select-all">admin@apex.edu</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">Password</span>
              <span className="text-zinc-200 select-all">Password123!</span>
            </div>
            <div className="col-span-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between text-[10px]">
              <span className="text-zinc-400">Organization:</span>
              <span className="text-indigo-300 font-medium">Apex Technical Institute</span>
            </div>
          </div>

          <div className="flex gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setEmail("admin@apex.edu");
                setPassword("Password123!");
                setTenantId("");
                setError(null);
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/30 text-indigo-200 font-medium text-[11px] transition text-center"
            >
              ⚡ Fill Admin Demo
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setEmail("evaluator@apex.edu");
                setPassword("Password123!");
                setTenantId("");
                setError(null);
              }}
              className="flex-1 py-1.5 px-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-medium text-[11px] transition text-center"
            >
              ⚡ Fill Evaluator Demo
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === "register" ? (
            <>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Organization / Tenant Name *
                </label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    placeholder="e.g. Lambda Academy"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Admin Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-zinc-300">
                  Tenant UUID (Optional)
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">Auto-derived from email if empty</span>
              </div>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="Leave blank to auto-detect, or enter UUID"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-xs font-mono text-zinc-100 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Password *</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-950 border border-zinc-700/80 text-sm text-zinc-100 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "login" ? "Sign In & Authorize" : "Create Tenant & Sign In"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
