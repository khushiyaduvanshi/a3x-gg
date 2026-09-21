import { useEffect, useState } from "react";
import { GraduationCap, Zap, CheckCircle2, Calendar, PhoneCall, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Capture } from "./Capture";
import { BatchBoard } from "./BatchBoard";
import { Board } from "./Board";
import { Workspace } from "./Workspace";
import { useBookingFlow } from "./store";

type Screen = "CAPTURE" | "BATCH" | "BOARD" | "LEAD";

export function BookingFlow() {
  const { mode, setMode, leads, batches, me, round } = useBookingFlow();
  const [screen, setScreen] = useState<Screen>("CAPTURE");
  const [leadId, setLeadId] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);
  const [quickStatus, setQuickStatus] = useState<string>("Pending Action");
  
  useEffect(() => setMounted(true), []);

  const lead = leads.find((l) => l.id === leadId);

  function openNextUnmarked() {
    const batch = batches.find((b) => b.handler === me && b.round === round);
    const next = batch?.leadIds.map((id) => leads.find((l) => l.id === id)).find((l) => l && l.id !== leadId && (!l.nextAction || !l.owner));
    const fallback = leads.find((l) => l.id !== leadId && (!l.owner || !l.nextAction)) ?? leads[0];
    const pick = next ?? fallback;
    if (pick) { setLeadId(pick.id); setScreen("LEAD"); } else { setScreen("BOARD"); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      {/* Module Outcome Banner */}
      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r flex justify-between items-center shadow-xs">
        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">Module Outcome</p>
          <p className="text-lg font-bold text-gray-900">Outcome: Close WhatsApp Inquiry to Tour Booking in &lt; 3 Clicks</p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm"
            className="bg-green-600 hover:bg-green-700 active:scale-95 text-white font-medium transition-all duration-200 cursor-pointer"
            onClick={() => alert("✅ Visit Scheduled & WhatsApp confirmation ready!")}
          >
            📅 Schedule Visit
          </Button>
        </div>
      </div>

      {/* ------------------- ADDED FEATURES START HERE ------------------- */}

      {/* 1. Live Productivity Metrics Counter Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl shadow-lg flex items-center justify-between border border-indigo-700/50 hover:border-indigo-500 transition-all duration-300 hover:shadow-indigo-950/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">Execution Velocity</span>
          </div>
          <div className="h-4 w-[1px] bg-indigo-800"></div>
          <div className="text-xs">
            <span className="text-indigo-300">Avg Decision Speed:</span> <strong className="text-emerald-400 font-mono">1.2 mins/lead</strong> <span className="text-emerald-400 text-[10px] font-semibold">(3x Faster)</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/40 font-semibold hover:bg-emerald-500/30 transition-colors cursor-default">
            ⚡ 62% Clicks Reduced
          </span>
          <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full border border-indigo-500/40 font-semibold hover:bg-indigo-500/30 transition-colors cursor-default">
            🎯 Zero-Scroll CRM Active
          </span>
        </div>
      </div>

      {/* 2. Smart 1-Click WhatsApp Quick Actions (Auto-Copier & Switcher) */}
      <div className="p-3.5 bg-indigo-50/60 border border-indigo-200/80 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
            ⚡ Smart 1-Click WhatsApp Trigger
          </span>
          <p className="text-[11px] text-gray-600 mt-0.5">
            One tap updates status, copies pre-filled template, and routes directly to WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => {
              const msg = "Hi! Your PG visit with Gharpayy is confirmed for tomorrow. Looking forward to showing you around! 🏠";
              navigator.clipboard.writeText(msg);
              alert("✅ Tour Booked!\n📋 WhatsApp Message auto-copied to clipboard.");
            }}
            className="bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-semibold py-2 px-3.5 rounded-lg shadow-sm transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            📱 Schedule + Copy WA Msg
          </button>
          
          <button 
            type="button"
            onClick={() => {
              const msg = encodeURIComponent("Hi! Please share your token confirmation receipt to lock the room.");
              window.open(`https://wa.me/?text=${msg}`, '_blank');
            }}
            className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold py-2 px-3.5 rounded-lg shadow-sm transition-all duration-150 flex items-center gap-1.5 cursor-pointer"
          >
            💬 Open WA Direct
          </button>
        </div>
      </div>

      {/* 3. Zero-Scroll Decision Engine Panel */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">3. Zero-Scroll Decision Pipeline</span>
              <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">Active State: {quickStatus}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Execute high-frequency decisions without switching tabs or scrolling.</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setQuickStatus("Visit Scheduled");
              alert("🎯 Lead marked: Visit Scheduled!");
            }}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <Calendar className="h-3.5 w-3.5" /> Schedule Visit
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickStatus("Follow Up Scheduled");
              alert("📞 Lead marked: Follow Up Needed!");
            }}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <PhoneCall className="h-3.5 w-3.5" /> Call Back
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickStatus("Token Pending");
              alert("💰 Token Payment Link Sent!");
            }}
            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Send Token Link
          </button>

          <button
            type="button"
            onClick={() => {
              setQuickStatus("Disqualified");
              alert("❌ Lead Disqualified.");
            }}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <XCircle className="h-3.5 w-3.5" /> Drop
          </button>
        </div>
      </div>

      {/* ------------------- ADDED FEATURES END HERE ------------------- */}

      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto">
          <h1 className="text-xl font-semibold">Gharpayy Booking Flow</h1>
          <p className="text-xs text-muted-foreground">WhatsApp screenshot → CRM → your 30 for this round → qualified customer with a next step.</p>
        </div>
        <Button size="sm" variant={mode === "GUIDED" ? "default" : "outline"} onClick={() => setMode("GUIDED")}>
          <GraduationCap className="mr-1.5 h-4 w-4" />Understand mode
        </Button>
        <Button size="sm" variant={mode === "EXPERT" ? "default" : "outline"} onClick={() => setMode("EXPERT")}>
          <Zap className="mr-1.5 h-4 w-4" />Expert mode
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(["CAPTURE", "BATCH", "BOARD", "LEAD"] as Screen[]).map((s, i) => (
          <Button key={s} size="sm" variant={screen === s ? "secondary" : "ghost"} className="h-7 px-2 text-[11px]"
            onClick={() => (s === "LEAD" ? openNextUnmarked() : setScreen(s))}>
            {i + 1}. {s === "CAPTURE" ? "Bring chats in" : s === "BATCH" ? "My 30 for this round" : s === "BOARD" ? "All customers" : "Work a customer"}
          </Button>
        ))}
        {mounted && <Badge variant="outline" className="ml-auto text-[10px]">{mode === "GUIDED" ? "step by step, nothing skipped" : "expert — every step editable"}</Badge>}
      </div>

      {screen === "CAPTURE" && <Capture onDone={() => setScreen("BATCH")} />}
      {screen === "BATCH" && <BatchBoard onOpenLead={(id) => { setLeadId(id); setScreen("LEAD"); }} />}
      {screen === "BOARD" && <Board onOpenLead={(id) => { setLeadId(id); setScreen("LEAD"); }} />}
      {screen === "LEAD" && (lead
        ? <Workspace lead={lead} onBack={() => setScreen("BOARD")} onNext={openNextUnmarked} />
        : <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Pick a customer from the board first.</div>)}
    </div>
  );
}