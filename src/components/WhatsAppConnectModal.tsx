"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Smartphone,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Sparkles,
  Zap,
  ShieldCheck,
} from "lucide-react";

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: () => void;
}

export function WhatsAppConnectModal({ isOpen, onClose, onConnected }: WhatsAppConnectModalProps) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [state, setState] = useState<any>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const data = await res.json();
      if (data.success) {
        setState(data.data);
        if (data.data.status === "CONNECTED" && onConnected) {
          onConnected();
        }
      }
    } catch (err) {
      console.error("Failed to fetch WhatsApp status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    fetchStatus().then(() => {
      // Auto-trigger QR generation if currently disconnected
      fetch("/api/whatsapp/status")
        .then((r) => r.json())
        .then((d) => {
          if (d.success && d.data.status === "DISCONNECTED") {
            handleConnect();
          }
        })
        .catch(() => null);
    });

    // Poll every 2.5 seconds while modal is open
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [isOpen]);

  const handleConnect = async (forceNew = false) => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", forceNewSession: forceNew }),
      });
      const data = await res.json();
      if (data.success) {
        setState(data.data);
      }
    } catch (err) {
      console.error("Failed to initialize WhatsApp:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (data.success) {
        setState(data.data);
      }
    } catch (err) {
      console.error("Failed to reset session:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect this WhatsApp session?")) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/whatsapp/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      const data = await res.json();
      if (data.success) {
        setState(data.data);
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const isConnected = state?.status === "CONNECTED";
  const isQrReady = state?.status === "QR_READY" && state?.qrCodeDataUrl;
  const isInitializing = state?.status === "INITIALIZING" || state?.status === "RECONNECTING" || actionLoading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#0d1322] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>WhatsApp Pairing & Multi-Device</span>
                {isConnected && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]">
                    Active
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">Connect your personal or business WhatsApp to automate outbound</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-7 w-7 rounded-lg bg-slate-900 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {isConnected ? (
            /* Connected State */
            <div className="space-y-5 text-center">
              <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h3 className="text-sm font-bold text-white">WhatsApp Paired Successfully!</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Your WhatsApp is linked. Outbound messages will be sent directly through your number, and incoming replies will appear right on your phone.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#080c14] border border-white/5 space-y-2 text-xs text-left max-w-sm mx-auto">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Connected Number:</span>
                  <span className="font-mono font-bold text-emerald-400">+{state.phoneNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Account Name:</span>
                  <span className="font-medium text-slate-200">{state.userName || "WhatsApp User"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Multi-Device Status:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> End-to-End Encrypted
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Done & Continue
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Unlink Session</span>
                </button>
              </div>
            </div>
          ) : (
            /* QR / Disconnected State */
            <div className="space-y-5">
              {isQrReady ? (
                /* QR Code Available */
                <div className="space-y-4 text-center">
                  <div className="inline-block p-3.5 bg-white rounded-2xl shadow-xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={state.qrCodeDataUrl} alt="WhatsApp QR Code" className="w-52 h-52 mx-auto rounded-lg" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                      <QrCode className="h-4 w-4 text-emerald-400" />
                      Scan QR Code with WhatsApp
                    </h3>
                    <p className="text-[11px] text-slate-400">QR code refreshes automatically every 20 seconds</p>
                  </div>

                  <div className="pt-1">
                    <button
                      onClick={handleReset}
                      disabled={actionLoading}
                      className="text-[11px] text-slate-400 hover:text-emerald-400 flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-lg hover:bg-white/5 transition cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${actionLoading ? "animate-spin" : ""}`} />
                      <span>Not scanning? Click to generate fresh QR</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Connect Prompt / Initializing */
                <div className="p-6 rounded-xl bg-[#080c14] border border-dashed border-white/10 text-center space-y-4">
                  <div className="h-12 w-12 mx-auto rounded-xl bg-slate-900 text-slate-400 flex items-center justify-center border border-white/5">
                    {isInitializing ? (
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
                    ) : (
                      <Smartphone className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-white">
                      {isInitializing ? "Initializing WhatsApp Multi-Device..." : "WhatsApp Disconnected"}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-1">
                      {isInitializing
                        ? "Generating authentication handshake with WhatsApp Web..."
                        : "Click below to generate a QR code and pair your phone."}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    {!isInitializing ? (
                      <button
                        onClick={() => handleConnect(true)}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        <span>Generate QR Code</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleReset}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] border border-white/10 transition cursor-pointer"
                      >
                        <RefreshCw className={`h-3 w-3 ${actionLoading ? "animate-spin" : ""}`} />
                        <span>Stuck? Reset Session</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Instructions Steps */}
              <div className="p-4 rounded-xl bg-[#080c14] border border-white/5 space-y-2.5 text-xs text-slate-300">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  How to Pair Your Phone:
                </span>
                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-slate-900 border border-white/10 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your phone.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-slate-900 border border-white/10 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      2
                    </span>
                    <span>Go to <strong>Settings</strong> $\rightarrow$ <strong>Linked Devices</strong>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="h-4 w-4 rounded-full bg-slate-900 border border-white/10 text-slate-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      3
                    </span>
                    <span>Tap <strong>Link a Device</strong> and point your camera at this QR code.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
