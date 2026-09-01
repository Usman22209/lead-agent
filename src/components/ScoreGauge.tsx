import React from "react";

interface ScoreGaugeProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = "md", showLabel = true }: ScoreGaugeProps) {
  let color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";

  if (score >= 80) {
    color = "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
  } else if (score >= 60) {
    color = "text-blue-400 bg-blue-500/10 border-blue-500/25";
  } else if (score >= 40) {
    color = "text-amber-400 bg-amber-500/10 border-amber-500/25";
  } else {
    color = "text-rose-400 bg-rose-500/10 border-rose-500/25";
  }

  if (size === "sm") {
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${color}`}>
        {score}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className="flex flex-col items-center">
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-xl border font-mono font-bold text-2xl ${color}`}
        >
          {score}
        </div>
        {showLabel && (
          <span className="mt-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
            Quality Score
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md border font-mono font-bold text-xs ${color}`}
    >
      <span>{score}</span>
      <span className="text-[9px] text-slate-500 ml-0.5 font-normal">/100</span>
    </div>
  );
}
