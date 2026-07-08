"use client";

import { useCoAgent, useCopilotChat, useLangGraphInterrupt } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";
import { CopilotChat } from "@copilotkit/react-ui";
import { useEffect, useState } from "react";
import { PdfDropzone, type UploadResult } from "@/components/PdfDropzone";
import { LessonPlanCard } from "@/components/LessonPlanCard";
import { McqWidget } from "@/components/McqWidget";
import { ProgressBar } from "@/components/ProgressBar";
import { SummaryReport } from "@/components/SummaryReport";
import { resetThread, useThread } from "@/components/Providers";
import { Button, Icon } from "@/components/ui";
import type { InterruptEvent, LessonAgentState } from "@/lib/types";

const AGENT_ID = "lesson_agent";

const STEPS = [
  { n: 1, label: "Upload a PDF" },
  { n: 2, label: "Approve the lesson plan" },
  { n: 3, label: "Quiz through it, get a report" },
];

export default function Home() {
  const [started, setStarted] = useState(false);
  const [truncatedNote, setTruncatedNote] = useState(false);

  const { state } = useCoAgent<LessonAgentState>({ name: AGENT_ID });
  const { appendMessage } = useCopilotChat();
  const { threadId, newThread } = useThread();
  const [kickoffError, setKickoffError] = useState<string | null>(null);
  const [pendingKickoff, setPendingKickoff] = useState<{ threadId: string; title: string } | null>(null);

  // After a refresh mid-lesson, the synced agent state still has the lesson —
  // restore the lesson view instead of offering the upload hero (uploading a
  // second document into a mid-lesson thread corrupts it).
  useEffect(() => {
    if (!started && (state?.lessonPlan || (state?.phase && state.phase !== "planning"))) {
      setStarted(true);
    }
  }, [started, state?.lessonPlan, state?.phase]);

  // ── HITL: one hook renders BOTH interrupt types (plan approval + quiz question) ──
  // Note: CopilotKit types event.value as `string`, but the LangGraph interrupt
  // payload is delivered as the parsed object — cast through unknown.
  useLangGraphInterrupt({
    render: ({ event, resolve }) => {
      const value = event.value as unknown as InterruptEvent | null;
      if (!value || typeof value !== "object") return <></>;

      if (value.type === "plan_approval") {
        if (!value.plan) return <></>; // planning failed — never render a null plan
        return (
          <LessonPlanCard
            plan={value.plan}
            onApprove={() => resolve(JSON.stringify({ action: "approve" }))}
            onRevise={(feedback) => resolve(JSON.stringify({ action: "revise", feedback }))}
          />
        );
      }
      if (value.type === "quiz_question") {
        return <McqWidget event={value} resolve={resolve} />;
      }
      return <></>;
    },
  });

  // Deterministic kickoff: (1) mint a FRESH thread for this document, (2) seed
  // the document into its LangGraph state server-side via /api/seed and AWAIT it,
  // (3) send the kickoff chat message. Step 3 runs from the effect below, which
  // waits until CopilotKit has actually switched to the new thread — calling
  // appendMessage directly here would use a closure still bound to the OLD thread.
  async function onExtracted(r: UploadResult) {
    setTruncatedNote(r.truncated);
    setKickoffError(null);
    setStarted(true);

    const freshThreadId = newThread();
    try {
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: freshThreadId, pdfText: r.text, pdfTitle: r.title }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setKickoffError(data.error ?? "Could not hand the document to the agent.");
        return;
      }
    } catch {
      setKickoffError(
        navigator.onLine
          ? "Couldn't reach the server. Is the agent running?"
          : "You're offline — reconnect to the internet and try again.",
      );
      return;
    }
    setPendingKickoff({ threadId: freshThreadId, title: r.title });
  }

  useEffect(() => {
    if (pendingKickoff && threadId === pendingKickoff.threadId) {
      const { title } = pendingKickoff;
      setPendingKickoff(null);
      void appendMessage(
        new TextMessage({
          role: MessageRole.User,
          content: `I've uploaded "${title}". Please analyze it and draft my lesson plan.`,
        }),
      );
    }
  }, [pendingKickoff, threadId, appendMessage]);

  const plan = state?.lessonPlan ?? null;
  const statuses = state?.objectiveStatuses ?? {};
  const summary = state?.summary ?? null;
  const phase = state?.phase;

  // Recovery net: if planning never produces a plan (empty/failed extraction, an
  // LLM error with no interrupt), don't leave the user on an eternal skeleton.
  const [planStalled, setPlanStalled] = useState(false);
  useEffect(() => {
    setPlanStalled(false);
    if (!started || plan || pendingKickoff || (phase && phase !== "planning")) return;
    const t = setTimeout(() => setPlanStalled(true), 35_000);
    return () => clearTimeout(t);
  }, [started, plan, pendingKickoff, phase]);

  // Detect a dropped internet connection (e.g. Wi-Fi loss) and surface it — most
  // failures during a lesson are the browser going offline, not an app bug.
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-4 md:px-8">
      {offline && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-err/30 bg-err-soft px-3 py-2 text-sm font-medium text-err-ink"
        >
          {Icon.x("text-err")}
          You&apos;re offline — check your internet connection. The lesson will resume once you reconnect.
        </div>
      )}
      <header className="flex items-center justify-between border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
            {Icon.book("h-4 w-4")}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">PDF → Interactive Lesson</p>
            <p className="text-xs text-faint">plan · approve · quiz · master</p>
          </div>
        </div>
        {started && (
          <Button variant="ghost" onClick={resetThread}>
            {Icon.refresh()} New lesson
          </Button>
        )}
      </header>

      {!started ? (
        <section className="flex flex-1 flex-col items-center justify-center py-14">
          <div className="w-full max-w-2xl text-center">
            <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Turn any PDF into a lesson you&apos;ll actually remember
            </h1>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-mut">
              Your tutor reads the document, proposes a plan for your approval, then
              quizzes you to mastery with hints that never spoil the answer.
            </p>

            <div className="mt-9">
              <PdfDropzone onExtracted={onExtracted} />
            </div>

            <ol className="mt-9 flex flex-col items-center justify-center gap-3 text-sm text-mut sm:flex-row sm:gap-2">
              {STEPS.map((s, i) => (
                <li key={s.n} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-ink">
                    {s.n}
                  </span>
                  {s.label}
                  {i < STEPS.length - 1 && (
                    <span className="hidden text-faint sm:block">{Icon.arrow("h-3.5 w-3.5")}</span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : (
        <section className="grid flex-1 grid-cols-1 gap-5 pt-5 md:grid-cols-[300px_1fr]">
          {/* Sidebar: progress + summary */}
          <aside className="space-y-4">
            {kickoffError && (
              <div
                role="alert"
                className="animate-fade-up rounded-lg border border-err/30 bg-err-soft p-3 text-sm text-err-ink"
              >
                {kickoffError}
                <button
                  onClick={resetThread}
                  className="ml-2 font-medium underline underline-offset-2 hover:no-underline"
                >
                  Start over
                </button>
              </div>
            )}
            {plan ? (
              <div className="animate-fade-up">
                <ProgressBar plan={plan} statuses={statuses} />
              </div>
            ) : planStalled ? (
              <div className="rounded-xl border border-err/25 bg-err-soft p-4 text-sm text-err-ink">
                <p className="font-medium">Couldn&apos;t draft a lesson plan.</p>
                <p className="mt-1 text-xs opacity-80">
                  {offline
                    ? "Your internet connection dropped while the tutor was reading the document. Reconnect and try again."
                    : "The connection to the AI may have dropped, or the document has no extractable text."}
                </p>
                <button
                  onClick={resetThread}
                  className="mt-2 font-medium underline underline-offset-2 hover:no-underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-line bg-surface p-4">
                <p className="mb-3 text-sm font-medium">Drafting your lesson plan</p>
                <div className="space-y-2.5" aria-hidden="true">
                  <div className="h-2.5 w-4/5 animate-pulse-soft rounded bg-raised" />
                  <div className="h-2.5 w-3/5 animate-pulse-soft rounded bg-raised [animation-delay:150ms]" />
                  <div className="h-2.5 w-2/3 animate-pulse-soft rounded bg-raised [animation-delay:300ms]" />
                </div>
              </div>
            )}

            {truncatedNote && (
              <p className="rounded-lg border border-line bg-accent-soft/50 p-3 text-xs text-mut">
                Long document: the lesson covers the first ~40k characters.
              </p>
            )}
          </aside>

          {/* Main column: the lesson chat while learning; the full report once done */}
          {phase === "summary" && summary ? (
            <div className="animate-fade-up mx-auto w-full max-w-2xl space-y-4 py-2">
              <SummaryReport summary={summary} />
              <div className="flex justify-center">
                <Button variant="ghost" onClick={resetThread}>
                  {Icon.refresh()} Start another lesson
                </Button>
              </div>
            </div>
          ) : (
            <div className="min-h-[70vh] overflow-hidden rounded-xl border border-line bg-surface">
              <CopilotChat
                className="h-full"
                labels={{
                  title: "Your tutor",
                  initial:
                    "I'm reading your document and will propose a lesson plan for your approval.",
                  placeholder: "Ask about the material anytime…",
                }}
              />
            </div>
          )}
        </section>
      )}
    </main>
  );
}
