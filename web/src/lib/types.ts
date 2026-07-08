/**
 * Display-only mirror of the agent's schemas (agent/src/schemas.ts).
 * These are the shapes the browser actually receives — note there is NO
 * correctChoiceId / explanation on the question shape: the answer never leaves
 * the server before a question is resolved.
 */

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type ChoiceId = "A" | "B" | "C" | "D";
export type ObjectiveStatus = "pending" | "in_progress" | "done";

export interface Objective {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
}

export interface LessonPlan {
  title: string;
  difficulty: Difficulty;
  objectives: Objective[];
}

/** The safe MCQ subset sent in the interrupt payload. */
export interface SafeMCQ {
  id: string;
  question: string;
  choices: { id: ChoiceId; text: string }[];
}

/** Payload of the `plan_approval` interrupt. plan can be null if planning failed. */
export interface PlanApprovalEvent {
  type: "plan_approval";
  plan: LessonPlan | null;
}

/**
 * Payload of the `quiz_question` interrupt. Note: grading feedback is NOT here —
 * it comes from the /api/grade response client-side. This is only the safe
 * question shell (no answer key).
 */
export interface QuizQuestionEvent {
  type: "quiz_question";
  question: SafeMCQ;
  objective: { id: string; title: string; index: number; total: number };
  questionNumber: number;
  totalQuestions: number;
}

export type InterruptEvent = PlanApprovalEvent | QuizQuestionEvent;

// Resume payloads are built as inline JSON literals at the two resolve() sites
// (LessonPlanCard approve/revise, McqWidget "Next question"); no shared type is
// needed and an unused one would only drift from the actual shapes.

// ─── Summary (from shared state) ─────────────────────────────────────────────

export interface ObjectiveResult {
  objectiveId: string;
  title: string;
  questions: number;
  firstTryCorrect: number;
  totalAttempts: number;
  hintsRequested: number;
  accuracyPct: number;
}

export interface LessonStats {
  perObjective: ObjectiveResult[];
  overall: {
    totalQuestions: number;
    firstTryCorrect: number;
    firstTryAccuracyPct: number;
    totalAttempts: number;
    totalRetries: number;
    hintsRequested: number;
    strongest: string;
    weakest: string;
  };
}

export interface Summary {
  stats: LessonStats;
  narrative: {
    headline: string;
    objectiveBreakdown: string[];
    studyTips: string[];
    encouragement: string;
  };
}

/**
 * The agent state visible to the client. This mirrors the graph's OUTPUT schema
 * (agent/src/state.ts LessonStateOutput) — the state-sync allowlist that keeps
 * `questions` (the answer key) and the 40k-char `pdfText` off the wire.
 * `pdfText` appears here only because the client WRITES it via setState as run
 * input; the agent never syncs it back.
 */
export interface LessonAgentState {
  pdfText?: string;
  pdfTitle?: string;
  lessonPlan?: LessonPlan | null;
  objectiveStatuses?: Record<string, ObjectiveStatus>;
  currentObjectiveIndex?: number;
  phase?: "planning" | "awaiting_approval" | "quizzing" | "summary" | "done";
  summary?: Summary | null;
}
