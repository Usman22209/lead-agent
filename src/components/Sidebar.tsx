"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Radar,
  Users,
  Layers,
  Sparkles,
  MessageSquare,
  Settings,
  ShieldCheck,
  Bot,
  CircleDot,
  CheckCircle2,
  MapPin,
  Radio,
} from "lucide-react";
import { SettingsModal } from "./SettingsModal";

export function Sidebar() {
  const pathname = usePathname();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Auto-Pilot Outbound", href: "/autopilot", icon: Radio, badge: "24/7" },
    { name: "Lead Discovery", href: "/discover", icon: Radar, badge: "Search" },
    { name: "Leads Pipeline", href: "/leads", icon: Users },
  ];

  const upcomingPhases = [
    { name: "AI Audit Agent", icon: Sparkles, phase: "Phase 2" },
    { name: "Website Generator", icon: Layers, phase: "Phase 3" },
    { name: "Outreach Agent", icon: MessageSquare, phase: "Phase 4" },
  ];

  return (
    <>
      <aside className="w-64 flex-shrink-0 flex flex-col border-r border-white/[0.07] bg-[#090d16] h-screen sticky top-0">
        {/* Brand */}
        <div className="p-5 border-b border-white/[0.07] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                LeadAgent
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  v1.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Outbound Sales Engine</p>
            </div>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="flex-1 px-3 py-5 space-y-6 overflow-y-auto">
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Core Engine
            </div>
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-semibold"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 ${
                          isActive ? "text-indigo-400" : "text-slate-400"
                        }`}
                      />
                      <span>{item.name}</span>
                    </div>
                    {item.badge && (
                      <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-slate-800 text-slate-300 border border-white/10">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* AI Settings Trigger */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Settings & Keys
            </div>
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="h-4 w-4 text-indigo-400" />
                <span>API Configuration</span>
              </div>
              <span className="text-[10px] text-indigo-400 font-mono">Gemini</span>
            </button>
          </div>

          {/* Roadmap / Next Phases */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Next Phases</span>
              <span className="text-[9px] text-slate-500 font-mono">Roadmap</span>
            </div>
            <div className="space-y-1">
              {upcomingPhases.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.name}
                    className="flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-500"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-slate-500" />
                      <span>{item.name}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-white/5 text-slate-400">
                      {item.phase}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="p-3.5 border-t border-white/[0.07] bg-[#070a11]">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-slate-300 text-[11px] font-medium">Gemini 2.5 Flash</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/40">
              Online
            </span>
          </div>
        </div>
      </aside>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
