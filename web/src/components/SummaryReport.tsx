"use client";

import { Card, Icon } from "./ui";
import type { Summary } from "@/lib/types";

/** One source of truth for score banding across the ring and the bars. */
function scoreTier(pct: number): { stroke: string; bar: string } {
  if (pct >= 80) return { stroke: "var(--ok)", bar: "bg-ok" };
  if (pct >= 50) return { stroke: "var(--accent)", bar: "bg-accent" };
  return { stroke: "var(--err)", bar: "bg-err" };
}

function ScoreRing({ pct }: { pct: number }) {
  const r = 34;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0" role="img" aria-label={`${pct}% first-try accuracy`}>
      <circle cx="44" cy="44" r={r} fill="none" strokeWidth="7" style={{ stroke: "var(--raised)" }} />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
        style={{ stroke: scoreTier(pct).stroke, transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
      />
      <text x="44" y="50" textAnchor="middle" className="fill-ink text-lg font-bold tabular-nums">
        {pct}%
      </text>
    </svg>
  );
}

export function SummaryReport({ summary }: { summary: Summary }) {
  const { stats, narrative } = summary;

  return (
    <Card className="w-full space-y-5 p-5">
      <div className="flex items-center gap-4">
        <ScoreRing pct={stats.overall.firstTryAccuracyPct} />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Lesson complete
          </p>
          <p className="mt-1 text-sm font-medium leading-snug">{narrative.headline}</p>
          <p className="mt-1.5 text-xs text-faint">
            {stats.overall.firstTryCorrect}/{stats.overall.totalQuestions} first try ·{" "}
            {stats.overall.totalRetries} retries · {stats.overall.hintsRequested} hints
          </p>
        </div>
      </div>

      <div>
        <h4 className="mb-2.5 text-sm font-semibold">By objective</h4>
        <div className="space-y-3.5">
          {stats.perObjective.map((o, i) => (
            <div key={o.objectiveId}>
              <div className="mb-1.5 flex justify-between gap-2 text-sm">
                <span className="truncate">{o.title}</span>
                <span className="shrink-0 tabular-nums text-faint">
                  {o.firstTryCorrect}/{o.questions}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-raised">
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${scoreTier(o.accuracyPct).bar}`}
                  style={{ width: `${o.accuracyPct}%` }}
                />
              </div>
              {narrative.objectiveBreakdown[i] && (
                <p className="mt-1 text-xs leading-relaxed text-faint">{narrative.objectiveBreakdown[i]}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          {Icon.bulb("text-accent")} Study tips
        </h4>
        <ul className="space-y-2">
          {narrative.studyTips.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm leading-relaxed">
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">
                {i + 1}
              </span>
              <span className="text-mut">{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="rounded-lg bg-raised p-3 text-sm leading-relaxed text-mut">
        {narrative.encouragement}
      </p>
    </Card>
  );
}
