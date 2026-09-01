"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { PriorityBadge } from "@/components/PriorityBadge";
import { ScoreGauge } from "@/components/ScoreGauge";
import {
  Building,
  Star,
  Globe,
  Phone,
  MapPin,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  MessageSquare,
  Mail,
  BrainCircuit,
  RefreshCw,
  Zap,
  Target,
  FileText,
  ListChecks,
  ChevronLeft,
  Share2,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowRight,
  TrendingUp,
  Compass,
} from "lucide-react";

export default function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const router = useRouter();

  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuditing, setIsAuditing] = useState(false);
  const [aiAudit, setAiAudit] = useState<any | null>(null);
  const [copiedPitch, setCopiedPitch] = useState<"whatsapp" | "email" | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>("NEW");

  const fetchLeadDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (data.success && data.lead) {
        setLead(data.lead);
        setCurrentStatus(data.lead.status || "NEW");

        if (data.lead.lead?.aiAnalysis) {
          try {
            setAiAudit(JSON.parse(data.lead.lead.aiAnalysis));
          } catch {
            setAiAudit(null);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load lead details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
  }, [id]);

  const handleStatusUpdate = async (status: string) => {
    setCurrentStatus(status);
    try {
      await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error("Failed to update status:", e);
    }
  };

  const handleGenerateGeminiAudit = async () => {
    if (!lead) return;
    setIsAuditing(true);
    try {
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("GEMINI_API_KEY") || "" : "";
      const res = await fetch(`/api/leads/${id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: storedKey || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setAiAudit(data.audit);
        handleStatusUpdate("AUDITED");
      }
    } catch (e) {
      console.error("AI Audit error:", e);
    } finally {
      setIsAuditing(false);
    }
  };

  const handleCopyPhone = () => {
    if (!lead?.phone) return;
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyText = (text: string, type: "whatsapp" | "email") => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(type);
    setTimeout(() => setCopiedPitch(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-500 space-y-3">
        <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
        <p className="text-xs">Loading prospect profile...</p>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-400" />
        <h2 className="text-base font-bold text-white">Prospect Not Found</h2>
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
        >
          <ChevronLeft className="h-4 w-4" />
          <span>Back to Pipeline</span>
        </Link>
      </div>
    );
  }

  let reasons: string[] = [];
  try {
    if (lead.lead?.qualificationReasons) {
      reasons =
        typeof lead.lead.qualificationReasons === "string"
          ? JSON.parse(lead.lead.qualificationReasons)
          : lead.lead.qualificationReasons;
    }
  } catch {
    reasons = [];
  }

  const score = lead.lead?.score || 0;
  const priority = lead.lead?.priority || "D";
  const hasWebsite = lead.lead?.hasWebsite || false;

  // Determine strategic opportunity angle
  let opportunityAngleTitle = "New Custom Website & Lead Funnel Build";
  let opportunityAngleDesc = "This business has strong local reviews but lacks a dedicated website to capture direct leads and bookings.";
  let pitchTagColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

  if (hasWebsite && (lead.reviewCount || 0) >= 200) {
    opportunityAngleTitle = "AI Chatbot & High-Traffic Speed Modernization";
    opportunityAngleDesc = "Established high-traffic business. Ideal target for a 24/7 AI WhatsApp booking assistant, faster mobile load times, and dynamic review showcase.";
    pitchTagColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
  } else if (hasWebsite) {
    opportunityAngleTitle = "Website Redesign & Conversion Optimization";
    opportunityAngleDesc = "Existing web presence has opportunity for mobile responsiveness, 1-tap WhatsApp booking, and modern Next.js UI.";
    pitchTagColor = "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }

  return (
    <div className="flex-1 flex flex-col pb-16">
      {/* Top Breadcrumb & Action Bar */}
      <div className="px-8 py-4 border-b border-white/[0.07] bg-slate-950/60 backdrop-blur-md sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/leads"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Back to Leads</span>
          </Link>
          <span className="text-slate-600 text-xs">/</span>
          <span className="text-xs font-semibold text-slate-300 truncate max-w-xs">{lead.name}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 uppercase text-[10px] font-bold">Stage:</span>
            <select
              value={currentStatus}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              className="bg-[#0d1322] border border-white/10 rounded-md px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="NEW">New Lead</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="AUDITED">Audited (Gemini)</option>
              <option value="DEMO_READY">Demo Created</option>
              <option value="CONTACTED">Contacted</option>
              <option value="MEETING">Meeting Booked</option>
              <option value="WON">Won Deal 🎉</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {lead.phone && (
            <a
              href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Open in WhatsApp</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="px-8 mt-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Business Hero Overview Card */}
        <div className="p-6 rounded-2xl bg-[#0d1322] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 flex-shrink-0 mt-0.5">
              <Building className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-white tracking-tight">{lead.name}</h1>
                <PriorityBadge priority={priority} size="md" />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                <span className="text-slate-300 font-medium">{lead.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {lead.city}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <Star className="h-3.5 w-3.5 fill-amber-400" />
                  {lead.rating?.toFixed(1) || "0.0"} ({lead.reviewCount?.toLocaleString()} Google reviews)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                <span>{lead.address || "Address not provided"}</span>
                {lead.googleMapsUrl && (
                  <a
                    href={lead.googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 hover:underline inline-flex items-center gap-0.5 ml-2 font-medium"
                  >
                    View on Maps <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-t lg:border-t-0 lg:border-l border-white/[0.07] pt-4 lg:pt-0 lg:pl-6">
            <div className="space-y-1 text-center sm:text-left">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Quality Score
              </span>
              <ScoreGauge score={score} size="lg" showLabel={false} />
            </div>
          </div>
        </div>

        {/* Strategic Opportunity Banner */}
        <div className="p-4 rounded-xl bg-[#0d1322] border border-white/[0.08] flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center flex-shrink-0">
            <Compass className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Recommended Pitch Strategy:</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${pitchTagColor}`}>
                {opportunityAngleTitle}
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">{opportunityAngleDesc}</p>
          </div>
        </div>

        {/* 2-Column Split: Left = Vital Details & Scoring Breakdown | Right = Gemini AI Strategy & Outreach */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (4 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Contact & Web Vital Box */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3.5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Contact & Digital Presence
              </h3>

              <div className="space-y-2 text-xs">
                {/* Phone */}
                <div className="p-3 rounded-lg bg-[#080c14] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 font-mono">
                    <Phone className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{lead.phone || "No phone listed"}</span>
                  </div>
                  {lead.phone && (
                    <button
                      onClick={handleCopyPhone}
                      className="p-1 rounded text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copy phone"
                    >
                      {copiedPhone ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>

                {/* Website */}
                <div className="p-3 rounded-lg bg-[#080c14] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-300 truncate">
                    <Globe className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    {lead.website ? (
                      <a
                        href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 hover:underline truncate max-w-[220px] inline-flex items-center gap-1 font-medium"
                      >
                        <span className="truncate">{lead.website.replace(/^https?:\/\/(www\.)?/, "")}</span>
                        <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-70" />
                      </a>
                    ) : (
                      <span className="text-rose-400 font-medium">No Website Detected</span>
                    )}
                  </div>
                  {lead.website && (
                    <a
                      href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white"
                      title="Open website"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                {/* Google Maps Place ID */}
                <div className="p-3 rounded-lg bg-[#080c14] border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Google Maps Place Reference:
                  </span>
                  <span className="text-[11px] font-mono text-slate-400 truncate block">
                    {lead.googlePlaceId || "Not recorded"}
                  </span>
                </div>
              </div>
            </div>

            {/* Detailed Scoring Reasons Breakdown */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-indigo-400" />
                  <span>Qualification Scoring Factors</span>
                </h3>
                <span className="text-xs font-mono font-bold text-slate-300">{score}/100</span>
              </div>

              <div className="space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#080c14] border border-white/5 text-xs text-slate-300 flex items-start gap-2 leading-relaxed"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{reason.replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uE000-\uF8FF]+/, "")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No score breakdown logged.</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Gemini AI Review & Strategic Roadmap */}
          <div className="lg:col-span-7 space-y-5">
            {/* Gemini Review Header Strip */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Google Gemini 2.5 Flash Review & Pitch Blueprint
                  </h3>
                </div>

                <button
                  onClick={handleGenerateGeminiAudit}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isAuditing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Analyzing Prospect...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{aiAudit ? "Regenerate AI Strategy" : "Generate Gemini AI Review"}</span>
                    </>
                  )}
                </button>
              </div>

              {aiAudit ? (
                <div className="space-y-4 animate-fadeIn">
                  {/* Executive Business Review */}
                  <div className="p-4 rounded-lg bg-[#080c14] border border-white/5 space-y-1.5 text-xs leading-relaxed text-slate-300">
                    <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider block">
                      Executive Business Review
                    </span>
                    <p>{aiAudit.businessSummary}</p>
                  </div>

                  {/* Identified Gaps & Revenue Opportunities (2 Cols) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Gaps */}
                    <div className="p-3.5 rounded-lg bg-[#080c14] border border-rose-500/20 space-y-2">
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Digital Bottlenecks & Gaps
                      </span>
                      <ul className="space-y-1.5 text-slate-300">
                        {aiAudit.problems?.map((prob: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-rose-400">•</span>
                            <span>{prob}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Opportunities */}
                    <div className="p-3.5 rounded-lg bg-[#080c14] border border-emerald-500/20 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Revenue & Growth Opportunities
                      </span>
                      <ul className="space-y-1.5 text-slate-300">
                        {aiAudit.opportunities?.map((opp: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-emerald-400">•</span>
                            <span>{opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Website Features */}
                  {aiAudit.recommendedFeatures && (
                    <div className="p-3.5 rounded-lg bg-[#080c14] border border-white/5 space-y-2">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Recommended Next.js Features to Pitch
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAudit.recommendedFeatures.map((feat: string, i: number) => (
                          <span
                            key={i}
                            className="px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outreach Copy Section */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Ready-to-Send Outreach Messages (PAS Framework)
                    </h4>

                    {/* WhatsApp Pitch */}
                    {aiAudit.suggestedPitch?.whatsapp && (
                      <div className="p-4 rounded-lg bg-[#080c14] border border-emerald-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" />
                            WhatsApp Pitch Copy
                          </span>
                          <button
                            onClick={() => handleCopyText(aiAudit.suggestedPitch.whatsapp, "whatsapp")}
                            className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 border border-white/10 transition cursor-pointer"
                          >
                            {copiedPitch === "whatsapp" ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copy Message
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans bg-black/40 p-3 rounded-md border border-white/5">
                          {aiAudit.suggestedPitch.whatsapp}
                        </p>
                      </div>
                    )}

                    {/* Email Pitch */}
                    {aiAudit.suggestedPitch?.email && (
                      <div className="p-4 rounded-lg bg-[#080c14] border border-blue-500/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5" />
                            Cold Email Template
                          </span>
                          <button
                            onClick={() => handleCopyText(aiAudit.suggestedPitch.email, "email")}
                            className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-900 border border-white/10 transition cursor-pointer"
                          >
                            {copiedPitch === "email" ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copy Email
                              </>
                            )}
                          </button>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans bg-black/40 p-3 rounded-md border border-white/5 whitespace-pre-line">
                          {aiAudit.suggestedPitch.email}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-lg bg-[#080c14] border border-dashed border-white/10 space-y-3">
                  <BrainCircuit className="h-8 w-8 text-slate-500 mx-auto" />
                  <div>
                    <h4 className="text-xs font-bold text-white">No AI Strategy Generated Yet</h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Click <strong>Generate Gemini AI Review</strong> above to let Google Gemini 2.5 Flash perform a comprehensive audit and craft ready-to-send outreach copy.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
