"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScoreGauge } from "@/components/ScoreGauge";
import { LeadDetailModal } from "@/components/LeadDetailModal";
import {
  Users,
  Search,
  Filter,
  Download,
  Trash2,
  Phone,
  Globe,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  Check,
  Radar,
  ArrowUpDown,
  MapPin,
  Building,
  Star,
  XCircle,
  Zap,
  ArrowRight,
  FileText,
  Layers,
} from "lucide-react";
import Link from "next/link";

function LeadsPipelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Filters
  const [query, setQuery] = useState(searchParams.get("query") || "");
  const [priority, setPriority] = useState(searchParams.get("priority") || "all");
  const [hasWebsite, setHasWebsite] = useState(searchParams.get("hasWebsite") || "all");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [city, setCity] = useState(searchParams.get("city") || "all");
  const [category, setCategory] = useState(searchParams.get("category") || "all");
  const [page, setPage] = useState(1);

  // Selection & Modal
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (priority !== "all") params.set("priority", priority);
      if (hasWebsite !== "all") params.set("hasWebsite", hasWebsite);
      if (status !== "all") params.set("status", status);
      if (city !== "all") params.set("city", city);
      if (category !== "all") params.set("category", category);
      params.set("page", page.toString());
      params.set("limit", "15");

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setLeads(data.items);
        setTotal(data.total);
        setTotalPages(data.totalPages);

        if (data.availableCities && Array.isArray(data.availableCities)) {
          const combinedCities = Array.from(
            new Set(["London", "New York", "Dubai", "Los Angeles", "Toronto", "Sydney", "Singapore", "Berlin", "Paris", "Miami", "Chicago", "Melbourne", ...data.availableCities])
          );
          setAvailableCities(combinedCities);
        }
        if (data.availableCategories && Array.isArray(data.availableCategories)) {
          setAvailableCategories(data.availableCategories);
        }
      }
    } catch (error) {
      console.error("[Leads UI] Failed to load leads:", error);
    } finally {
      setLoading(false);
    }
  }, [query, priority, hasWebsite, status, city, category, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Handle select all
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(leads.map((l) => l.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} leads?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        fetchLeads();
      }
    } catch (e) {
      console.error("[Leads UI] Delete failed:", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const [isBulkEnqueuing, setIsBulkEnqueuing] = useState(false);

  const handleEnqueueSelected = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkEnqueuing(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enqueue", businessIds: selectedIds, priority: 2 }),
      });
      const data = await res.json();
      if (data.success) {
        alert("Enqueued selected leads into Autopilot Queue!");
        setSelectedIds([]);
        fetchLeads();
      } else {
        alert(data.error || "Failed to enqueue leads");
      }
    } catch (e: any) {
      alert("Error: " + e.message);
    } finally {
      setIsBulkEnqueuing(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    try {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.error("[Leads UI] Failed to update status:", e);
    }
  };

  const handleExport = (format: "csv" | "excel" | "json" | "html") => {
    const params = new URLSearchParams();
    if (priority !== "all") params.set("priority", priority);
    if (hasWebsite !== "all") params.set("hasWebsite", hasWebsite);
    if (city !== "all") params.set("city", city);
    if (category !== "all") params.set("category", category);
    params.set("format", format);

    window.open(`/api/export?${params.toString()}`, "_blank");
  };

  const resetAllFilters = () => {
    setQuery("");
    setPriority("all");
    setHasWebsite("all");
    setStatus("all");
    setCity("all");
    setCategory("all");
    setPage(1);
  };

  return (
    <div className="flex-1 flex flex-col pb-12">
      <Header
        title="Leads Pipeline"
        subtitle={`Managing ${total} qualified local businesses & prospects`}
        actionButton={
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport("excel")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition cursor-pointer"
              title="Download styled Excel spreadsheet with auto-fitted columns"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={() => handleExport("csv")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-semibold transition cursor-pointer"
              title="Download clean flat CSV"
            >
              <Download className="h-3.5 w-3.5" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExport("html")}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-indigo-300 text-xs font-semibold transition cursor-pointer"
              title="Open printable executive lead dossier / PDF report"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              <span>Lead Document</span>
            </button>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Scan Maps</span>
            </Link>
          </div>
        }
      />

      <div className="px-8 mt-6 max-w-7xl w-full mx-auto space-y-4">
        {/* Filters and Search Bar */}
        <div className="p-4 rounded-xl bg-[#0d1322] border border-white/[0.08] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
            {/* Search Input */}
            <div className="lg:col-span-3 relative">
              <Search className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, phone, city..."
                className="w-full pl-9 pr-3 py-2 bg-[#080c14] border border-white/10 rounded-lg text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* City Dropdown Filter */}
            <div className="lg:col-span-2">
              <select
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">City: All Cities</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority Filter */}
            <div className="lg:col-span-2">
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Priority: All</option>
                <option value="A">Priority A (80–100)</option>
                <option value="B">Priority B (60–79)</option>
                <option value="C">Priority C (40–59)</option>
                <option value="D">Priority D (&lt;40)</option>
              </select>
            </div>

            {/* Website Status Filter */}
            <div className="lg:col-span-2">
              <select
                value={hasWebsite}
                onChange={(e) => {
                  setHasWebsite(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Website: All</option>
                <option value="no">No Website</option>
                <option value="yes">Has Website</option>
              </select>
            </div>

            {/* Pipeline Status Filter */}
            <div className="lg:col-span-2">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="all">Status: All</option>
                <option value="NEW">New Lead</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="AUDITED">Audited</option>
                <option value="DEMO_READY">Demo Created</option>
                <option value="CONTACTED">Contacted</option>
                <option value="MEETING">Meeting</option>
                <option value="WON">Won</option>
              </select>
            </div>

            {/* Reset Filter Button */}
            <div className="lg:col-span-1 flex items-center">
              <button
                onClick={resetAllFilters}
                className="w-full py-2 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs text-slate-300 font-medium transition cursor-pointer text-center"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Active Filter Pills Bar */}
          {(city !== "all" || priority !== "all" || hasWebsite !== "all" || status !== "all" || query) && (
            <div className="flex items-center gap-1.5 flex-wrap text-xs pt-2 border-t border-white/[0.05]">
              <span className="text-slate-500 font-medium text-[11px]">Filters:</span>
              {city !== "all" && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {city}
                  <button onClick={() => setCity("all")} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                </span>
              )}
              {priority !== "all" && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                  <Zap className="h-3 w-3" /> Priority {priority}
                  <button onClick={() => setPriority("all")} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                </span>
              )}
              {hasWebsite !== "all" && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                  {hasWebsite === "no" ? <XCircle className="h-3 w-3 text-rose-400" /> : <Globe className="h-3 w-3 text-blue-400" />}
                  {hasWebsite === "no" ? "No Website" : "Has Website"}
                  <button onClick={() => setHasWebsite("all")} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                </span>
              )}
              {status !== "all" && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                  Status: {status}
                  <button onClick={() => setStatus("all")} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                </span>
              )}
              {query && (
                <span className="px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 text-[11px] flex items-center gap-1">
                  &quot;{query}&quot;
                  <button onClick={() => setQuery("")} className="hover:text-white ml-0.5 cursor-pointer">×</button>
                </span>
              )}
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between animate-fadeIn text-xs">
              <div className="flex items-center gap-2 text-indigo-300 font-medium">
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[11px]">
                  {selectedIds.length}
                </span>
                <span>leads selected</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleEnqueueSelected}
                  disabled={isBulkEnqueuing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                  title="Enqueue selected leads to Autopilot Queue"
                >
                  <Layers className="h-3 w-3" />
                  <span>{isBulkEnqueuing ? "Queueing..." : "Enqueue Selected to Autopilot"}</span>
                </button>

                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-medium transition cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>{isDeleting ? "Deleting..." : "Delete Selected"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Leads Table Card */}
        <div className="rounded-xl overflow-hidden border border-white/[0.07] bg-[#0d1322]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#090d16] text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-white/5">
                <tr>
                  <th className="py-3 px-3 w-8 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={leads.length > 0 && selectedIds.length === leads.length}
                      className="rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Score & Priority</th>
                  <th className="py-3 px-3">Business & Location</th>
                  <th className="py-3 px-3">Rating / Reviews</th>
                  <th className="py-3 px-3">Website</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2 text-indigo-400" />
                      Loading pipeline leads...
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500 space-y-1.5">
                      <p className="text-xs font-semibold text-slate-400">No leads matched your filters.</p>
                      <Link
                        href={`/discover?location=${encodeURIComponent(city !== "all" ? city : "London")}`}
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline"
                      >
                        Run a Google Maps discovery scan in {city !== "all" ? city : "any city"} →
                      </Link>
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => {
                    const score = lead.lead?.score || 0;
                    const priority = lead.lead?.priority || "D";
                    const hasSite = lead.lead?.hasWebsite || false;
                    const isSelected = selectedIds.includes(lead.id);

                    return (
                      <tr
                        key={lead.id}
                        className={`hover:bg-white/[0.02] transition ${
                          isSelected ? "bg-indigo-950/20" : ""
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectOne(lead.id)}
                            className="rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-0 cursor-pointer"
                          />
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <ScoreGauge score={score} size="md" />
                            <PriorityBadge priority={priority} size="sm" />
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
                            <Star className="h-3 w-3 fill-amber-400" />
                            <span>{lead.rating?.toFixed(1) || "0.0"}</span>
                            <span className="text-slate-500 font-normal">({lead.reviewCount})</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          {hasSite && lead.website ? (
                            <a
                              href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 hover:underline inline-flex items-center gap-1 max-w-[130px] truncate"
                            >
                              <Globe className="h-3 w-3 flex-shrink-0" />
                              <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                              <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 opacity-70" />
                            </a>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px]">
                              <XCircle className="h-3 w-3" /> No Website
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          {lead.phone ? (
                            <a
                              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-400 hover:underline font-mono text-[11px] inline-flex items-center gap-1"
                            >
                              <Phone className="h-3 w-3" />
                              <span>{lead.phone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-500 text-[11px]">No phone</span>
                          )}
                        </td>

                        <td className="py-3 px-3">
                          <select
                            value={lead.status || "NEW"}
                            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                            className="bg-[#080c14] border border-white/10 rounded-md px-2 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500 cursor-pointer"
                          >
                            <option value="NEW">New</option>
                            <option value="QUALIFIED">Qualified</option>
                            <option value="AUDITED">Audited</option>
                            <option value="DEMO_READY">Demo Ready</option>
                            <option value="CONTACTED">Contacted</option>
                            <option value="MEETING">Meeting</option>
                            <option value="WON">Won</option>
                            <option value="ARCHIVED">Archived</option>
                          </select>
                        </td>

                        <td className="py-3 px-3 text-right">
                          <Link
                            href={`/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-xs font-semibold border border-indigo-500/20 transition cursor-pointer"
                          >
                            <span>Inspect</span>
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t border-white/[0.07] bg-[#090d16] flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {leads.length} of {total} prospects (Page {page} of {totalPages || 1})
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-md bg-[#0d1322] hover:bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="p-1.5 rounded-md bg-[#0d1322] hover:bg-slate-800 border border-white/10 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        onClose={() => setSelectedLead(null)}
        onStatusChange={() => fetchLeads()}
      />
    </div>
  );
}

export default function LeadsPipelinePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading leads pipeline...</div>}>
      <LeadsPipelineContent />
    </Suspense>
  );
}
