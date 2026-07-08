"use client";

import { useState } from "react";
import { Button, Card, Icon } from "./ui";
import type { LessonPlan, Difficulty } from "@/lib/types";

// Neutral-to-accent ramp. Green/red are reserved for grading (PRODUCT.md), so
// difficulty uses the accent scale only.
const difficultyDot: Record<Difficulty, string> = {
  beginner: "bg-line-strong",
  intermediate: "bg-accent/50",
  advanced: "bg-accent",
};

function DifficultyTag({ level }: { level: Difficulty }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] font-medium capitalize text-mut">
      <span className={`h-1.5 w-1.5 rounded-full ${difficultyDot[level]}`} />
      {level}
    </span>
  );
}

export function LessonPlanCard({
  plan,
  onApprove,
  onRevise,
}: {
  plan: LessonPlan;
  onApprove: () => void;
  onRevise: (feedback: string) => void;
}) {
  const [revising, setRevising] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <Card className="animate-fade-up my-2 w-full p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">
            Lesson plan · awaiting your approval
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">{plan.title}</h3>
        </div>
        <DifficultyTag level={plan.difficulty} />
      </div>

      <ol className="mb-5 space-y-1">
        {plan.objectives.map((o, i) => (
          <li key={o.id} className="flex gap-3 rounded-lg p-2.5 transition-colors hover:bg-raised">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-mut">
              {i + 1}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{o.title}</span>
                <DifficultyTag level={o.difficulty} />
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-mut">{o.description}</p>
            </div>
          </li>
        ))}
      </ol>

      {submitted ? (
        <p className="text-sm text-faint">Sending your response…</p>
      ) : !revising ? (
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              setSubmitted(true);
              onApprove();
            }}
          >
            {Icon.check()} Approve &amp; start
          </Button>
          <Button variant="ghost" onClick={() => setRevising(true)}>
            Request changes
          </Button>
        </div>
      ) : (
        <div className="animate-fade-up space-y-2">
          <textarea
            autoFocus
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder='e.g. "Two objectives, beginner level"'
            className="w-full resize-none rounded-lg border border-line bg-page p-2.5 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              disabled={!feedback.trim()}
              onClick={() => {
                setSubmitted(true);
                onRevise(feedback.trim());
              }}
            >
              Submit changes
            </Button>
            <Button variant="quiet" onClick={() => setRevising(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
