"use client";

import { Card, Icon } from "./ui";
import type { LessonPlan, ObjectiveStatus } from "@/lib/types";

export function ProgressBar({
  plan,
  statuses,
}: {
  plan: LessonPlan;
  statuses: Record<string, ObjectiveStatus>;
}) {
  const total = plan.objectives.length;
  const done = plan.objectives.filter((o) => statuses[o.id] === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="truncate text-sm font-semibold tracking-tight">{plan.title}</h4>
        <span className="shrink-0 text-xs tabular-nums text-faint">
          {done}/{total}
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mb-4 h-1 w-full overflow-hidden rounded-full bg-raised"
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol className="space-y-2.5">
        {plan.objectives.map((o) => {
          const s = statuses[o.id] ?? "pending";
          return (
            <li key={o.id} className="flex items-center gap-2.5 text-sm">
              {s === "done" ? (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-ok-soft text-ok-ink">
                  {Icon.check("h-2.5 w-2.5")}
                </span>
              ) : s === "in_progress" ? (
                <span className="relative flex h-4 w-4 items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-accent" />
                  <span className="absolute h-3.5 w-3.5 rounded-full border border-accent/40" />
                </span>
              ) : (
                <span className="flex h-4 w-4 items-center justify-center">
                  <span className="h-2 w-2 rounded-full border border-line-strong" />
                </span>
              )}
              <span className={s === "done" ? "text-faint" : s === "pending" ? "text-mut" : "font-medium"}>
                {o.title}
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
