"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { WhatsAppConnectModal } from "@/components/WhatsAppConnectModal";
import {
  Play,
  Pause,
  Smartphone,
  QrCode,
  ShieldCheck,
  Zap,
  Clock,
  Send,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Trash2,
  Settings2,
  Radio,
  ArrowRight,
  TrendingUp,
  MapPin,
  Flame,
  Mail,
} from "lucide-react";

export default function AutoPilotPage() {
  const [engineState, setEngineState] = useState<any>(null);
  const [waState, setWaState] = useState<any>(null);
  const [emailStatus, setEmailStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isWaModalOpen, setIsWaModalOpen] = useState(false);

  // Settings Form State
  const [dailyLimit, setDailyLimit] = useState(35);
  const [minDelay, setMinDelay] = useState(30);
  const [maxDelay, setMaxDelay] = useState(60);
  const [minScore, setMinScore] = useState(70);
  const [workHoursOnly, setWorkHoursOnly] = useState(false);
  const [enableEmail, setEnableEmail] = useState(true);
  const [enableFollowUps, setEnableFollowUps] = useState(true);
  const [followUpIntervalDays, setFollowUpIntervalDays] = useState(2);
  const [maxFollowUps, setMaxFollowUps] = useState(2);

  // New Queue Form State
  const [newKeyword, setNewKeyword] = useState("");
  const [newLocation, setNewLocation] = useState("");

  const fetchData = async () => {
    try {
      const [autoRes, waRes, emailRes] = await Promise.all([
        fetch("/api/autopilot"),
        fetch("/api/whatsapp/status"),
        fetch("/api/email/status").catch(() => null),
      ]);

      const autoData = await autoRes.json();
      const waData = await waRes.json();
      const emailData = emailRes ? await emailRes.json().catch(() => null) : null;

      if (autoData.success) {
        setEngineState(autoData.data);
        if (autoData.data.config) {
          setDailyLimit(autoData.data.config.dailyWhatsAppLimit || 35);
          setMinDelay(autoData.data.config.minDelaySeconds || 30);
          setMaxDelay(autoData.data.config.maxDelaySeconds || 60);
          setMinScore(autoData.data.config.minimumScore || 70);
          setWorkHoursOnly(autoData.data.config.workHoursOnly || false);
          setEnableEmail(autoData.data.config.enableEmail !== false);
          setEnableFollowUps(autoData.data.config.enableFollowUps !== false);
          setFollowUpIntervalDays(autoData.data.config.followUpIntervalDays || 2);
          setMaxFollowUps(autoData.data.config.maxFollowUps || 2);
        }
      }

      if (waData.success) {
        setWaState(waData.data);
      }

      if (emailData) {
        setEmailStatus(emailData);
      }
    } catch (err) {
      console.error("Failed to fetch Auto-Pilot state:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000); // 3s polling for live activity updates
    return () => clearInterval(interval);
  }, []);

  const handleToggleEngine = async () => {
    if (!engineState) return;
    setActionLoading(true);
    const action = engineState.isActive ? "pause" : "start";

    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
      }
    } catch (err) {
      console.error("Failed to toggle engine:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRunImmediateCycle = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "run-now" }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
      }
    } catch (err) {
      console.error("Failed to trigger cycle:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          config: {
            dailyWhatsAppLimit: Number(dailyLimit),
            minDelaySeconds: Number(minDelay),
            maxDelaySeconds: Number(maxDelay),
            minimumScore: Number(minScore),
            workHoursOnly,
            enableEmail,
            enableFollowUps,
            followUpIntervalDays: Number(followUpIntervalDays),
            maxFollowUps: Number(maxFollowUps),
          },
          queues: engineState?.targetQueues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
        alert("Auto-Pilot settings saved successfully!");
      }
    } catch (err) {
      console.error("Failed to save config:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddQueue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyword.trim() || !newLocation.trim() || !engineState) return;

    const newQueue = {
      id: "q_" + Math.random().toString(36).substring(2, 7),
      keyword: newKeyword.trim(),
      location: newLocation.trim(),
      enabled: true,
    };

    const updatedQueues = [...(engineState.targetQueues || []), newQueue];

    setActionLoading(true);
    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          config: engineState.config,
          queues: updatedQueues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
        setNewKeyword("");
        setNewLocation("");
      }
    } catch (err) {
      console.error("Failed to add queue:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleQueue = async (queueId: string) => {
    if (!engineState) return;
    const updatedQueues = engineState.targetQueues.map((q: any) =>
      q.id === queueId ? { ...q, enabled: !q.enabled } : q
    );

    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          config: engineState.config,
          queues: updatedQueues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
      }
    } catch (err) {
      console.error("Failed to toggle queue:", err);
    }
  };

  const handleDeleteQueue = async (queueId: string) => {
    if (!engineState) return;
    const updatedQueues = engineState.targetQueues.filter((q: any) => q.id !== queueId);

    try {
      const res = await fetch("/api/autopilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-config",
          config: engineState.config,
          queues: updatedQueues,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEngineState(data.data);
      }
    } catch (err) {
      console.error("Failed to delete queue:", err);
    }
  };

  const isWaConnected = waState?.status === "CONNECTED";
  const sentCount = engineState?.sentToday || 0;
  const limitCount = engineState?.dailyLimit || dailyLimit;
  const progressPercent = Math.min(100, Math.round((sentCount / (limitCount || 1)) * 100));

  return (
    <div className="flex-1 flex flex-col pb-16">
      <Header
        title="Autonomous Auto-Pilot Outbound"
        subtitle="Automated 24/7 lead scraping, Gemini 2.5 Flash audits, and paced WhatsApp dispatch with client reply sync"
      />

      <div className="px-8 mt-6 space-y-6 max-w-7xl w-full mx-auto">
        {/* Top Control Banner */}
        <div className="p-6 rounded-2xl bg-[#0d1322] border border-white/[0.08] flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 text-[11px] font-semibold border border-indigo-500/30">
                <Radio className={`h-3 w-3 ${engineState?.isActive ? "animate-pulse text-emerald-400" : ""}`} />
                <span>Auto-Pilot Status: {engineState?.isActive ? "RUNNING (ACTIVE)" : "PAUSED"}</span>
              </div>
              {isWaConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                  <Smartphone className="h-3 w-3" /> WhatsApp Linked (+{waState?.phoneNumber})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                  <AlertCircle className="h-3 w-3" /> WhatsApp Disconnected
                </span>
              )}
            </div>

            <h2 className="text-lg font-bold text-white tracking-tight">
              Hands-Free Outbound Prospecting & Outreach Machine
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              The agent autonomously scans target niches, qualifies high-ROI leads (Score ≥ {minScore}), generates custom Gemini pitches, and sends messages with human pacing delays directly from your linked WhatsApp.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-wrap items-center gap-3 flex-shrink-0">
            <button
              onClick={() => setIsWaModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/10 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Smartphone className="h-4 w-4 text-emerald-400" />
              <span>{isWaConnected ? "Manage WhatsApp" : "Pair WhatsApp (QR)"}</span>
            </button>

            <button
              onClick={handleRunImmediateCycle}
              disabled={actionLoading || !isWaConnected}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-semibold transition disabled:opacity-40 cursor-pointer"
            >
              <Zap className="h-4 w-4 text-indigo-400" />
              <span>Run 1 Cycle Now</span>
            </button>

            <button
              onClick={handleToggleEngine}
              disabled={actionLoading}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold shadow-lg transition cursor-pointer ${
                engineState?.isActive
                  ? "bg-amber-600 hover:bg-amber-500 text-white"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {engineState?.isActive ? (
                <>
                  <Pause className="h-4 w-4 fill-white" />
                  <span>Pause Auto-Pilot</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-white" />
                  <span>Start 24/7 Auto-Pilot</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Core Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Sent Today */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Today&apos;s Dispatches
              </span>
              <Send className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-xl font-bold font-mono text-white flex items-baseline gap-2">
                <span>{sentCount} <span className="text-[11px] text-emerald-400 font-sans">WA</span></span>
                <span className="text-slate-600">•</span>
                <span>{engineState?.emailsSentToday || 0} <span className="text-[11px] text-blue-400 font-sans">Emails</span></span>
                <span className="text-slate-600">•</span>
                <span>{engineState?.followUpsSentToday || 0} <span className="text-[11px] text-amber-400 font-sans">Follow-ups</span></span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden border border-white/5">
                <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
              </div>
              {engineState?.pendingFollowUpsDue > 0 && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                  <Clock className="h-3 w-3" />
                  <span>{engineState.pendingFollowUpsDue} Follow-up{engineState.pendingFollowUpsDue > 1 ? "s" : ""} Due</span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Outreach Channels */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Outreach Channels
              </span>
              <div className="flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-emerald-400" />
                <Mail className="h-3.5 w-3.5 text-blue-400" />
              </div>
            </div>
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${isWaConnected ? "bg-emerald-400" : "bg-slate-500"}`} />
                  WhatsApp:
                </span>
                <span className="font-mono text-white text-[11px] truncate max-w-[120px]">
                  {isWaConnected ? `+${waState?.phoneNumber}` : "Unlinked"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${emailStatus?.isConfigured ? (emailStatus?.isValid ? "bg-emerald-400" : "bg-amber-400") : "bg-slate-500"}`} />
                  Gmail:
                </span>
                <span className="font-mono text-white text-[11px] truncate max-w-[120px]" title={emailStatus?.userEmail || ""}>
                  {emailStatus?.isConfigured ? (emailStatus?.userEmail || "Configured") : "Not Configured"}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Pacing Delay */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Human Jitter Pacing
              </span>
              <Clock className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-indigo-400">
                {minDelay}–{maxDelay}s
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Randomized spacing between sends</p>
            </div>
          </div>

          {/* Card 4: Inbound Responses */}
          <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Client Inbound Replies
              </span>
              <MessageSquare className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-amber-400">
                {waState?.recentInbound?.length || 0}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Synced live to your phone</p>
            </div>
          </div>
        </div>

        {/* 2-Column Split: Left = Settings & Target Queues | Right = Live Activity Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (5 cols): Target Queues & Pacing Settings */}
          <div className="lg:col-span-5 space-y-6">
            {/* Target Campaign Queues */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-orange-400" />
                    Target Campaign Queues
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">The agent cycles through these markets in order</p>
                </div>
              </div>

              {/* Add New Target Form */}
              <form onSubmit={handleAddQueue} className="grid grid-cols-1 sm:grid-cols-12 gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Niche (e.g. Gyms)"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  className="sm:col-span-5 bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
                <input
                  type="text"
                  placeholder="City (e.g. London)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="sm:col-span-5 bg-[#080c14] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="sm:col-span-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg flex items-center justify-center py-1.5 text-xs font-bold transition cursor-pointer"
                  title="Add Target"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </form>

              {/* Queue List */}
              <div className="space-y-1.5 pt-1">
                {engineState?.targetQueues?.map((q: any) => (
                  <div
                    key={q.id}
                    className={`p-3 rounded-lg border flex items-center justify-between transition ${
                      q.enabled
                        ? "bg-[#080c14] border-white/10 text-slate-200"
                        : "bg-slate-950/40 border-white/5 text-slate-500 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={q.enabled}
                        onChange={() => handleToggleQueue(q.id)}
                        className="h-3.5 w-3.5 rounded bg-slate-900 border-white/20 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-white">{q.keyword}</span>
                        <span className="text-slate-400 ml-1">in {q.location}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteQueue(q.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition cursor-pointer"
                      title="Remove Target"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Pacing & Safety Settings */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  Pacing & Safety Controls
                </h3>
              </div>

              <div className="space-y-4 text-xs">
                {/* Daily Cap */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Daily Max Outbound WhatsApp Limit:</span>
                    <span className="font-mono font-bold text-white">{dailyLimit} messages / day</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={dailyLimit}
                    onChange={(e) => setDailyLimit(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500">Recommended: 35–45 to ensure 100% account safety</span>
                </div>

                {/* Delay Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">Min Delay (seconds)</label>
                    <input
                      type="number"
                      value={minDelay}
                      onChange={(e) => setMinDelay(Number(e.target.value))}
                      className="w-full bg-[#080c14] border border-white/10 rounded-lg p-2 text-white"
                      min={10}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400 text-[11px]">Max Delay (seconds)</label>
                    <input
                      type="number"
                      value={maxDelay}
                      onChange={(e) => setMaxDelay(Number(e.target.value))}
                      className="w-full bg-[#080c14] border border-white/10 rounded-lg p-2 text-white"
                      min={20}
                    />
                  </div>
                </div>

                {/* Min Score Filter */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Minimum Lead Quality Score Gate:</span>
                    <span className="font-mono font-bold text-white">{minScore} / 100</span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={90}
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500">Only Priority A & B prospects will be messaged</span>
                </div>

                {/* Auto-Email Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#080c14] border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-blue-400" />
                      Auto-Send Cold Emails
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Dispatches AI emails when leads list a verified email address
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableEmail}
                    onChange={(e) => setEnableEmail(e.target.checked)}
                    className="h-4 w-4 accent-blue-500 cursor-pointer"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={handleSaveConfig}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Save Pacing Configuration
                </button>
              </div>
            </div>

            {/* Multi-Touch Automated Follow-Up Engine Card */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-amber-500/20 space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-amber-400" />
                    Multi-Touch Follow-Up Engine
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Automated sequence across WhatsApp & Gmail (+300% reply rate)</p>
                </div>
                {engineState?.pendingFollowUpsDue > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                    {engineState.pendingFollowUpsDue} Due
                  </span>
                )}
              </div>

              <div className="space-y-4 text-xs">
                {/* Master Toggle */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#080c14] border border-white/5">
                  <div className="space-y-0.5">
                    <span className="text-white text-xs font-semibold flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Enable Auto Follow-Ups
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Paced follow-ups sent only if no reply is received
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={enableFollowUps}
                    onChange={(e) => setEnableFollowUps(e.target.checked)}
                    className="h-4 w-4 accent-amber-500 cursor-pointer"
                  />
                </div>

                {/* Cadence Interval */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Days Between Follow-Ups:</span>
                    <span className="font-mono font-bold text-white">{followUpIntervalDays} {followUpIntervalDays === 1 ? "day" : "days"} ({followUpIntervalDays * 24}h)</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={followUpIntervalDays}
                    onChange={(e) => setFollowUpIntervalDays(Number(e.target.value))}
                    className="w-full accent-amber-500 cursor-pointer"
                    disabled={!enableFollowUps}
                  />
                  <span className="text-[10px] text-slate-500">Recommended: 2 days (48h) for optimal B2B engagement</span>
                </div>

                {/* Max Follow-ups */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Max Sequence Touches:</span>
                    <span className="font-mono font-bold text-white">Up to {maxFollowUps} follow-ups ({maxFollowUps + 1} total touches)</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setMaxFollowUps(num)}
                        disabled={!enableFollowUps}
                        className={`py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                          maxFollowUps === num
                            ? "bg-amber-500/20 border-amber-500 text-amber-300 font-bold"
                            : "bg-[#080c14] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {num} {num === 1 ? "Touch" : "Touches"}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 flex flex-col gap-0.5 pt-0.5">
                    <span>• Touch 1: Value bump & soft check-in</span>
                    <span>• Touch 2: Social proof & feature win</span>
                    {maxFollowUps >= 3 && <span>• Touch 3: Courteous breakup message</span>}
                  </div>
                </div>

                {/* Anti-Spam Halt Guarantee Alert */}
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] leading-relaxed flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Instant Halt Rule Active:</strong> The millisecond a lead replies via WhatsApp or email, their status becomes <em>MEETING/REPLIED</em> and all future automated follow-ups immediately freeze.
                  </span>
                </div>

                {/* Save Follow-Up Settings */}
                <button
                  onClick={handleSaveConfig}
                  disabled={actionLoading}
                  className="w-full py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Save Follow-Up Cadence
                </button>
              </div>
            </div>
          </div>

          {/* Right Column (7 cols): Live Activity Stream & Inbound Replies */}
          <div className="lg:col-span-7 space-y-6">
            {/* Live Activity Stream */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${engineState?.isActive ? "bg-emerald-400 animate-ping" : "bg-slate-500"}`} />
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Live Outbound Execution Stream
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Auto-refreshing</span>
              </div>

              {!engineState?.logs || engineState.logs.length === 0 ? (
                <div className="p-12 text-center rounded-xl bg-[#080c14] border border-dashed border-white/10 space-y-2">
                  <Radio className="h-8 w-8 text-slate-600 mx-auto" />
                  <h4 className="text-xs font-bold text-slate-300">No Outbound Events Logged Yet</h4>
                  <p className="text-[11px] text-slate-500">
                    Click <strong>&quot;Start 24/7 Auto-Pilot&quot;</strong> or <strong>&quot;Run 1 Cycle Now&quot;</strong> above to start autonomous prospecting.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                  {engineState.logs.map((log: any) => {
                    const isSent = log.type === "WHATSAPP_SENT";
                    const isError = log.type === "WHATSAPP_ERROR";
                    const isAudit = log.type === "AUDIT";
                    const isDiscovery = log.type === "DISCOVERY";

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border text-xs transition flex items-start gap-3 ${
                          isSent
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                            : isError
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                            : isAudit
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-200"
                            : isDiscovery
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-200"
                            : "bg-[#080c14] border-white/5 text-slate-300"
                        }`}
                      >
                        <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 mt-0.5">
                          {log.timestamp}
                        </span>

                        <div className="space-y-0.5 flex-1 min-w-0">
                          <p className="font-medium leading-relaxed break-words">{log.message}</p>
                          {log.businessName && (
                            <div className="text-[10px] opacity-80 flex items-center gap-2 mt-1">
                              <span>Prospect: <strong>{log.businessName}</strong></span>
                              {log.phone && <span>• {log.phone}</span>}
                              {log.score && <span>• Score: {log.score}/100</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Inbound Replies Drawer */}
            <div className="p-5 rounded-xl bg-[#0d1322] border border-white/[0.07] space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="h-4 w-4 text-emerald-400" />
                  <span>Incoming Client WhatsApp Replies ({waState?.recentInbound?.length || 0})</span>
                </h3>
              </div>

              {!waState?.recentInbound || waState.recentInbound.length === 0 ? (
                <div className="p-6 text-center rounded-lg bg-[#080c14] border border-dashed border-white/5 text-xs text-slate-500">
                  No incoming client replies recorded yet. When a business owner texts back, it will appear here and buzz your phone!
                </div>
              ) : (
                <div className="space-y-2">
                  {waState.recentInbound.map((inb: any) => (
                    <div
                      key={inb.id}
                      className="p-3.5 rounded-lg bg-[#080c14] border border-emerald-500/30 flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">+{inb.senderPhone}</span>
                          {inb.matchedBusinessName && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold border border-emerald-500/30">
                              {inb.matchedBusinessName}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(inb.receivedAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-200 italic bg-black/40 p-2 rounded border border-white/5">
                          &ldquo;{inb.messageText}&rdquo;
                        </p>
                      </div>

                      {inb.matchedBusinessId && (
                        <Link
                          href={`/leads/${inb.matchedBusinessId}`}
                          className="px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 font-semibold text-[11px] border border-indigo-500/30 flex-shrink-0 transition"
                        >
                          Inspect Lead
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp QR Modal */}
      <WhatsAppConnectModal
        isOpen={isWaModalOpen}
        onClose={() => setIsWaModalOpen(false)}
        onConnected={() => fetchData()}
      />
    </div>
  );
}
