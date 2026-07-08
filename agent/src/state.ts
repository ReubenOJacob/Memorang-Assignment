import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import type {
  LessonPlan,
  MCQ,
  Attempt,
  HintEvent,
  Summary,
  ObjectiveStatus,
} from "./schemas.js";

/**
 * The whole lesson runs as one graph execution over this state.
 *
 * Reducers: almost everything is last-write-wins (single writer per field, nodes
 * run sequentially). The exceptions are `attempts` and `hintEvents` — append-only
 * event logs (concat reducers) that the summary is derived from.
 *
 * ANTI-CHEAT: `questions` holds the FULL MCQs including correct answers, and
 * `pdfText` is large. Neither may reach the browser. The graph is therefore
 * compiled with the narrow `LessonStateOutput` schema below as its OUTPUT schema:
 * CopilotKit's state-sync (STATE_SNAPSHOT) filters channels by the graph's
 * output-schema keys, so only the fields listed there are ever streamed to the
 * client. Interrupt payloads are additionally sanitized via `toSafeMcq`.
 */
export const LessonState = Annotation.Root({
  ...MessagesAnnotation.spec,

  // ── Source material (server-only: excluded from output schema) ──
  pdfText: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),
  pdfTitle: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),

  // ── Plan + HITL approval ──
  lessonPlan: Annotation<LessonPlan | null>({ reducer: (_, b) => b, default: () => null }),
  objectiveStatuses: Annotation<Record<string, ObjectiveStatus>>({
    reducer: (a, b) => ({ ...a, ...b }),
    default: () => ({}),
  }),
  planApproved: Annotation<boolean>({ reducer: (_, b) => b ?? false, default: () => false }),
  planFeedback: Annotation<string>({ reducer: (_, b) => b ?? "", default: () => "" }),

  // ── Quiz progression (questions is server-only: excluded from output schema) ──
  currentObjectiveIndex: Annotation<number>({ reducer: (_, b) => b ?? 0, default: () => 0 }),
  questions: Annotation<MCQ[]>({ reducer: (_, b) => b ?? [], default: () => [] }),
  currentQuestionIndex: Annotation<number>({ reducer: (_, b) => b ?? 0, default: () => 0 }),

  // ── Routing signal set by the quiz node on resume ──
  lastAnswerCorrect: Annotation<boolean>({ reducer: (_, b) => b ?? true, default: () => true }),

  // ── Event ledgers (append-only) ──
  attempts: Annotation<Attempt[]>({
    reducer: (a, b) => (b ? a.concat(b) : a),
    default: () => [],
  }),
  hintEvents: Annotation<HintEvent[]>({
    reducer: (a, b) => (b ? a.concat(b) : a),
    default: () => [],
  }),

  // ── Lifecycle ──
  phase: Annotation<"planning" | "awaiting_approval" | "quizzing" | "summary" | "done">({
    reducer: (_, b) => b ?? "planning",
    default: () => "planning",
  }),
  summary: Annotation<Summary | null>({ reducer: (_, b) => b, default: () => null }),
});

/**
 * OUTPUT schema — the ONLY channels synced to the browser. Deliberately excludes:
 *   questions   (contains correctChoiceId/explanation — the answer key)
 *   pdfText     (up to 40k chars re-streamed on every state tick otherwise)
 *   attempts / hintEvents / planFeedback (server bookkeeping)
 * Built by PICKING channels from LessonState.spec — LangGraph requires input/output
 * schemas to share channel instances with the state schema (re-declaring throws
 * 'Channel "x" already exists with a different type').
 * Keep web/src/lib/types.ts `LessonAgentState` in sync with this list.
 */
export const LessonStateOutput = Annotation.Root({
  messages: LessonState.spec.messages,
  pdfTitle: LessonState.spec.pdfTitle,
  lessonPlan: LessonState.spec.lessonPlan,
  objectiveStatuses: LessonState.spec.objectiveStatuses,
  currentObjectiveIndex: LessonState.spec.currentObjectiveIndex,
  phase: LessonState.spec.phase,
  summary: LessonState.spec.summary,
});

export type LessonStateType = typeof LessonState.State;
export type LessonStateUpdate = typeof LessonState.Update;
