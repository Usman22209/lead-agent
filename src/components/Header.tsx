"use client";

import React from "react";
import Link from "next/link";
import { Radar, Sparkles } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export function Header({ title, subtitle, actionButton }: HeaderProps) {
  return (
    <header className="px-8 py-5 border-b border-white/[0.07] bg-slate-950/60 backdrop-blur-md sticky top-0 z-20 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5 font-normal">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {actionButton ? (
          actionButton
        ) : (
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
          >
            <Radar className="h-3.5 w-3.5" />
            <span>Discover Leads</span>
          </Link>
        )}
      </div>
    </header>
  );
}
