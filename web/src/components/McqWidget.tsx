"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon } from "./ui";
import { useThread } from "./Providers";
import type { ChoiceId, QuizQuestionEvent } from "@/lib/types";

/**
 * Core generative-UI widget, rendered inline in the chat for each
 * `quiz_question` interrupt. NOTHING re-renders the card mid-question:
 *
 *  - Submit → /api/grade (server-authoritative, answer key never sent to the
 *    browser beforehand): green explanation or red hint pops in BELOW the
 *    question. Wrong answers retry in place, no penalty.
 *  - Hint / Teach me this → /api/tutor: reply pops in below, same rules.
 *  - Only "Next question →" (after a correct answer) resolves the interrupt —
 *    carrying the wrong attempts + hint count so the agent's stats ledger and
 *    Postgres stay accurate. The graph re-grades authoritatively on resume.
 */

// Selection survives any potential remount, keyed by question id.
const selectionCache = new Map<string, ChoiceId>();

type Graded =
  | { correct: true; explanation: string; revealedCorrectChoiceId: ChoiceId }
  | { correct: false; hint: string };

export function McqWidget({
  event,
  resolve,
}: {
  event: QuizQuestionEvent;
  resolve: (value: string) => void;
}) {
  const { question, objective, questionNumber, totalQuestions } = event;
  const { threadId } = useThread();

  const [selected, setSelectedState] = useState<ChoiceId | null>(
    () => selectionCache.get(question.id) ?? null,
  );
  const [grading, setGrading] = useState(false);
  const [graded, setGraded] = useState<Graded | null>(null);
  const [wrongPicks, setWrongPicks] = useState<ChoiceId[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const [tutorText, setTutorText] = useState<string | null>(null);
  const [tutorBusy, setTutorBusy] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  // Every hint/teach-me click, in order — length is the hint count, and the kinds
  // are passed through so the ledger distinguishes hints from "teach me this".
  const [hintKinds, setHintKinds] = useState<("hint" | "learn_more")[]>([]);

  const setSelected = (id: ChoiceId) => {
    selectionCache.set(question.id, id);
    setSelectedState(id);
  };

  // Reset only when the QUESTION genuinely changes — keyed on question.id, NOT
  // the event object. CopilotKit can re-emit a structurally-new event object for
  // the same question (state-sync tick, reconnect, chat message re-presenting the
  // interrupt); keying on `event` would wipe the earned grade + hint count and
  // silently under-report to the stats ledger.
  useEffect(() => {
    setGrading(false);
    setGraded(null);
    setWrongPicks([]);
    setAdvancing(false);
    setTutorText(null);
    setTutorBusy(false);
    setUiError(null);
    setHintKinds([]);
    setSelectedState(selectionCache.get(question.id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const answeredCorrectly = graded?.correct === true;
  const lastWrong = graded?.correct === false;

  async function submit() {
    if (!selected || grading || answeredCorrectly) return;
    setGrading(true);
    setUiError(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, questionId: question.id, choiceId: selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUiError(data.error ?? "Grading failed — try again.");
        return;
      }
      if (data.correct) {
        setGraded({
          correct: true,
          explanation: data.explanation,
          revealedCorrectChoiceId: data.revealedCorrectChoiceId,
        });
      } else {
        setGraded({ correct: false, hint: data.hint });
        // Append EVERY wrong submission (including a repeat of the same choice) so
        // the retry count in the ledger is accurate; the display uses .includes so
        // duplicates don't change the rendered red marks.
        setWrongPicks((w) => (selected ? [...w, selected] : w));
        selectionCache.delete(question.id);
        setSelectedState(null);
      }
    } catch {
      setUiError(
        navigator.onLine
          ? "Grading failed — is the server running?"
          : "You're offline — reconnect and submit again.",
      );
    } finally {
      setGrading(false);
    }
  }

  function nextQuestion() {
    if (!answeredCorrectly || advancing || graded?.correct !== true) return;
    setAdvancing(true);
    selectionCache.delete(question.id);
    resolve(
      JSON.stringify({
        action: "answer",
        choiceId: graded.revealedCorrectChoiceId,
        wrongAttempts: wrongPicks,
        hintKinds, // ordered list; the agent derives count + per-kind events
      }),
    );
  }

  async function askTutor(kind: "hint" | "learn_more", query = "") {
    setTutorBusy(true);
    setUiError(null);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // attemptsSoFar drives the tutor's "be more generous after 2 tries" rule;
        // the client is the only place that knows the real count (grading is local).
        body: JSON.stringify({
          threadId,
          questionId: question.id,
          kind,
          query,
          attemptsSoFar: wrongPicks.length,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setUiError(data.error ?? "The tutor is unavailable right now.");
        return;
      }
      setHintKinds((k) => [...k, kind]);
      setTutorText(data.text);
    } catch {
      setUiError(
        navigator.onLine
          ? "The tutor is unavailable right now — try again."
          : "You're offline — reconnect to ask for a hint.",
      );
    } finally {
      setTutorBusy(false);
    }
  }

  return (
    <div className="my-2 w-full space-y-3">
      <Card className="animate-fade-up w-full p-5">
        <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-medium text-faint">
          <span className="truncate uppercase tracking-[0.08em]">{objective.title}</span>
          <span className="flex shrink-0 items-center gap-1.5">
            {Array.from({ length: totalQuestions }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i + 1 < questionNumber || (i + 1 === questionNumber && answeredCorrectly)
                    ? "bg-ok"
                    : i + 1 === questionNumber
                      ? "bg-accent"
                      : "bg-raised"
                }`}
              />
            ))}
            <span className="ml-1 tabular-nums">
              {questionNumber}/{totalQuestions}
            </span>
          </span>
        </div>

        <fieldset disabled={grading || advancing || answeredCorrectly}>
          <legend className="mb-4 text-[15px] font-medium leading-relaxed">
            {question.question}
          </legend>

          <div className="space-y-2">
            {question.choices.map((c) => {
              const isChosen = selected === c.id;
              const wrongPick = wrongPicks.includes(c.id);
              const revealedCorrect = answeredCorrectly && graded.revealedCorrectChoiceId === c.id;
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-sm transition-all duration-150 ${
                    answeredCorrectly ? "cursor-default" : "cursor-pointer"
                  } ${
                    revealedCorrect
                      ? "border-ok/50 bg-ok-soft"
                      : wrongPick
                        ? "border-err/40 bg-err-soft"
                        : isChosen
                          ? "border-accent bg-accent-soft/60"
                          : "border-line hover:border-line-strong hover:bg-raised/60"
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={c.id}
                    checked={isChosen || revealedCorrect}
                    onChange={() => setSelected(c.id)}
                    className="h-4 w-4"
                  />
                  <span
                    className={`text-xs font-semibold ${
                      revealedCorrect ? "text-ok-ink" : wrongPick ? "text-err-ink" : "text-faint"
                    }`}
                  >
                    {c.id}
                  </span>
                  <span
                    className={`flex-1 leading-snug ${
                      revealedCorrect ? "text-ok-ink" : wrongPick ? "text-err-ink" : ""
                    }`}
                  >
                    {c.text}
                  </span>
                  {revealedCorrect && Icon.check("text-ok")}
                  {wrongPick && Icon.x("text-err")}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* ── Everything below pops in under the question; the card never reloads ── */}

        {answeredCorrectly && (
          <div
            role="status"
            className="animate-fade-up mt-3 flex items-start gap-2.5 rounded-lg border border-ok/25 bg-ok-soft p-3.5 text-sm leading-relaxed text-ok-ink"
          >
            <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-ok text-on-accent">
              {Icon.check("h-3 w-3")}
            </span>
            <p>
              <span className="font-semibold">Correct.</span> {graded.explanation}
            </p>
          </div>
        )}

        {lastWrong && graded?.correct === false && (
          <div
            role="status"
            className="animate-fade-up mt-3 flex items-start gap-2.5 rounded-lg border border-err/25 bg-err-soft p-3 text-sm leading-relaxed text-err-ink"
          >
            {Icon.bulb("mt-0.5 shrink-0 text-err")}
            <p>
              <span className="font-semibold">Not quite.</span> {graded.hint}
              <span className="mt-1 block text-xs opacity-75">No penalty — pick again.</span>
            </p>
          </div>
        )}

        {tutorBusy && (
          <div className="animate-fade-up mt-3 flex items-center gap-2.5 rounded-lg border border-line bg-accent-soft/50 p-3 text-sm text-mut">
            {Icon.book("shrink-0 animate-pulse-soft text-accent")}
            Looking at the material…
          </div>
        )}
        {tutorText && !tutorBusy && (
          <div
            role="status"
            className="animate-fade-up mt-3 flex items-start gap-2.5 rounded-lg border border-line bg-accent-soft/50 p-3 text-sm leading-relaxed"
          >
            {Icon.book("mt-0.5 shrink-0 text-accent")}
            <p className="text-mut">{tutorText}</p>
          </div>
        )}

        {uiError && (
          <p className="animate-fade-up mt-3 rounded-lg border border-err/25 bg-err-soft p-3 text-sm text-err-ink">
            {uiError}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {answeredCorrectly ? (
            <Button onClick={nextQuestion} disabled={advancing}>
              {advancing ? "Loading…" : questionNumber < totalQuestions ? "Next question" : "Continue"}{" "}
              {Icon.arrow()}
            </Button>
          ) : (
            <>
              <Button disabled={!selected || grading} onClick={submit}>
                {grading ? "Checking…" : lastWrong ? "Try again" : "Submit"} {Icon.arrow()}
              </Button>
              <Button variant="ghost" disabled={grading || tutorBusy} onClick={() => askTutor("hint")}>
                {Icon.bulb()} Hint
              </Button>
              <Button
                variant="ghost"
                disabled={grading || tutorBusy}
                onClick={() =>
                  askTutor(
                    "learn_more",
                    "Teach me the underlying concept this question tests, in simple terms, using the source material.",
                  )
                }
              >
                {Icon.book()} Teach me this
              </Button>
            </>
          )}
        </div>

      </Card>
    </div>
  );
}
