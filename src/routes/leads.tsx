import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/lib/store";
import { ConfidenceBar, IntentChip, StageBadge } from "@/components/atoms";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import type { LeadStage } from "@/lib/types";
import { useMountedNow } from "@/hooks/use-now";

import {
  LeadStackQueue,
  LeadFocusStack,
  LeadStageBoard,
  LeadMoveInBuckets,
  type LeadViewMode,
} from "@/components/leads/LeadViews";

export const Route = createFileRoute("/leads")({
  head: () => ({
    meta: [
      { title: "Leads — Gharpayy" },
      {
        name: "description",
        content:
          "Every lead, ranked by deal probability, one click into the control panel.",
      },
      { property: "og:title", content: "Leads — Gharpayy" },
      {
        property: "og:description",
        content:
          "Manage every lead through a clear five-call closing ladder.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeadsPage,
});

type Priority = "HOT" | "WARM" | "COLD";

function getPriority(
  confidence: number,
  stage: string,
  intent: string
): Priority {
  const strongStages = [
    "tour-scheduled",
    "tour-done",
    "negotiation",
  ];

  const strongIntent = [
    "high",
    "hot",
    "booking",
    "book",
    "interested",
  ].includes(intent.toLowerCase());

  if (
    confidence >= 80 ||
    strongStages.includes(stage) ||
    (confidence >= 65 && strongIntent)
  ) {
    return "HOT";
  }

  if (confidence >= 50 || strongIntent || stage === "contacted") {
    return "WARM";
  }

  return "COLD";
}

function priorityScore(
  confidence: number,
  stage: string,
  intent: string,
  budget: number
) {
  let score = confidence;

  const stageBonus: Record<string, number> = {
    new: 0,
    contacted: 5,
    "tour-scheduled": 15,
    "tour-done": 20,
    negotiation: 25,
    booked: 30,
    dropped: -30,
  };

  score += stageBonus[stage] ?? 0;

  const normalizedIntent = intent.toLowerCase();

  if (
    ["high", "hot", "booking", "book", "interested"].includes(
      normalizedIntent
    )
  ) {
    score += 10;
  }

  // Slightly prioritize higher-value opportunities.
  if (budget >= 50000) score += 5;
  if (budget >= 100000) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function priorityClasses(priority: Priority) {
  if (priority === "HOT") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (priority === "WARM") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function LeadsPage() {
  const { leads, tcms, selectLead } = useApp();
  const [, mounted] = useMountedNow();

  const [q, setQ] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [sortBy, setSortBy] = useState<
    "confidence" | "moveIn" | "updated" | "priority" | "budget"
  >("priority");

  const [view, setView] = useState<LeadViewMode>("table");

  /*
   * Add calculated CRM intelligence to every lead.
   * No new backend field is required.
   */
  const enrichedLeads = useMemo(() => {
    return leads.map((lead) => {
      const calculatedPriority = getPriority(
        lead.confidence,
        lead.stage,
        lead.intent
      );

      const score = priorityScore(
        lead.confidence,
        lead.stage,
        lead.intent,
        lead.budget
      );

      const ageMs = Date.now() - new Date(lead.updatedAt).getTime();
      const ageHours = ageMs / (1000 * 60 * 60);

      /*
       * A lead is considered attention-required when:
       * - it has been untouched for more than 24h
       * - or it is a high-intent opportunity
       * - but it is not already booked/dropped
       */
      const attentionRequired =
        lead.stage !== "booked" &&
        lead.stage !== "dropped" &&
        (ageHours >= 24 ||
          (calculatedPriority === "HOT" && lead.stage !== "tour-done"));

      return {
        ...lead,
        calculatedPriority,
        priorityScore: score,
        ageHours,
        attentionRequired,
      };
    });
  }, [leads]);

  const filtered = useMemo(() => {
    const list = enrichedLeads.filter((l) => {
      if (
        q &&
        !l.name.toLowerCase().includes(q.toLowerCase()) &&
        !l.phone.includes(q)
      ) {
        return false;
      }

      if (stage !== "all" && l.stage !== stage) {
        return false;
      }

      if (priority !== "all" && l.calculatedPriority !== priority) {
        return false;
      }

      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "confidence") {
        return b.confidence - a.confidence;
      }

      if (sortBy === "moveIn") {
        return (
          +new Date(a.moveInDate) -
          +new Date(b.moveInDate)
        );
      }

      if (sortBy === "updated") {
        return (
          +new Date(b.updatedAt) -
          +new Date(a.updatedAt)
        );
      }

      if (sortBy === "budget") {
        return b.budget - a.budget;
      }

      return b.priorityScore - a.priorityScore;
    });

    return list;
  }, [
    enrichedLeads,
    q,
    stage,
    priority,
    sortBy,
  ]);

  /*
   * Enhanced Excel export
   */
  const exportToExcel = () => {
    const data = filtered.map((lead) => ({
      Name: lead.name,
      Phone: lead.phone,
      Stage: lead.stage,
      Priority: lead.calculatedPriority,
      "Priority Score": lead.priorityScore,
      Intent: lead.intent,
      Confidence: lead.confidence,
      Area: lead.preferredArea,
      Budget: lead.budget,
      "Attention Required": lead.attentionRequired
        ? "YES"
        : "NO",
      "Move-in Date": lead.moveInDate,
      "Last Updated": lead.updatedAt,
      Assigned:
        tcms.find((t) => t.id === lead.assignedTcmId)?.name ??
        "Unassigned",
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Leads"
    );

    XLSX.writeFile(workbook, "Gharpayy-Leads-CRM.xlsx");
  };

  /*
   * CRM dashboard metrics
   */
  const totalLeads = leads.length;

  const bookedLeads = leads.filter(
    (lead) => lead.stage === "booked"
  ).length;

  const negotiationLeads = leads.filter(
    (lead) => lead.stage === "negotiation"
  ).length;

  const droppedLeads = leads.filter(
    (lead) => lead.stage === "dropped"
  ).length;

  const hotLeads = enrichedLeads.filter(
    (lead) => lead.calculatedPriority === "HOT"
  ).length;

  const attentionLeads = enrichedLeads.filter(
    (lead) => lead.attentionRequired
  ).length;

  const pipelineValue = leads
    .filter(
      (lead) =>
        lead.stage !== "booked" &&
        lead.stage !== "dropped"
    )
    .reduce(
      (total, lead) => total + Number(lead.budget || 0),
      0
    );

  const conversionRate =
    totalLeads > 0
      ? Math.round((bookedLeads / totalLeads) * 100)
      : 0;

  /*
   * Quick WhatsApp action
   */
  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, "");

    const message = encodeURIComponent(
      `Hi ${name}, this is Gharpayy. I wanted to follow up regarding your property requirement. Are you available for a quick discussion?`
    );

    window.open(
      `https://wa.me/${cleanPhone}?text=${message}`,
      "_blank"
    );
  };

  /*
   * Quick Call action
   */
  const callLead = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  return (
    <AppShell>
      <div className="space-y-4">

        {/* HEADER */}
        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Leads
            </h1>

            <p className="text-sm text-muted-foreground">
              {filtered.length} of {leads.length} · ranked by
              deal probability
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">

            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name or phone…"
              className="h-9 w-56 text-sm"
            />

            <Select
              value={stage}
              onValueChange={setStage}
            >
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All stages
                </SelectItem>

                {(
                  [
                    "new",
                    "contacted",
                    "tour-scheduled",
                    "tour-done",
                    "negotiation",
                    "booked",
                    "dropped",
                  ] as LeadStage[]
                ).map((s) => (
                  <SelectItem
                    key={s}
                    value={s}
                    className="capitalize"
                  >
                    {s.replace("-", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* NEW: PRIORITY FILTER */}
            <Select
              value={priority}
              onValueChange={setPriority}
            >
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="all">
                  All Priority
                </SelectItem>
                <SelectItem value="HOT">
                  🔥 HOT
                </SelectItem>
                <SelectItem value="WARM">
                  🟡 WARM
                </SelectItem>
                <SelectItem value="COLD">
                  ⚪ COLD
                </SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(v) =>
                setSortBy(v as typeof sortBy)
              }
            >
              <SelectTrigger className="h-9 w-44 text-sm">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="priority">
                  Sort: Smart Priority
                </SelectItem>

                <SelectItem value="confidence">
                  Sort: Confidence
                </SelectItem>

                <SelectItem value="moveIn">
                  Sort: Move-in date
                </SelectItem>

                <SelectItem value="updated">
                  Sort: Last updated
                </SelectItem>

                <SelectItem value="budget">
                  Sort: Budget
                </SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={exportToExcel}
              className="h-9"
            >
              Export Excel
            </Button>
          </div>
        </header>

        {/* SMART CRM DASHBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">

          <div className="border rounded-lg p-3 bg-white shadow-sm">
            <p className="text-[11px] text-muted-foreground">
              Total Leads
            </p>
            <p className="text-2xl font-bold">
              {totalLeads}
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-red-50 shadow-sm">
            <p className="text-[11px] text-red-600">
              🔥 Hot
            </p>
            <p className="text-2xl font-bold text-red-700">
              {hotLeads}
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-green-50 shadow-sm">
            <p className="text-[11px] text-green-600">
              Booked
            </p>
            <p className="text-2xl font-bold text-green-700">
              {bookedLeads}
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-yellow-50 shadow-sm">
            <p className="text-[11px] text-yellow-600">
              Negotiation
            </p>
            <p className="text-2xl font-bold text-yellow-700">
              {negotiationLeads}
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-red-50 shadow-sm">
            <p className="text-[11px] text-red-600">
              Attention
            </p>
            <p className="text-2xl font-bold text-red-700">
              {attentionLeads}
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-blue-50 shadow-sm">
            <p className="text-[11px] text-blue-600">
              Conversion
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {conversionRate}%
            </p>
          </div>

          <div className="border rounded-lg p-3 bg-purple-50 shadow-sm">
            <p className="text-[11px] text-purple-600">
              Pipeline
            </p>
            <p className="text-xl font-bold text-purple-700">
              ₹{(pipelineValue / 1000).toFixed(0)}k
            </p>
          </div>
        </div>

        {/* SMART PRIORITY MESSAGE */}
        {hotLeads > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800">
                🔥 {hotLeads} high-priority lead
                {hotLeads > 1 ? "s" : ""} need attention
              </p>

              <p className="text-xs text-red-700">
                Focus on these leads first to reduce response
                time and move opportunities toward booking.
              </p>
            </div>

            <Button
              variant="outline"
              className="border-red-300 text-red-700"
              onClick={() => {
                setPriority("HOT");
                setSortBy("priority");
              }}
            >
              View HOT leads
            </Button>
          </div>
        )}

        {/* VIEWS */}
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-muted/30 p-1.5">
          {(
            [
              { key: "table", label: "Table" },
              { key: "stack", label: "Stack queue" },
              { key: "focus", label: "Focus stack" },
              { key: "board", label: "Stage board" },
              { key: "buckets", label: "Move-in buckets" },
            ] as {
              key: LeadViewMode;
              label: string;
            }[]
          ).map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={
                "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors " +
                (view === v.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted")
              }
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* TABLE */}
        {view === "table" && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">

            <div className="grid grid-cols-12 px-4 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-muted/40">
              <div className="col-span-2">
                Lead
              </div>

              <div className="col-span-1">
                Priority
              </div>

              <div className="col-span-2">
                Stage
              </div>

              <div className="col-span-2">
                Intent · score
              </div>

              <div className="col-span-2">
                Area · budget
              </div>

              <div className="col-span-1">
                Assigned
              </div>

              <div className="col-span-1">
                Updated
              </div>

              <div className="col-span-1 text-right">
                Actions
              </div>
            </div>

            <div className="divide-y divide-border">

              {filtered.map((l) => {
                const tcm = tcms.find(
                  (t) => t.id === l.assignedTcmId
                );

                return (
                  <div key={l.id}>

                    <div
                      role="button"
                      tabIndex={0}
                      data-testid={`lead-row-${l.id}`}
                      onPointerDownCapture={(e) => {
                        const target =
                          e.target as HTMLElement;

                        if (
                          target.closest(
                            '[data-copy-phone="true"]'
                          ) ||
                          target.closest(
                            '[data-lead-action="true"]'
                          )
                        ) {
                          return;
                        }

                        selectLead(l.id);
                      }}
                      onClick={() => selectLead(l.id)}
                      onKeyDown={(e) => {
                        if (
                          e.key !== "Enter" &&
                          e.key !== " "
                        ) {
                          return;
                        }

                        e.preventDefault();
                        selectLead(l.id);
                      }}
                      className="w-full text-left grid grid-cols-12 px-4 py-3 items-center hover:bg-accent/5 transition-colors"
                    >

                      {/* LEAD */}
                      <div className="col-span-2">
                        <div className="font-medium text-sm">
                          {l.name}
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">

                          <span>
                            {l.phone} · {l.source}
                          </span>

                          <span
                            role="button"
                            tabIndex={0}
                            data-copy-phone="true"
                            onClick={(e) => {
                              e.stopPropagation();

                              navigator.clipboard.writeText(
                                l.phone
                              );

                              alert(
                                "Phone Number Copied!"
                              );
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key !== "Enter" &&
                                e.key !== " "
                              ) {
                                return;
                              }

                              e.preventDefault();
                              e.stopPropagation();

                              navigator.clipboard.writeText(
                                l.phone
                              );

                              alert(
                                "Phone Number Copied!"
                              );
                            }}
                            className="rounded border px-2 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50"
                          >
                            Copy
                          </span>
                        </div>
                      </div>

                      {/* PRIORITY */}
                      <div className="col-span-1">
                        <div
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold ${priorityClasses(
                            l.calculatedPriority
                          )}`}
                        >
                          {l.calculatedPriority === "HOT" &&
                            "🔥"}

                          {l.calculatedPriority === "WARM" &&
                            "🟡"}

                          {l.calculatedPriority === "COLD" &&
                            "⚪"}

                          {l.calculatedPriority}
                        </div>

                        <div className="text-[9px] text-muted-foreground mt-1">
                          Score {l.priorityScore}
                        </div>
                      </div>

                      {/* STAGE */}
                      <div className="col-span-2">
                        <StageBadge stage={l.stage} />

                        {l.attentionRequired && (
                          <div className="mt-1 text-[9px] font-semibold text-red-600">
                            ⚠ Attention needed
                          </div>
                        )}
                      </div>

                      {/* INTENT */}
                      <div className="col-span-2 flex items-center gap-2">
                        <IntentChip intent={l.intent} />

                        <ConfidenceBar
                          value={l.confidence}
                        />
                      </div>

                      {/* AREA + BUDGET */}
                      <div className="col-span-2 text-xs">
                        <div>
                          {l.preferredArea}
                        </div>

                        <div className="text-muted-foreground">
                          ₹{(l.budget / 1000).toFixed(0)}k
                        </div>
                      </div>

                      {/* ASSIGNED */}
                      <div className="col-span-1 text-xs">
                        <div>
                          {tcm?.name ?? "—"}
                        </div>

                        <div className="text-muted-foreground">
                          {tcm?.zone ?? "—"}
                        </div>
                      </div>

                      {/* UPDATED */}
                      <div className="col-span-1 text-[10px] text-muted-foreground">
                        {mounted
                          ? formatDistanceToNow(
                              new Date(l.updatedAt),
                              {
                                addSuffix: true,
                              }
                            )
                          : "—"}
                      </div>

                      {/* QUICK ACTIONS */}
                      <div
                        className="col-span-1 flex justify-end gap-1"
                        data-lead-action="true"
                        onClick={(e) =>
                          e.stopPropagation()
                        }
                      >
                        <button
                          title="WhatsApp"
                          className="rounded-md border px-2 py-1 text-[11px] hover:bg-green-50 hover:text-green-700"
                          onClick={() =>
                            openWhatsApp(
                              l.phone,
                              l.name
                            )
                          }
                        >
                          WA
                        </button>

                        <button
                          title="Call"
                          className="rounded-md border px-2 py-1 text-[11px] hover:bg-blue-50 hover:text-blue-700"
                          onClick={() =>
                            callLead(l.phone)
                          }
                        >
                          Call
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filtered.length === 0 && (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No leads match.
                </div>
              )}
            </div>
          </div>
        )}

        {/* EXISTING VIEWS */}
        {view === "stack" && (
          <LeadStackQueue
            leads={filtered}
            onOpen={selectLead}
          />
        )}

        {view === "focus" && (
          <LeadFocusStack
            leads={filtered}
            onOpen={selectLead}
          />
        )}

        {view === "board" && (
          <LeadStageBoard
            leads={filtered}
            onOpen={selectLead}
          />
        )}

        {view === "buckets" && (
          <LeadMoveInBuckets
            leads={filtered}
            onOpen={selectLead}
          />
        )}
      </div>
    </AppShell>
  );
}