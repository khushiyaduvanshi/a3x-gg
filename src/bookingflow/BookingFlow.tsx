import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Zap,
  CheckCircle2,
  Calendar,
  PhoneCall,
  XCircle,
  Flame,
  Clock3,
  UserRound,
  MessageCircle,
  Copy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Capture } from "./Capture";
import { BatchBoard } from "./BatchBoard";
import { Board } from "./Board";
import { Workspace } from "./Workspace";
import { useBookingFlow } from "./store";

type Screen = "CAPTURE" | "BATCH" | "BOARD" | "LEAD";

type Priority = "HOT" | "WARM" | "COLD";

type ActionStatus =
  | "Pending Action"
  | "Visit Scheduled"
  | "Follow Up Scheduled"
  | "Token Pending"
  | "Disqualified";

type ActionItem = {
  id: string;
  title: string;
  note: string;
  dueAt: string;
  priority: Priority;
};

function getLeadName(lead: any) {
  return (
    lead?.name ||
    lead?.fullName ||
    lead?.customerName ||
    lead?.leadName ||
    "Customer"
  );
}

function getLeadPhone(lead: any) {
  return lead?.phone || lead?.mobile || lead?.phoneNumber || "";
}

function getLeadOutcome(lead: any) {
  return String(
    lead?.outcome ||
      lead?.status ||
      lead?.stage ||
      lead?.intent ||
      ""
  ).toLowerCase();
}

function calculatePriority(lead: any): {
  priority: Priority;
  score: number;
  reason: string;
} {
  let score = 0;
  const reasons: string[] = [];

  const outcome = getLeadOutcome(lead);

  if (
    outcome.includes("hot") ||
    outcome.includes("interested") ||
    outcome.includes("qualified")
  ) {
    score += 40;
    reasons.push("High intent");
  }

  if (
    outcome.includes("tour") ||
    outcome.includes("visit") ||
    outcome.includes("booking")
  ) {
    score += 30;
    reasons.push("Tour/booking intent");
  }

  if (lead?.nextAction) {
    score += 15;
    reasons.push("Next action exists");
  } else {
    score += 20;
    reasons.push("Needs next action");
  }

  if (lead?.owner) {
    score += 5;
  } else {
    score += 10;
    reasons.push("Needs owner");
  }

  if (score >= 60) {
    return {
      priority: "HOT",
      score,
      reason: reasons.join(" • ") || "High priority",
    };
  }

  if (score >= 30) {
    return {
      priority: "WARM",
      score,
      reason: reasons.join(" • ") || "Medium priority",
    };
  }

  return {
    priority: "COLD",
    score,
    reason: reasons.join(" • ") || "Low priority",
  };
}

function priorityClasses(priority: Priority) {
  if (priority === "HOT") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "WARM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-blue-200 bg-blue-50 text-blue-700";
}

function priorityIcon(priority: Priority) {
  if (priority === "HOT") return "🔥";
  if (priority === "WARM") return "🟡";
  return "🔵";
}

export function BookingFlow() {
  const {
    mode,
    setMode,
    leads,
    batches,
    me,
    round,
  } = useBookingFlow();

  const [screen, setScreen] = useState<Screen>("CAPTURE");
  const [leadId, setLeadId] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);

  const [quickStatus, setQuickStatus] =
    useState<ActionStatus>("Pending Action");

  const [actionMessage, setActionMessage] =
    useState("Select an action to update the customer.");

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const lead = leads.find((l) => l.id === leadId);

  /*
   * ------------------------------------------------------------
   * SMART PRIORITY
   * ------------------------------------------------------------
   */

  const priorityStats = useMemo(() => {
    const stats = {
      HOT: 0,
      WARM: 0,
      COLD: 0,
    };

    leads.forEach((item) => {
      const result = calculatePriority(item);

      stats[result.priority] += 1;
    });

    return stats;
  }, [leads]);

  /*
   * ------------------------------------------------------------
   * ACTIONED / PENDING METRICS
   * ------------------------------------------------------------
   */

  const actionedCount = useMemo(() => {
    return leads.filter(
      (item) => Boolean(item.nextAction && item.owner)
    ).length;
  }, [leads]);

  const pendingCount = Math.max(
    leads.length - actionedCount,
    0
  );

  const actionRate = leads.length
    ? Math.round((actionedCount / leads.length) * 100)
    : 0;

  /*
   * ------------------------------------------------------------
   * PRIORITY QUEUE
   * ------------------------------------------------------------
   */

  const priorityQueue = useMemo<ActionItem[]>(() => {
    return leads
      .filter((item) => item.id !== leadId)
      .map((item) => {
        const result = calculatePriority(item);

        return {
          id: item.id,
          title: getLeadName(item),
          note:
            item.nextAction ||
            (result.priority === "HOT"
              ? "High-intent customer needs immediate action"
              : result.priority === "WARM"
                ? "Follow up and qualify customer"
                : "Review customer requirement"),
          dueAt:
            item.nextAction ||
            "Next action not scheduled",
          priority: result.priority,
        };
      })
      .sort((a, b) => {
        const order = {
          HOT: 3,
          WARM: 2,
          COLD: 1,
        };

        return order[b.priority] - order[a.priority];
      })
      .slice(0, 5);
  }, [leads, leadId]);

  /*
   * ------------------------------------------------------------
   * OPEN NEXT CUSTOMER
   * ------------------------------------------------------------
   */

  function openNextUnmarked() {
    const batch = batches.find(
      (b) => b.handler === me && b.round === round
    );

    const batchLeads =
      batch?.leadIds
        .map((id) => leads.find((l) => l.id === id))
        .filter(Boolean) ?? [];

    const sortedBatchLeads = [...batchLeads].sort((a: any, b: any) => {
      const priorityOrder = {
        HOT: 3,
        WARM: 2,
        COLD: 1,
      };

      const pa = calculatePriority(a).priority;
      const pb = calculatePriority(b).priority;

      return priorityOrder[pb] - priorityOrder[pa];
    });

    const next = sortedBatchLeads.find(
      (l: any) =>
        l &&
        l.id !== leadId &&
        (!l.nextAction || !l.owner)
    );

    const fallback =
      leads
        .filter((l) => l.id !== leadId)
        .sort((a, b) => {
          const priorityOrder = {
            HOT: 3,
            WARM: 2,
            COLD: 1,
          };

          return (
            priorityOrder[calculatePriority(b).priority] -
            priorityOrder[calculatePriority(a).priority]
          );
        })[0] ?? leads[0];

    const pick = next ?? fallback;

    if (pick) {
      setLeadId(pick.id);
      setScreen("LEAD");
      setQuickStatus("Pending Action");
      setActionMessage(
        `${getLeadName(pick)} is ready for the next action.`
      );
    } else {
      setScreen("BOARD");
    }
  }

  /*
   * ------------------------------------------------------------
   * WHATSAPP MESSAGE
   * ------------------------------------------------------------
   */

  function buildWhatsAppMessage(
    action: "visit" | "followup" | "token"
  ) {
    const name = getLeadName(lead);

    if (action === "visit") {
      return `Hi ${name}, your PG visit with Gharpayy is scheduled. Please confirm your availability. 🏠`;
    }

    if (action === "followup") {
      return `Hi ${name}, just following up regarding your PG requirement. Please let us know a convenient time to connect.`;
    }

    return `Hi ${name}, please share your token confirmation receipt to proceed with locking the room.`;
  }

  async function copyWhatsAppMessage(
    action: "visit" | "followup" | "token"
  ) {
    const message = buildWhatsAppMessage(action);

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      setCopied(false);
    }

    setActionMessage("WhatsApp message copied successfully.");
  }

  function openWhatsApp(action: "visit" | "followup" | "token") {
    const message = encodeURIComponent(
      buildWhatsAppMessage(action)
    );

    const phone = getLeadPhone(lead).replace(/\D/g, "");

    const url = phone
      ? `https://wa.me/${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;

    window.open(url, "_blank", "noopener,noreferrer");

    setActionMessage("WhatsApp opened with a pre-filled message.");
  }

  /*
   * ------------------------------------------------------------
   * QUICK ACTIONS
   * ------------------------------------------------------------
   */

  function handleScheduleVisit() {
    if (!lead) {
      setActionMessage("Please select a customer first.");
      setScreen("LEAD");
      return;
    }

    setQuickStatus("Visit Scheduled");

    setActionMessage(
      `Visit scheduled for ${getLeadName(
        lead
      )}. Next step: confirm visit.`
    );
  }

  function handleFollowUp() {
    if (!lead) {
      setActionMessage("Please select a customer first.");
      setScreen("LEAD");
      return;
    }

    setQuickStatus("Follow Up Scheduled");

    setActionMessage(
      `Follow-up created for ${getLeadName(lead)}.`
    );
  }

  function handleToken() {
    if (!lead) {
      setActionMessage("Please select a customer first.");
      setScreen("LEAD");
      return;
    }

    setQuickStatus("Token Pending");

    setActionMessage(
      `Token follow-up started for ${getLeadName(lead)}.`
    );
  }

  function handleDrop() {
    if (!lead) {
      setActionMessage("Please select a customer first.");
      setScreen("LEAD");
      return;
    }

    setQuickStatus("Disqualified");

    setActionMessage(
      `${getLeadName(lead)} marked for disqualification review.`
    );
  }

  /*
   * ------------------------------------------------------------
   * CURRENT LEAD PRIORITY
   * ------------------------------------------------------------
   */

  const currentPriority = lead
    ? calculatePriority(lead)
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">

      {/* ======================================================
          MODULE OUTCOME
      ======================================================= */}

      <div className="bg-indigo-50 border-l-4 border-indigo-600 p-4 rounded-r flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 shadow-xs">

        <div>
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
            Module Outcome
          </p>

          <p className="text-lg font-bold text-gray-900">
            Outcome: Close WhatsApp Inquiry to Tour Booking in &lt; 3 Clicks
          </p>

          <p className="text-xs text-gray-600 mt-1">
            One customer → one workflow → one clear next action.
          </p>
        </div>

        <Button
          size="sm"
          className="bg-green-600 hover:bg-green-700 text-white"
          onClick={handleScheduleVisit}
        >
          <Calendar className="mr-1.5 h-4 w-4" />
          Schedule Visit
        </Button>
      </div>

      {/* ======================================================
          REAL-TIME OPERATIONS SUMMARY
      ======================================================= */}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold">
            Total Leads
          </p>
          <p className="text-xl font-bold mt-1">
            {leads.length}
          </p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-red-600 font-semibold">
            Hot
          </p>
          <p className="text-xl font-bold text-red-700 mt-1">
            {priorityStats.HOT}
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-amber-600 font-semibold">
            Warm
          </p>
          <p className="text-xl font-bold text-amber-700 mt-1">
            {priorityStats.WARM}
          </p>
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 shadow-sm">
          <p className="text-[10px] uppercase text-blue-600 font-semibold">
            Cold
          </p>
          <p className="text-xl font-bold text-blue-700 mt-1">
            {priorityStats.COLD}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] uppercase text-muted-foreground font-semibold">
            Actioned
          </p>
          <p className="text-xl font-bold mt-1">
            {actionRate}%
          </p>
        </div>

      </div>

      {/* ======================================================
          EXECUTION VELOCITY
      ======================================================= */}

      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-xl shadow-lg border border-indigo-700/50">

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          <div className="flex items-center gap-3">

            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-200">
                Execution Velocity
              </p>

              <p className="text-xs text-indigo-300 mt-1">
                {actionedCount} actioned • {pendingCount} pending
              </p>
            </div>

          </div>

          <div className="flex flex-wrap gap-2">

            <span className="bg-emerald-500/20 text-emerald-300 text-xs px-3 py-1 rounded-full border border-emerald-500/40 font-semibold">
              ⚡ {actionRate}% Leads Actioned
            </span>

            <span className="bg-indigo-500/20 text-indigo-300 text-xs px-3 py-1 rounded-full border border-indigo-500/40 font-semibold">
              🎯 Zero-Scroll CRM
            </span>

          </div>

        </div>

      </div>

      {/* ======================================================
          SMART WHATSAPP ACTIONS
      ======================================================= */}

      <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl shadow-xs">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

          <div>

            <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4" />
              Smart WhatsApp Actions
            </span>

            <p className="text-[11px] text-gray-600 mt-1">
              One action creates the next step and prepares the customer message.
            </p>

            {lead && (
              <p className="text-xs font-semibold text-gray-800 mt-2">
                Current customer: {getLeadName(lead)}
              </p>
            )}

          </div>

          <div className="flex flex-wrap items-center gap-2">

            <Button
              size="sm"
              variant="outline"
              disabled={!lead}
              onClick={() => copyWhatsAppMessage("visit")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy Visit Msg"}
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={!lead}
              onClick={() => openWhatsApp("visit")}
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Open WhatsApp
            </Button>

          </div>

        </div>

        {actionMessage && (
          <div className="mt-3 rounded-lg bg-white border px-3 py-2 text-xs text-gray-700">
            {actionMessage}
          </div>
        )}

      </div>

      {/* ======================================================
          ZERO SCROLL DECISION ENGINE
      ======================================================= */}

      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">

          <div className="flex items-center gap-3">

            <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
              <Zap className="h-5 w-5" />
            </div>

            <div>

              <div className="flex flex-wrap items-center gap-2">

                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Zero-Scroll Decision Pipeline
                </span>

                <span className="text-[10px] bg-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded">
                  {quickStatus}
                </span>

                {currentPriority && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${priorityClasses(
                      currentPriority.priority
                    )}`}
                  >
                    {priorityIcon(currentPriority.priority)}{" "}
                    {currentPriority.priority}
                  </span>
                )}

              </div>

              <p className="text-[11px] text-slate-500 mt-1">
                Execute high-frequency decisions without switching tabs.
              </p>

            </div>

          </div>

          <div className="flex items-center gap-1.5 flex-wrap">

            <button
              type="button"
              onClick={handleScheduleVisit}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
            >
              <Calendar className="h-3.5 w-3.5" />
              Schedule Visit
            </button>

            <button
              type="button"
              onClick={handleFollowUp}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
            >
              <PhoneCall className="h-3.5 w-3.5" />
              Call Back
            </button>

            <button
              type="button"
              onClick={handleToken}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Token
            </button>

            <button
              type="button"
              onClick={handleDrop}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-md text-xs font-medium flex items-center gap-1 transition-all active:scale-95"
            >
              <XCircle className="h-3.5 w-3.5" />
              Drop
            </button>

          </div>

        </div>

      </div>

      {/* ======================================================
          PRIORITY QUEUE
      ======================================================= */}

      {priorityQueue.length > 0 && (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">

          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">

            <div>
              <h2 className="text-sm font-bold">
                My Priority Queue
              </h2>

              <p className="text-xs text-muted-foreground mt-0.5">
                Highest-intent customers appear first.
              </p>
            </div>

            <Badge variant="outline">
              {priorityQueue.length} customers
            </Badge>

          </div>

          <div className="divide-y">

            {priorityQueue.map((item) => (
              <div
                key={item.id}
                className="p-3 flex flex-col md:flex-row md:items-center gap-3 md:justify-between hover:bg-slate-50 transition-colors"
              >

                <div className="flex items-start gap-3">

                  <div
                    className={`h-9 w-9 rounded-full flex items-center justify-center border ${priorityClasses(
                      item.priority
                    )}`}
                  >
                    <Flame className="h-4 w-4" />
                  </div>

                  <div>

                    <div className="flex items-center gap-2">

                      <p className="text-sm font-semibold">
                        {item.title}
                      </p>

                      <Badge
                        variant="outline"
                        className={`text-[10px] ${priorityClasses(
                          item.priority
                        )}`}
                      >
                        {priorityIcon(item.priority)}{" "}
                        {item.priority}
                      </Badge>

                    </div>

                    <p className="text-xs text-gray-600 mt-0.5">
                      {item.note}
                    </p>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
                      <Clock3 className="h-3 w-3" />
                      {item.dueAt}
                    </div>

                  </div>

                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setLeadId(item.id);
                    setScreen("LEAD");
                    setQuickStatus("Pending Action");
                    setActionMessage(
                      `${item.title} opened from priority queue.`
                    );
                  }}
                >
                  <UserRound className="mr-1.5 h-3.5 w-3.5" />
                  Work Customer
                </Button>

              </div>
            ))}

          </div>

        </div>
      )}

      {/* ======================================================
          MODE + NAVIGATION
      ======================================================= */}

      <div className="flex flex-wrap items-center gap-2">

        <div className="mr-auto">

          <h1 className="text-xl font-semibold">
            Gharpayy Booking Flow
          </h1>

          <p className="text-xs text-muted-foreground">
            WhatsApp screenshot → CRM → qualified customer → clear next step.
          </p>

        </div>

        <Button
          size="sm"
          variant={mode === "GUIDED" ? "default" : "outline"}
          onClick={() => setMode("GUIDED")}
        >
          <GraduationCap className="mr-1.5 h-4 w-4" />
          Understand mode
        </Button>

        <Button
          size="sm"
          variant={mode === "EXPERT" ? "default" : "outline"}
          onClick={() => setMode("EXPERT")}
        >
          <Zap className="mr-1.5 h-4 w-4" />
          Expert mode
        </Button>

      </div>

      {/* ======================================================
          SCREEN NAVIGATION
      ======================================================= */}

      <div className="flex flex-wrap gap-1.5">

        {(
          ["CAPTURE", "BATCH", "BOARD", "LEAD"] as Screen[]
        ).map((s, i) => (

          <Button
            key={s}
            size="sm"
            variant={
              screen === s
                ? "secondary"
                : "ghost"
            }
            className="h-7 px-2 text-[11px]"
            onClick={() =>
              s === "LEAD"
                ? openNextUnmarked()
                : setScreen(s)
            }
          >
            {i + 1}.{" "}
            {s === "CAPTURE"
              ? "Bring chats in"
              : s === "BATCH"
                ? "My 30 for this round"
                : s === "BOARD"
                  ? "All customers"
                  : "Work a customer"}
          </Button>

        ))}

        {mounted && (
          <Badge
            variant="outline"
            className="ml-auto text-[10px]"
          >
            {mode === "GUIDED"
              ? "step by step, nothing skipped"
              : "expert — every step editable"}
          </Badge>
        )}

      </div>

      {/* ======================================================
          EXISTING SCREENS
      ======================================================= */}

      {screen === "CAPTURE" && (
        <Capture
          onDone={() => setScreen("BATCH")}
        />
      )}

      {screen === "BATCH" && (
        <BatchBoard
          onOpenLead={(id) => {
            setLeadId(id);
            setScreen("LEAD");
          }}
        />
      )}

      {screen === "BOARD" && (
        <Board
          onOpenLead={(id) => {
            setLeadId(id);
            setScreen("LEAD");
          }}
        />
      )}

      {screen === "LEAD" &&
        (lead ? (
          <Workspace
            lead={lead}
            onBack={() => setScreen("BOARD")}
            onNext={openNextUnmarked}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-5 w-5" />
            Pick a customer from the board first.
          </div>
        ))}

    </div>
  );
}