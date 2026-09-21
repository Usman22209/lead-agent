"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import {
  Radar,
  Search,
  MapPin,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
  Filter,
  Check,
  RefreshCw,
  Star,
  Globe,
  ExternalLink,
  Phone,
  Layers,
  XCircle,
  Info,
  ArrowDown,
} from "lucide-react";

const POPULAR_NICHES = [
  "Gyms & Fitness",
  "Dentists",
  "Salons & Spas",
  "Restaurants",
  "Real Estate",
  "Law Firms",
  "Medical Clinics",
  "Car Dealerships",
];

const POPULAR_CITIES = ["London", "Lahore", "Karachi", "Dubai", "Islamabad", "New York"];

function DiscoveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [keyword, setKeyword] = useState(searchParams.get("keyword") || "Gyms & Fitness");
  const [location, setLocation] = useState(searchParams.get("location") || "London");
  const [limit, setLimit] = useState(15);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  // Queue actions state
  const [enqueuedIds, setEnqueuedIds] = useState<Set<string>>(new Set());
  const [isEnqueuingAll, setIsEnqueuingAll] = useState(false);
  const [enqueuingId, setEnqueuingId] = useState<string | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [queueMessage, setQueueMessage] = useState<string | null>(null);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scanResult && resultsRef.current) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [scanResult]);

  const executeDiscovery = async (kw: string, loc: string, lim: number) => {
    if (!kw.trim() || !loc.trim()) return;

    console.log(`[Discover UI] Scanning for "${kw}" in "${loc}" (limit: ${lim})`);
    setIsScanning(true);
    setError(null);
    setScanResult(null);

    try {
      const payload = {
        keyword: kw.trim(),
        location: loc.trim(),
        limit: Number(lim),
      };

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("[Discover UI] Discovery result:", data);

      if (!res.ok) {
        throw new Error(data.error || "Failed to scan Google Places");
      }

      setScanResult(data.data);
    } catch (err: any) {
      console.error("[Discover UI] Discovery failed:", err);
      setError(err.message || "An error occurred during discovery");
    } finally {
      setIsScanning(false);
    }
  };

  const handleScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSelectedLeadIds([]);
    setQueueMessage(null);
    executeDiscovery(keyword, location, limit);
  };

  const handleEnqueueOne = async (leadId: string) => {
    setEnqueuingId(leadId);
    setQueueMessage(null);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", businessId: leadId, priority: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setEnqueuedIds((prev) => new Set([...prev, leadId]));
        setQueueMessage("Lead successfully added to Autopilot Queue!");
        setTimeout(() => setQueueMessage(null), 4000);
      } else {
        alert(data.error || "Failed to enqueue lead");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setEnqueuingId(null);
    }
  };

  const handleEnqueueAll = async () => {
    if (!scanResult?.leads || scanResult.leads.length === 0) return;
    const allIds = scanResult.leads.map((l: any) => l.id);
    setIsEnqueuingAll(true);
    setQueueMessage(null);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", businessIds: allIds, priority: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setEnqueuedIds(new Set([...enqueuedIds, ...allIds]));
        setSelectedLeadIds([]);
        setQueueMessage(`Successfully added all ${allIds.length} leads to Autopilot Queue!`);
        setTimeout(() => setQueueMessage(null), 5000);
      } else {
        alert(data.error || "Failed to enqueue leads");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsEnqueuingAll(false);
    }
  };

  const handleEnqueueSelected = async () => {
    if (selectedLeadIds.length === 0) return;
    setIsEnqueuingAll(true);
    setQueueMessage(null);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", businessIds: selectedLeadIds, priority: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        setEnqueuedIds(new Set([...enqueuedIds, ...selectedLeadIds]));
        setQueueMessage(`Added ${selectedLeadIds.length} selected leads to Autopilot Queue!`);
        setSelectedLeadIds([]);
        setTimeout(() => setQueueMessage(null), 4000);
      } else {
        alert(data.error || "Failed to enqueue selected leads");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsEnqueuingAll(false);
    }
  };

  const handleToggleSelectAll = () => {
    if (!scanResult?.leads) return;
    if (selectedLeadIds.length === scanResult.leads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(scanResult.leads.map((l: any) => l.id));
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Google Maps Lead Discovery"
        subtitle="Extract, deduplicate, and automatically score high-opportunity SMBs in any target city"
      />

      <div className="px-8 mt-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Search Query Card */}
        <div className="p-6 rounded-2xl bg-[#0d1322] border border-white/[0.08] space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <Radar className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">Discovery Query Engine</h2>
                <p className="text-[11px] text-slate-400">Target specific industries and geographic regions</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-white/5 text-[11px] text-slate-400">
              <Database className="h-3 w-3 text-indigo-400" />
              <span>Multi-factor Deduplication & 0–100 Scoring Active</span>
            </div>
          </div>

          <form onSubmit={handleScan} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Niche Input */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="h-3.5 w-3.5 text-indigo-400" />
                  Target Industry / Keyword
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. Gyms & Fitness, Dentists, Salons..."
                  className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* City Input */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-rose-400" />
                  Target City / Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. London, Lahore, Karachi, Dubai..."
                  className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              {/* Limit Selector */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="h-3.5 w-3.5 text-blue-400" />
                  Batch Size
                </label>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value={10}>10 Leads</option>
                  <option value={15}>15 Leads</option>
                  <option value={20}>20 Leads</option>
                  <option value={50}>50 Leads</option>
                </select>
              </div>
            </div>

            {/* Quick Niche Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Popular High-Ticket Niches:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_NICHES.map((niche) => {
                  const isSelected = keyword.toLowerCase() === niche.toLowerCase();
                  return (
                    <button
                      key={niche}
                      type="button"
                      onClick={() => setKeyword(niche)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5"
                      }`}
                    >
                      {niche}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick City Chips */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Target Cities:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_CITIES.map((city) => {
                  const isSelected = location.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setLocation(city)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? "bg-indigo-600 text-white font-semibold shadow-sm"
                          : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      <span>{city}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Submit Strip */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/[0.05]">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                <span>
                  Query: <strong className="text-slate-200">{keyword}</strong> in <strong className="text-slate-200">{location}</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={isScanning}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                {isScanning ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Searching Google Places ({location})...</span>
                  </>
                ) : (
                  <>
                    <Radar className="h-3.5 w-3.5" />
                    <span>Run Lead Discovery</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results Stream Section - Auto-scrolled target */}
        <div ref={resultsRef}>
          {scanResult && (
            <div className="space-y-4 animate-fadeIn pt-2">
              {/* Scan Summary Banner */}
              <div className="p-4 rounded-xl bg-[#0d1322] border border-emerald-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                      <span>Scan Completed: {scanResult.totalFound} Prospects Discovered in {location}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      <strong>+{scanResult.newLeadsCreated}</strong> new leads scored & saved in database •{" "}
                      <strong>{scanResult.duplicatesSkipped}</strong> existing records updated.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleEnqueueAll}
                    disabled={isEnqueuingAll || (scanResult.leads.length > 0 && scanResult.leads.every((l: any) => enqueuedIds.has(l.id)))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition cursor-pointer disabled:opacity-50"
                    title="Add all discovered leads into the autonomous Autopilot Queue"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {isEnqueuingAll
                        ? "Adding All to Queue..."
                        : scanResult.leads.length > 0 && scanResult.leads.every((l: any) => enqueuedIds.has(l.id))
                        ? "All Leads In Queue ✓"
                        : `Add All (${scanResult.leads.length}) to Queue`}
                    </span>
                  </button>

                  <Link
                    href="/autopilot"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/30 text-purple-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Autopilot Hub</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>

                  <button
                    onClick={() => router.push(`/leads?city=${encodeURIComponent(location)}`)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
                  >
                    <span>Pipeline</span>
                  </button>
                </div>
              </div>

              {/* Queue Status Notification Toast */}
              {queueMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    <span>{queueMessage}</span>
                  </div>
                  <Link
                    href="/autopilot"
                    className="font-bold underline text-emerald-300 hover:text-white text-[11px] flex items-center gap-1"
                  >
                    View Autopilot Queue <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}

              {/* Bulk Selection Bar */}
              {selectedLeadIds.length > 0 && (
                <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 text-indigo-200">
                    <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-300 font-mono font-bold text-[11px]">
                      {selectedLeadIds.length}
                    </span>
                    <span>leads selected</span>
                  </div>
                  <button
                    onClick={handleEnqueueSelected}
                    disabled={isEnqueuingAll}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Enqueue Selected ({selectedLeadIds.length})</span>
                  </button>
                </div>
              )}

              {/* Results Table */}
              <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-[#0d1322]">
                <div className="p-3.5 border-b border-white/[0.07] bg-slate-950/40 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Discovered Prospects ({scanResult.leads.length})
                  </span>
                  <span className="text-[11px] text-indigo-400 font-mono">Ranked by Quality Score</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#090d16] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-white/5">
                      <tr>
                        <th className="py-3 px-3 w-8 text-center">
                          <input
                            type="checkbox"
                            checked={
                              scanResult.leads.length > 0 &&
                              selectedLeadIds.length === scanResult.leads.length
                            }
                            onChange={handleToggleSelectAll}
                            className="rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Score & Priority</th>
                        <th className="py-3 px-3">Business Name & Category</th>
                        <th className="py-3 px-3">Rating & Reviews</th>
                        <th className="py-3 px-3">Website</th>
                        <th className="py-3 px-3">Phone</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-slate-300">
                      {scanResult.leads.map((lead: any) => {
                        const isEnqueued = enqueuedIds.has(lead.id);
                        const isThisEnqueuing = enqueuingId === lead.id;
                        const isSelected = selectedLeadIds.includes(lead.id);

                        return (
                          <tr
                            key={lead.id}
                            className={`hover:bg-white/[0.02] transition ${
                              isSelected ? "bg-indigo-500/5" : ""
                            }`}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectLead(lead.id)}
                                className="rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-0 cursor-pointer"
                              />
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <ScoreGauge score={lead.score} size="md" />
                                <PriorityBadge priority={lead.priority} size="sm" />
                              </div>
                            </td>

                            <td className="py-3 px-3 max-w-xs">
                              <div className="font-bold text-white truncate">{lead.name}</div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <span>{lead.category}</span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5 text-slate-300">
                                  <MapPin className="h-3 w-3 text-slate-400" />
                                  {lead.city}
                                </span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1 text-amber-400 font-medium">
                                <Star className="h-3.5 w-3.5 fill-amber-400" />
                                <span>{lead.rating?.toFixed(1) || "0.0"}</span>
                                <span className="text-slate-500 font-normal">({lead.reviewCount})</span>
                              </div>
                            </td>

                            <td className="py-3 px-3">
                              {lead.hasWebsite && lead.website ? (
                                <a
                                  href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 hover:underline text-xs font-medium max-w-[150px] truncate"
                                >
                                  <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                                  <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                                  <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70" />
                                </a>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-rose-400 font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px]">
                                  <XCircle className="h-3 w-3" /> No Website
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                              {lead.phone || <span className="text-slate-500">Not listed</span>}
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleEnqueueOne(lead.id)}
                                  disabled={isEnqueued || isThisEnqueuing}
                                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                                    isEnqueued
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 cursor-default"
                                      : "bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30"
                                  }`}
                                  title="Add lead into Autopilot Queue"
                                >
                                  {isEnqueued ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-400" />
                                      <span>In Queue</span>
                                    </>
                                  ) : isThisEnqueuing ? (
                                    <>
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                      <span>Adding...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Layers className="h-3 w-3" />
                                      <span>Add to Queue</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  onClick={() => setSelectedLead(lead)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-white/10 transition cursor-pointer"
                                >
                                  <span>Inspect</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
      />
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading discovery engine...</div>}>
      <DiscoveryContent />
    </Suspense>
  );
}
