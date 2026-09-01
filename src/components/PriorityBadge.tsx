import React from "react";
import { Zap, CheckCircle2, MinusCircle, AlertCircle } from "lucide-react";

interface PriorityBadgeProps {
  priority: string;
  size?: "sm" | "md" | "lg";
}

export function PriorityBadge({ priority, size = "md" }: PriorityBadgeProps) {
  const p = priority.toUpperCase();

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[10px] font-semibold gap-1",
    md: "px-2.5 py-0.5 text-xs font-semibold gap-1.5",
    lg: "px-3 py-1 text-xs font-bold gap-1.5",
  };

  if (p === "A" || p === "HIGH") {
    return (
      <span
        className={`inline-flex items-center rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses[size]}`}
      >
        <Zap className="h-3 w-3 fill-emerald-400 text-emerald-400" />
        <span>Priority A</span>
      </span>
    );
  }

  if (p === "B" || p === "MEDIUM") {
    return (
      <span
        className={`inline-flex items-center rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 ${sizeClasses[size]}`}
      >
        <CheckCircle2 className="h-3 w-3 text-blue-400" />
        <span>Priority B</span>
      </span>
    );
  }

  if (p === "C" || p === "LOW") {
    return (
      <span
        className={`inline-flex items-center rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses[size]}`}
      >
        <MinusCircle className="h-3 w-3 text-amber-400" />
        <span>Priority C</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/50 ${sizeClasses[size]}`}
    >
      <AlertCircle className="h-3 w-3 text-slate-400" />
      <span>Priority D</span>
    </span>
  );
}
