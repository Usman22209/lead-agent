"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  BrainCircuit,
  RefreshCw,
  ExternalLink,
  Sparkles,
  MapPin,
  Database,
  Info,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [googlePlacesKey, setGooglePlacesKey] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    models?: string[];
    error?: string;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedGemini = localStorage.getItem("GEMINI_API_KEY") || "";
      const storedPlaces = localStorage.getItem("GOOGLE_PLACES_API_KEY") || "";
      setGeminiApiKey(storedGemini);
      setGooglePlacesKey(storedPlaces);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestGemini = async () => {
    if (!geminiApiKey.trim()) {
      setTestResult({ error: "Please enter a Gemini API Key first." });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey.trim()}`
      );
      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}: Check key permissions`);
      }
      const data = await res.json();
      const models = (data.models || [])
        .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
        .map((m: any) => m.name.replace(/^models\//, ""))
        .slice(0, 5);

      setTestResult({
        success: true,
        models,
      });
    } catch (err: any) {
      setTestResult({ error: err.message || "Failed to validate key." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("GEMINI_API_KEY", geminiApiKey.trim());
      localStorage.setItem("GOOGLE_PLACES_API_KEY", googlePlacesKey.trim());
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0d1322] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <BrainCircuit className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">
                API Configuration
              </h2>
              <p className="text-[11px] text-slate-400">Google Gemini AI & Google Places Settings</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* How Data Comes Explanation Banner */}
          <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-slate-300">
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              <span>Data Engine Architecture</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              If a Google Places API key is added below, the engine makes live API calls to Google Maps. Without a key, the intelligent local engine generates realistic SMB data sandbox profiles for zero-cost testing.
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-indigo-400" />
                Google Gemini API Key
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-400 hover:underline flex items-center gap-0.5"
              >
                Google AI Studio <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
            <div className="flex items-center justify-between pt-0.5">
              <p className="text-[10px] text-slate-500">
                Cascades across <code>gemini-2.5-flash</code>, <code>gemini-2.0-flash</code>, etc.
              </p>
              <button
                type="button"
                onClick={handleTestGemini}
                disabled={isTesting || !geminiApiKey.trim()}
                className="px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-medium border border-indigo-500/30 transition disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                {isTesting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Test Connection
              </button>
            </div>
          </div>

          {/* Test Results Output */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs ${
                testResult.success
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <div>
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Key Verified! Active models discovered:
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {testResult.models?.map((m) => (
                      <span
                        key={m}
                        className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/50 text-[10px] font-mono"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-rose-400 flex-shrink-0" />
                  <span>{testResult.error}</span>
                </div>
              )}
            </div>
          )}

          {/* Google Places API Key */}
          <div className="space-y-2 pt-2 border-t border-white/[0.07]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-rose-400" />
                Google Places API Key (Optional)
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Optional</span>
            </div>
            <input
              type="password"
              value={googlePlacesKey}
              onChange={(e) => setGooglePlacesKey(e.target.value)}
              placeholder="Leave empty for offline sandbox testing"
              className="w-full bg-[#080c14] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.07] bg-slate-950/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Keys stored locally in browser and <code>.env</code></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Saved!
                </>
              ) : (
                "Save Configuration"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
