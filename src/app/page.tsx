"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import {
  Users,
  Target,
  Globe,
  Sparkles,
  Radar,
  ArrowRight,
  Clock,
  ExternalLink,
  Phone,
  Star,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Building,
  Zap,
} from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const total = stats?.totalBusinesses || 0;
  const priorityA = stats?.priorityACount || 0;
  const noWebsite = stats?.noWebsiteCount || 0;
  const hasWebsite = stats?.hasWebsiteCount || 0;
  const noWebsitePercent = total > 0 ? Math.round((noWebsite / total) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Command Center"
        subtitle="Phase 1: Automated Lead Discovery, Deduplication & AI Scoring Engine"
      />

      <div className="px-8 mt-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Quick Launch Banner */}
        <div className="p-6 rounded-2xl bg-[#0d1322] border border-white/[0.08] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 text-[11px] font-semibold border border-indigo-500/30">
              <Zap className="h-3 w-3" />
              <span>Phase 1 — Discovery & Scoring Engine</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Target High-Opportunity Local SMBs Without Websites
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Google Maps extraction + automated 0–100 lead qualification. Find businesses with high customer ratings that lack a digital conversion funnel.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <Link
              href="/discover"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Launch Discovery Scan</span>
            </Link>
            <Link
              href="/leads"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-medium border border-white/10 transition"
            >
              <span>View Pipeline ({total})</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* 4 Core KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Leads */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total Leads
              </span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {loading ? "..." : total}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Deduplicated in database</p>
            </div>
          </div>

          {/* Card 2: Priority A Leads */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Priority A Prospects
              </span>
              <Target className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-emerald-400">
                {loading ? "..." : priorityA}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Score 80–100 (Prime targets)</p>
            </div>
          </div>

          {/* Card 3: Missing Website */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
                No Website
              </span>
              <AlertCircle className="h-4 w-4 text-rose-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {loading ? "..." : noWebsite}
                <span className="text-xs font-normal text-rose-400 ml-2">
                  ({noWebsitePercent}%)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Direct website build pitch</p>
            </div>
          </div>

          {/* Card 4: Existing Website */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
                Website Exists
              </span>
              <Globe className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-white">
                {loading ? "..." : hasWebsite}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">AI Audit & Revamp pitch</p>
            </div>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column: High Opportunity Leads */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  High-Priority Discovered Prospects
                </h3>
                <p className="text-[11px] text-slate-400">
                  Evaluated by automated 0–100 lead qualification algorithm
                </p>
              </div>
              <Link
                href="/leads"
                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
              >
                <span>All Leads</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500 bg-[#0d1322] rounded-xl border border-white/[0.07]">
                Loading pipeline...
              </div>
            ) : !stats?.recentLeads || stats.recentLeads.length === 0 ? (
              <div className="p-8 text-center bg-[#0d1322] rounded-xl border border-dashed border-white/[0.07] space-y-3">
                <Radar className="h-8 w-8 text-slate-500 mx-auto" />
                <div>
                  <h4 className="text-xs font-bold text-white">No leads discovered yet</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Execute a Google Maps discovery search to populate prospects.
                  </p>
                </div>
                <Link
                  href="/discover"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                >
                  Start Discovery Scan
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {stats.recentLeads.map((item: any) => {
                  const score = item.lead?.score || 0;
                  const priority = item.lead?.priority || "D";
                  const hasSite = item.lead?.hasWebsite || false;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedLead(item)}
                      className="p-3.5 rounded-xl bg-[#0d1322] hover:bg-[#111a2e] border border-white/[0.07] hover:border-indigo-500/30 flex items-center justify-between gap-4 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <ScoreGauge score={score} size="md" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white truncate hover:text-indigo-300 transition">
                              {item.name}
                            </h4>
                            <PriorityBadge priority={priority} size="sm" />
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 truncate">
                            <span className="text-slate-300">{item.category}</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {item.city}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-amber-400 font-medium">
                              <Star className="h-3 w-3 fill-amber-400" />
                              {item.rating?.toFixed(1)} ({item.reviewCount})
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {hasSite ? (
                          <span className="hidden sm:inline-flex text-[10px] font-medium text-blue-400 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                            Has Website
                          </span>
                        ) : (
                          <span className="hidden sm:inline-flex text-[10px] font-semibold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                            No Website
                          </span>
                        )}
                        <Link
                          href={`/leads/${item.id}`}
                          className="text-xs font-semibold text-indigo-400 bg-indigo-600/10 px-2.5 py-1 rounded-md border border-indigo-500/20 hover:bg-indigo-600/20 transition flex items-center gap-1"
                        >
                          <span>Inspect</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Search Presets & Recent Logs */}
          <div className="space-y-5">
            {/* Quick Niche Presets */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Quick Query Presets
                </h3>
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <p className="text-[11px] text-slate-400">
                High average order value SMB categories:
              </p>
              <div className="space-y-1.5">
                {[
                  { niche: "Gyms & Fitness", location: "London" },
                  { niche: "Dentists", location: "Lahore" },
                  { niche: "Real Estate", location: "Dubai" },
                  { niche: "Beauty Salons & Spas", location: "Karachi" },
                  { niche: "Law Firms", location: "Islamabad" },
                ].map((preset, idx) => (
                  <Link
                    key={idx}
                    href={`/discover?keyword=${encodeURIComponent(preset.niche)}&location=${encodeURIComponent(preset.location)}`}
                    className="p-2 rounded-lg bg-[#090d16] hover:bg-indigo-600/15 border border-white/5 hover:border-indigo-500/30 flex items-center justify-between transition text-xs group"
                  >
                    <div>
                      <span className="font-semibold text-slate-300 group-hover:text-white">
                        {preset.niche}
                      </span>
                      <span className="text-[11px] text-slate-400 ml-1">in {preset.location}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 group-hover:text-indigo-400 font-mono">
                      Scan →
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Recent Searches */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Recent Scan Logs
                </h3>
                <Clock className="h-3.5 w-3.5 text-slate-400" />
              </div>
              {!stats?.recentSearches || stats.recentSearches.length === 0 ? (
                <p className="text-xs text-slate-500">No scans executed yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {stats.recentSearches.map((s: any) => (
                    <div
                      key={s.id}
                      className="p-2 rounded-lg bg-[#090d16] border border-white/5 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-white">{s.query}</span>
                        <span className="text-slate-400 ml-1 font-normal">in {s.location}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        +{s.newLeadsCount} new
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onStatusChange={() => fetchStats()}
      />
    </div>
  );
}
