import { interrupt, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { recordAttempt } from "../db.js";
import {
  toSafeMcq,
  ChoiceIdSchema,
  type Attempt,
  type HintEvent,
  type ChoiceId,
} from "../schemas.js";
import type { LessonStateType, LessonStateUpdate } from "../state.js";

/**
 * HITL interrupt #2 — one interrupt per quiz question.
 *
 * Grading and tutoring run entirely client-side (/api/grade, /api/tutor) so the
 * question card never re-renders mid-question. The interrupt resolves ONCE, on
 * "Next question" after a correct answer, carrying the interaction history:
 *   { action: "answer", choiceId, wrongAttempts, hintKinds }
 * This node re-grades authoritatively (client input is untrusted) and writes the
 * attempt + hint ledgers. The interrupt payload carries only the safe subset of
 * the MCQ (toSafeMcq — no answer), and the graph's output schema excludes
 * `questions` from state sync (see state.ts).
 *
 * Idempotency: the only read before interrupt() is of state; all side effects and
 * state mutations happen strictly AFTER interrupt() returns.
 */

type QuizResume = {
  action: "answer";
  choiceId: ChoiceId;
  wrongAttempts?: ChoiceId[];
  hintKinds?: ("hint" | "learn_more")[];
};

/**
 * The resume value normally arrives pre-parsed (the runtime JSON-parses string
 * resume commands). Anything malformed is mapped to `null` — the caller then
 * re-presents the same question instead of fabricating a graded attempt.
 */
function normalizeResume(raw: unknown): QuizResume | null {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object") return null;
  const r = v as Record<string, unknown>;
  if (r.action !== "answer" || !ChoiceIdSchema.safeParse(r.choiceId).success) return null;

  const wrongAttempts = Array.isArray(r.wrongAttempts)
    ? (r.wrongAttempts.filter((c) => ChoiceIdSchema.safeParse(c).success) as ChoiceId[])
    : [];
  const hintKinds = Array.isArray(r.hintKinds)
    ? (r.hintKinds.filter((k) => k === "hint" || k === "learn_more") as ("hint" | "learn_more")[])
    : [];
  return { action: "answer", choiceId: r.choiceId as ChoiceId, wrongAttempts, hintKinds };
}

export async function quizNode(
  state: LessonStateType,
  config: LangGraphRunnableConfig,
): Promise<LessonStateUpdate> {
  const q = state.questions[state.currentQuestionIndex];
  const plan = state.lessonPlan;

  // Defensive: the generate_mcqs conditional edge only routes here with
  // questions present, but never interrupt over a missing question. Force
  // forward progress so the router exits toward generate_mcqs/summarize.
  if (!q || !plan) {
    return {
      lastAnswerCorrect: true,
      currentObjectiveIndex: state.currentObjectiveIndex + 1,
      currentQuestionIndex: state.questions.length,
    };
  }

  const objective = plan.objectives[state.currentObjectiveIndex];
  const threadId = (config.configurable?.thread_id as string) ?? "unknown";

  const raw = interrupt({
    type: "quiz_question",
    question: toSafeMcq(q), // SAFE: no correctChoiceId / explanation
    objective: {
      id: objective?.id,
      title: objective?.title,
      index: state.currentObjectiveIndex,
      total: plan.objectives.length,
    },
    questionNumber: state.currentQuestionIndex + 1,
    totalQuestions: state.questions.length,
  });

  const resume = normalizeResume(raw);

  // Malformed resume (e.g. a typed chat message resolving the interrupt): don't
  // fabricate a graded attempt — re-present the same question.
  if (!resume) {
    return { lastAnswerCorrect: true };
  }

  // Authoritative re-grade of the client's /api/grade result.
  const correct = resume.choiceId === q.correctChoiceId;
  const wrongAttempts = resume.wrongAttempts ?? [];
  const hintKinds = resume.hintKinds ?? [];
  const usedHintOnThisQuestion = hintKinds.length > 0;

  // Hint ledger: one event per actual hint/teach-me click, kind preserved.
  const hintEvents: HintEvent[] = hintKinds.map((kind) => ({
    questionId: q.id,
    objectiveId: q.objectiveId,
    kind,
  }));

  // Attempt ledger: each wrong pick (in order, duplicates included) then the
  // final answer. `usedHint` marks only the final attempt — wrong picks may have
  // preceded any hint, and we don't track their exact interleaving.
  const attempts: Attempt[] = wrongAttempts.map((selectedChoice, i) => ({
    questionId: q.id,
    objectiveId: q.objectiveId,
    selected: selectedChoice,
    isCorrect: false,
    attemptNumber: i + 1,
    usedHint: false,
  }));
  attempts.push({
    questionId: q.id,
    objectiveId: q.objectiveId,
    selected: resume.choiceId,
    isCorrect: correct,
    attemptNumber: wrongAttempts.length + 1,
    usedHint: usedHintOnThisQuestion,
  });
  // Fire-and-forget: state.attempts is the source of truth; the Postgres ledger is
  // best-effort analytics and must never block (recordAttempt swallows errors).
  for (const a of attempts) void recordAttempt(a, threadId);

  if (!correct) {
    // Shouldn't happen (the widget only resolves after a correct /api/grade);
    // guard by re-presenting the same question.
    return { attempts, hintEvents, lastAnswerCorrect: false };
  }

  // Correct: advance. If this was the objective's last question, advance the
  // objective index too — the router uses it to pick generate_mcqs vs summarize.
  const nextQuestionIndex = state.currentQuestionIndex + 1;
  const objectiveDone = nextQuestionIndex >= state.questions.length;

  return {
    attempts,
    hintEvents,
    lastAnswerCorrect: true,
    currentQuestionIndex: nextQuestionIndex,
    ...(objectiveDone ? { currentObjectiveIndex: state.currentObjectiveIndex + 1 } : {}),
  };
}
