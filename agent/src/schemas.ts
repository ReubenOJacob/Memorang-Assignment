import { z } from "zod";

/**
 * All structured-data contracts live here. These zod schemas are:
 *  - fed to `model.withStructuredOutput(...)` so the LLM MUST return valid JSON, and
 *  - the single source of truth for the TypeScript types used across the graph.
 * The web app mirrors the display-only subset of these in web/src/lib/types.ts.
 */

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Difficulty = z.infer<typeof DifficultySchema>;

export const ChoiceIdSchema = z.enum(["A", "B", "C", "D"]);
export type ChoiceId = z.infer<typeof ChoiceIdSchema>;

// ─── Lesson plan ─────────────────────────────────────────────────────────────

export const ObjectiveSchema = z.object({
  id: z.string().describe("kebab-case slug, unique within the plan"),
  title: z.string().describe("<=8 words, starts with a verb: Explain / Distinguish / Apply"),
  description: z.string().describe("1-2 sentences: what the student will be able to do"),
  difficulty: DifficultySchema,
});
export type Objective = z.infer<typeof ObjectiveSchema>;

export const LessonPlanSchema = z.object({
  title: z.string().describe("short lesson title derived from the document"),
  difficulty: DifficultySchema.describe("overall difficulty of the lesson"),
  objectives: z
    .array(ObjectiveSchema)
    .min(1)
    .max(5)
    .describe("3-5 objectives ordered so earlier ones are prerequisites for later ones"),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;

// Objective status is tracked separately in state (not produced by the LLM).
export type ObjectiveStatus = "pending" | "in_progress" | "done";

// ─── MCQs ────────────────────────────────────────────────────────────────────

export const McqSchema = z.object({
  id: z.string().describe("unique id, e.g. `${objectiveId}-q1`"),
  objectiveId: z.string(),
  question: z.string().describe("self-contained; never 'according to the passage above'"),
  choices: z
    .array(z.object({ id: ChoiceIdSchema, text: z.string() }))
    .length(4)
    .describe("exactly 4 choices A-D"),
  correctChoiceId: ChoiceIdSchema,
  explanation: z.string().describe("shown AFTER a correct answer; teaches why"),
  hint: z.string().describe("shown after a WRONG answer; must not reveal/force the answer"),
  sourceQuote: z.string().describe("short verbatim-ish snippet from the document grounding the answer"),
});
export type MCQ = z.infer<typeof McqSchema>;

export const McqBatchSchema = z.object({
  questions: z.array(McqSchema).min(2).max(3),
});
export type McqBatch = z.infer<typeof McqBatchSchema>;

/** Output of the answer-key audit: an independent solve of each question. */
export const AnswerKeyCheckSchema = z.object({
  answers: z.array(
    z.object({
      id: z.string(),
      answer: ChoiceIdSchema.describe("the letter this question's correct choice, derived independently"),
    }),
  ),
});
export type AnswerKeyCheck = z.infer<typeof AnswerKeyCheckSchema>;

/** The subset of an MCQ that is safe to send to the browser (no answer leak). */
export type SafeMCQ = {
  id: string;
  question: string;
  choices: { id: ChoiceId; text: string }[];
};
export function toSafeMcq(q: MCQ): SafeMCQ {
  return { id: q.id, question: q.question, choices: q.choices };
}

// ─── Attempts (the ledger the summary is derived from) ───────────────────────

export type Attempt = {
  questionId: string;
  objectiveId: string;
  selected: ChoiceId;
  isCorrect: boolean;
  attemptNumber: number; // 1-based, per question
  usedHint: boolean; // this attempt came after at least one hint on the question
};

/** One record per actual hint/learn-more click — the source of truth for hint counts. */
export type HintEvent = {
  questionId: string;
  objectiveId: string;
  kind: "hint" | "learn_more";
};

// ─── Summary ─────────────────────────────────────────────────────────────────

// Computed deterministically in stats.ts — never LLM-produced, so a plain type.
export type ObjectiveResult = {
  objectiveId: string;
  title: string;
  questions: number;
  firstTryCorrect: number;
  totalAttempts: number;
  hintsRequested: number;
  accuracyPct: number;
};

/** Deterministic stats computed in TS from the attempts ledger. */
export type LessonStats = {
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
};

// The LLM only narrates the (already-computed) stats.
export const SummaryNarrativeSchema = z.object({
  headline: z.string().describe("one-sentence overall assessment"),
  objectiveBreakdown: z.array(z.string()).describe("one sentence per objective"),
  studyTips: z
    .array(z.string())
    .length(3)
    .describe("3 tips, each tied to a SPECIFIC weak objective or error pattern"),
  encouragement: z.string().describe("one closing line"),
});
export type SummaryNarrative = z.infer<typeof SummaryNarrativeSchema>;

/** What lands in state.summary and renders in SummaryReport. */
export type Summary = {
  stats: LessonStats;
  narrative: SummaryNarrative;
};
