import React from "react";
import type { ReadinessStatus } from "../types/index.js";
import { CheckCircle2, AlertTriangle, Clock, XCircle, HelpCircle } from "lucide-react";

interface StatusBadgeProps {
  status: ReadinessStatus;
  size?: "sm" | "md" | "lg";
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = "md" }) => {
  const configs = {
    READY: {
      label: "Ready",
      bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      icon: CheckCircle2,
    },
    NEARLY_READY: {
      label: "Nearly Ready",
      bg: "bg-sky-500/10 text-sky-400 border-sky-500/20",
      icon: Clock,
    },
    DEVELOPING: {
      label: "Developing",
      bg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      icon: AlertTriangle,
    },
    NEEDS_PREPARATION: {
      label: "Needs Prep",
      bg: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      icon: XCircle,
    },
    INCOMPLETE: {
      label: "Incomplete",
      bg: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
      icon: HelpCircle,
    },
  };

  const config = configs[status] || configs.INCOMPLETE;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.bg} ${sizeClasses[size]}`}
    >
      <Icon className={size === "lg" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      {config.label}
    </span>
  );
};
