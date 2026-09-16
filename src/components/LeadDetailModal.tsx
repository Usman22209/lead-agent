"use client";

import React, { useState, useEffect } from "react";
import {
  X,
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
  Send,
  Clock,
  TrendingUp,
  History,
} from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { ScoreGauge } from "./ScoreGauge";

interface LeadDetailModalProps {
  lead: any;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: (id: string, newStatus: string) => void;
}

export function LeadDetailModal({
  lead,
  isOpen,
  onClose,
  onStatusChange,
}: LeadDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"audit" | "outreach" | "scoring">("audit");
  const [currentStatus, setCurrentStatus] = useState<string>("NEW");
  const [isAuditing, setIsAuditing] = useState(false);
  const [aiAudit, setAiAudit] = useState<any | null>(null);
  const [copiedPitch, setCopiedPitch] = useState<"whatsapp" | "email" | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [targetEmail, setTargetEmail] = useState("");

  // Follow-up state
  const [followUpData, setFollowUpData] = useState<any>(null);
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [followUpSuccess, setFollowUpSuccess] = useState<string | null>(null);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const fetchFollowUpData = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/followup`);
      const json = await res.json();
      if (json.success) {
        setFollowUpData(json.data);
      }
    } catch (err) {
      console.warn("Failed to fetch follow-up data:", err);
    }
  };

  const handleSendFollowUp = async (channel: "WHATSAPP" | "EMAIL") => {
    if (!lead?.id) return;
    setFollowUpLoading(true);
    setFollowUpSuccess(null);
    setFollowUpError(null);

    try {
      const res = await fetch(`/api/leads/${lead.id}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();

      if (data.success) {
        setFollowUpSuccess(data.message);
        fetchFollowUpData(lead.id);
        setCurrentStatus("CONTACTED");
        if (onStatusChange) onStatusChange(lead.id, "CONTACTED");
      } else {
        setFollowUpError(data.error || "Failed to dispatch follow-up");
      }
    } catch (err: any) {
      setFollowUpError(err.message || "Failed to dispatch follow-up");
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handlePauseFollowUps = async () => {
    if (!lead?.id) return;
    setFollowUpLoading(true);
    setFollowUpSuccess(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/followup`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setFollowUpSuccess("Automated follow-ups paused for this lead.");
        fetchFollowUpData(lead.id);
      }
    } catch {} finally {
      setFollowUpLoading(false);
    }
  };

  useEffect(() => {
    if (lead) {
      setCurrentStatus(lead.status || lead.lead?.assignedStatus || "NEW");
      setTargetEmail(lead.email || "");
      setEmailSuccess(null);
      setEmailError(null);
      setFollowUpSuccess(null);
      setFollowUpError(null);
      fetchFollowUpData(lead.id);
      if (lead.lead?.aiAnalysis) {
        try {
          const parsed = JSON.parse(lead.lead.aiAnalysis);
          setAiAudit(parsed);
        } catch {
          setAiAudit(null);
        }
      } else {
        setAiAudit(null);
      }
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  let reasons: string[] = [];
  try {
    if (lead.lead?.qualificationReasons) {
      reasons =
        typeof lead.lead.qualificationReasons === "string"
          ? JSON.parse(lead.lead.qualificationReasons)
          : lead.lead.qualificationReasons;
    } else if (lead.reasons) {
      reasons = lead.reasons;
    }
  } catch {
    reasons = [];
  }

  const handleCopyPhone = () => {
    if (!lead.phone) return;
    navigator.clipboard.writeText(lead.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyText = (text: string, type: "whatsapp" | "email") => {
    navigator.clipboard.writeText(text);
    setCopiedPitch(type);
    setTimeout(() => setCopiedPitch(null), 2000);
  };

  const handleStatusUpdate = async (status: string) => {
    setCurrentStatus(status);
    if (onStatusChange) {
      onStatusChange(lead.id, status);
    }
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendEmail = async () => {
    const to = targetEmail.trim() || lead?.email?.trim();
    if (!to || !to.includes("@")) {
      setEmailError("Please provide a valid recipient email address.");
      return;
    }
    if (!aiAudit?.suggestedPitch?.email) return;

    setIsSendingEmail(true);
    setEmailError(null);
    setEmailSuccess(null);

    try {
      const pitchText = aiAudit.suggestedPitch.email;
      let subject = `Quick question for ${lead.name}`;
      const subjectMatch = pitchText.match(/^Subject:\s*(.+)$/im);
      if (subjectMatch) subject = subjectMatch[1].trim();

      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject,
          message: pitchText,
          leadId: lead.id,
          businessName: lead.name,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setEmailSuccess(`Email successfully sent to ${to} via Gmail!`);
        setCurrentStatus("CONTACTED");
        if (onStatusChange) onStatusChange(lead.id, "CONTACTED");
      } else {
        setEmailError(data.error || "Failed to send email. Check your Gmail credentials in .env.");
      }
    } catch (e: any) {
      setEmailError(e.message || "Failed to send email");
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleGenerateGeminiAudit = async () => {
    console.log("[Modal UI] Starting Gemini AI Audit for lead:", lead.name, "(ID:", lead.id, ")");
    setIsAuditing(true);
    try {
      const storedKey = typeof window !== "undefined" ? localStorage.getItem("GEMINI_API_KEY") || "" : "";
      const res = await fetch(`/api/leads/${lead.id}/audit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: storedKey || undefined }),
      });
      const data = await res.json();
      console.log("[Modal UI] Gemini AI Audit received:", data);
      if (data.success) {
        setAiAudit(data.audit);
        handleStatusUpdate("AUDITED");
      }
    } catch (e) {
      console.error("[Modal UI] AI Audit error:", e);
    } finally {
      setIsAuditing(false);
    }
  };

  const score = lead.lead?.score || lead.score || 0;
  const priority = lead.lead?.priority || lead.priority || "D";
  const hasWebsite = lead.lead?.hasWebsite ?? lead.hasWebsite ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-3xl bg-[#0d1322] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/[0.07] flex items-start justify-between bg-slate-950/40">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 flex-shrink-0 mt-0.5">
              <Building className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {lead.name}
                </h2>
                <PriorityBadge priority={priority} size="sm" />
              </div>
              <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                <span className="text-slate-300 font-medium">{lead.category}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" /> {lead.city}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1 text-amber-400 font-medium">
                  <Star className="h-3 w-3 fill-amber-400" /> {lead.rating?.toFixed(1) || "0.0"} ({lead.reviewCount} reviews)
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Sub-Header Stats Strip */}
        <div className="px-6 py-3 border-b border-white/[0.07] bg-[#090d16] flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase text-[10px] font-bold">Score:</span>
              <ScoreGauge score={score} size="sm" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 uppercase text-[10px] font-bold">Web:</span>
              {hasWebsite ? (
                <span className="text-blue-400 font-medium flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Has Website
                </span>
              ) : (
                <span className="text-rose-400 font-medium flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> No Website
                </span>
              )}
            </div>
            {lead.phone && (
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <Phone className="h-3 w-3 text-emerald-400" />
                <span>{lead.phone}</span>
                <button
                  onClick={handleCopyPhone}
                  className="text-slate-500 hover:text-white ml-1 cursor-pointer"
                  title="Copy Phone"
                >
                  {copiedPhone ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 uppercase text-[10px] font-bold">Status:</span>
            <select
              value={currentStatus}
              onChange={(e) => handleStatusUpdate(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-md px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="NEW">New Lead</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="AUDITED">Audited (Gemini)</option>
              <option value="DEMO_READY">Demo Created</option>
              <option value="CONTACTED">Contacted</option>
              <option value="MEETING">Meeting Booked</option>
              <option value="WON">Won Deal</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="px-6 border-b border-white/[0.07] bg-slate-950/20 flex items-center gap-6">
          <button
            onClick={() => setActiveTab("audit")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "audit"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Business Audit</span>
          </button>

          <button
            onClick={() => setActiveTab("outreach")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "outreach"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5 text-emerald-400" />
            <span>Outreach Pitch Copy</span>
          </button>

          <button
            onClick={() => setActiveTab("scoring")}
            className={`py-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition cursor-pointer ${
              activeTab === "scoring"
                ? "border-indigo-500 text-white"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <ListChecks className="h-3.5 w-3.5 text-blue-400" />
            <span>Scoring Breakdown ({reasons.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: AI AUDIT */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Gemini 2.5 Flash Strategic Audit
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Comprehensive digital footprint & conversion opportunity analysis
                  </p>
                </div>

                <button
                  onClick={handleGenerateGeminiAudit}
                  disabled={isAuditing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isAuditing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Analyzing with Gemini...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{aiAudit ? "Regenerate Audit" : "Run Gemini AI Audit"}</span>
                    </>
                  )}
                </button>
              </div>

              {aiAudit ? (
                <div className="space-y-4 animate-fadeIn">
                  {/* Executive Summary */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 text-xs text-slate-300 leading-relaxed">
                    <span className="font-bold text-indigo-400 block mb-1">Executive Summary</span>
                    {aiAudit.businessSummary}
                  </div>

                  {/* 2 Column Gaps & Opportunities */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Identified Gaps & Bottlenecks
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAudit.problems?.map((prob: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-rose-400">•</span>
                            <span>{prob}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                      <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Growth & Revenue Opportunities
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {aiAudit.opportunities?.map((opp: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-emerald-400">•</span>
                            <span>{opp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Recommended Website Features */}
                  {aiAudit.recommendedFeatures && aiAudit.recommendedFeatures.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-white/5 space-y-2">
                      <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="h-3.5 w-3.5" />
                        Recommended Next.js Features to Pitch
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {aiAudit.recommendedFeatures.map((feat: string, i: number) => (
                          <span
                            key={i}
                            className="px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-medium"
                          >
                            {feat}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-900/60 border border-dashed border-white/10 space-y-3">
                  <BrainCircuit className="h-8 w-8 text-slate-500 mx-auto" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">No AI audit generated yet</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Click <strong>Run Gemini AI Audit</strong> above to let Google Gemini 2.5 Flash analyze this business and generate tailored recommendations.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: OUTREACH MESSAGES */}
          {activeTab === "outreach" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Personalized Outreach Templates
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    High-conversion pitch copy crafted specifically for {lead.name}
                  </p>
                </div>
              </div>

              {aiAudit?.suggestedPitch ? (
                <div className="space-y-4">
                  {/* WhatsApp Pitch Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5" />
                        WhatsApp Pitch Message
                      </span>
                      <button
                        onClick={() => handleCopyText(aiAudit.suggestedPitch.whatsapp, "whatsapp")}
                        className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-white/5 transition cursor-pointer"
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
                    <p className="text-xs text-slate-200 leading-relaxed font-sans bg-black/30 p-3 rounded-lg border border-white/5">
                      {aiAudit.suggestedPitch.whatsapp}
                    </p>
                  </div>

                  {/* Email Pitch Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-blue-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        Cold Email Pitch Template
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyText(aiAudit.suggestedPitch.email, "email")}
                          className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 border border-white/5 transition cursor-pointer"
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
                        <button
                          onClick={handleSendEmail}
                          disabled={isSendingEmail}
                          className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 px-3 py-1 rounded-md transition cursor-pointer disabled:opacity-50"
                        >
                          {isSendingEmail ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-3.5 w-3.5" /> Send via Gmail
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">To:</span>
                      <input
                        type="email"
                        value={targetEmail}
                        onChange={(e) => setTargetEmail(e.target.value)}
                        placeholder="prospect@business.com"
                        className="flex-1 px-2.5 py-1 rounded bg-black/40 border border-white/10 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed font-sans bg-black/30 p-3 rounded-lg border border-white/5 whitespace-pre-line">
                      {aiAudit.suggestedPitch.email}
                    </p>

                    {emailSuccess && (
                      <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>{emailSuccess}</span>
                      </div>
                    )}

                    {emailError && (
                      <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                        <span>{emailError}</span>
                      </div>
                    )}
                  </div>

                  {/* Multi-Touch Follow-Up Engine Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/20 space-y-3.5 shadow-md">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Automated Follow-Up Sequence
                        </span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Intelligent multi-touch cadences with zero spam & auto-halt on replies
                        </p>
                      </div>

                      {followUpData?.nextFollowUpAt && (
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Next Due: {new Date(followUpData.nextFollowUpAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Step Progression Timeline */}
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {[
                        { step: 0, title: "Initial Pitch", subtitle: "Day 0" },
                        { step: 1, title: "Value Bump", subtitle: "+48h" },
                        { step: 2, title: "Social Proof", subtitle: "+72h" },
                        { step: 3, title: "Breakup", subtitle: "+96h" },
                      ].map((item) => {
                        const currentCount = followUpData?.followUpCount ?? 0;
                        const isDone = currentCount >= item.step && (currentStatus === "CONTACTED" || currentStatus === "MEETING" || currentStatus === "WON");
                        const isCurrent = currentCount === item.step - 1 && currentStatus === "CONTACTED";

                        return (
                          <div
                            key={item.step}
                            className={`p-2.5 rounded-lg border text-center transition ${
                              isDone
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                                : isCurrent
                                ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
                                : "bg-black/30 border-white/5 text-slate-500"
                            }`}
                          >
                            <div className="text-[10px] font-bold uppercase tracking-wider">
                              {isDone ? "✓ Sent" : isCurrent ? "⚡ Next Up" : `Step ${item.step}`}
                            </div>
                            <div className="text-xs font-semibold mt-0.5 text-white">{item.title}</div>
                            <div className="text-[10px] opacity-70">{item.subtitle}</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Follow-up Preview if Next Step exists */}
                    {followUpData?.preview && (
                      <div className="p-3 rounded-lg bg-black/40 border border-white/5 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span className="font-semibold text-slate-300">
                            Upcoming Pitch Copy (Follow-Up #{followUpData.nextStep}):
                          </span>
                          <span className="text-[10px] text-slate-500">Auto-tailored by Gemini</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed font-sans bg-black/30 p-2.5 rounded border border-white/5 whitespace-pre-line">
                          {lead.phone ? followUpData.preview.whatsapp : followUpData.preview.email}
                        </p>
                      </div>
                    )}

                    {/* Manual 1-Click Dispatch Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        {lead.phone && (
                          <button
                            onClick={() => handleSendFollowUp("WHATSAPP")}
                            disabled={followUpLoading || ["REPLIED", "MEETING", "WON"].includes(currentStatus)}
                            className="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40"
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span>Send Follow-Up #{followUpData?.nextStep || 1} via WhatsApp</span>
                          </button>
                        )}
                        {(lead.email || targetEmail) && (
                          <button
                            onClick={() => handleSendFollowUp("EMAIL")}
                            disabled={followUpLoading || ["REPLIED", "MEETING", "WON"].includes(currentStatus)}
                            className="text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer disabled:opacity-40"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            <span>Send via Gmail</span>
                          </button>
                        )}
                      </div>

                      {followUpData?.nextFollowUpAt && (
                        <button
                          onClick={handlePauseFollowUps}
                          disabled={followUpLoading}
                          className="text-xs text-slate-400 hover:text-rose-400 transition cursor-pointer"
                        >
                          Pause Follow-Ups
                        </button>
                      )}
                    </div>

                    {followUpSuccess && (
                      <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                        <span>{followUpSuccess}</span>
                      </div>
                    )}

                    {followUpError && (
                      <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                        <span>{followUpError}</span>
                      </div>
                    )}

                    {/* Outreach History Timeline */}
                    {followUpData?.outreachLogs && followUpData.outreachLogs.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <History className="h-3 w-3" />
                          Outreach Touchpoint History ({followUpData.outreachLogs.length})
                        </span>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                          {followUpData.outreachLogs.map((log: any) => (
                            <div
                              key={log.id}
                              className="p-2 rounded bg-black/40 border border-white/5 text-[11px] space-y-1"
                            >
                              <div className="flex items-center justify-between text-slate-400">
                                <span className="font-semibold text-white flex items-center gap-1.5">
                                  {log.channel === "WHATSAPP" ? (
                                    <MessageSquare className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Mail className="h-3 w-3 text-blue-400" />
                                  )}
                                  {log.status === "REPLIED"
                                    ? "Inbound Reply Received"
                                    : log.step === 0
                                    ? "Initial Outreach Pitch"
                                    : `Follow-Up #${log.step}`}
                                </span>
                                <span className="font-mono text-[10px]">
                                  {new Date(log.sentAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-slate-300 line-clamp-2 italic">{log.message}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-xl bg-slate-900/60 border border-dashed border-white/10 space-y-3">
                  <MessageSquare className="h-8 w-8 text-slate-500 mx-auto" />
                  <div>
                    <h4 className="text-sm font-semibold text-white">No pitch copy generated yet</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Run the Gemini AI Audit from the first tab to automatically generate tailored WhatsApp and Email pitches.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SCORING BREAKDOWN */}
          {activeTab === "scoring" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Qualification Scoring Factors
                </h3>
                <p className="text-[11px] text-slate-400">
                  Total score: <strong className="text-white">{score} / 100</strong> (Priority {priority})
                </p>
              </div>

              <div className="space-y-2">
                {reasons.length > 0 ? (
                  reasons.map((reason, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-900 border border-white/5 text-xs text-slate-300 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{reason.replace(/^[\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF\uE000-\uF8FF]+/, "")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No qualification details logged for this lead.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.07] bg-slate-950/60 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            <span>Place ID: <code className="font-mono text-slate-300">{lead.googlePlaceId || "N/A"}</code></span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/export?id=${lead.id}&format=html`}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 hover:text-white font-medium flex items-center gap-1.5 transition cursor-pointer"
              title="Open printable executive dossier for this lead"
            >
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              Print Dossier
            </a>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
            >
              Close
            </button>
            {lead.phone && (
              <a
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Open WhatsApp
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
