import { StateGraph, START, END } from "@langchain/langgraph";
import { LessonState, LessonStateOutput, type LessonStateType } from "./state.js";
import { planNode } from "./nodes/plan.js";
import { approvalNode } from "./nodes/approval.js";
import { generateMcqsNode } from "./nodes/generateMcqs.js";
import { quizNode } from "./nodes/quizLoop.js";
import { summarizeNode } from "./nodes/summarize.js";

/**
 * Graph topology:
 *
 *   START -> plan --(plan ok)--> approval --(approve)--> generate_mcqs
 *              \--(no plan)--> END          \--(revise)--> plan (loop)
 *   generate_mcqs --(questions)--> quiz     --(nothing generated)--> summarize
 *   quiz --(more questions)--> quiz (next question)
 *   quiz --(objective done)--> generate_mcqs   [quiz advanced the index]
 *   quiz --(all objectives done)--> summarize
 *   summarize -> END
 *
 * Grading + tutoring run client-side (/api/grade, /api/tutor); the quiz
 * interrupt resolves once per question on "Next question". Objective
 * advancement is EXPLICIT: the quiz node increments currentObjectiveIndex when
 * the last question of an objective is answered correctly.
 */

function routeAfterPlan(s: LessonStateType): "approval" | typeof END {
  // Halt instead of interrupting over a null plan (no document / planning failed).
  return s.lessonPlan ? "approval" : END;
}

function routeAfterApproval(s: LessonStateType): "generate_mcqs" | "plan" {
  return s.planApproved ? "generate_mcqs" : "plan";
}

function routeAfterGenerate(s: LessonStateType): "quiz" | "summarize" {
  // generate_mcqs either produced questions for the (possibly skipped-forward)
  // current objective, or exhausted all remaining objectives — never loop back.
  return s.questions.length > 0 ? "quiz" : "summarize";
}

function routeAfterQuiz(s: LessonStateType): "quiz" | "generate_mcqs" | "summarize" {
  if (!s.lastAnswerCorrect) return "quiz"; // malformed resume — re-present question
  if (s.currentQuestionIndex < s.questions.length) return "quiz"; // next question in objective
  // Objective exhausted: quizNode already advanced currentObjectiveIndex.
  const plan = s.lessonPlan;
  if (plan && s.currentObjectiveIndex < plan.objectives.length) return "generate_mcqs";
  return "summarize";
}

const workflow = new StateGraph({
  stateSchema: LessonState,
  input: LessonState,
  // Output schema doubles as the state-sync allowlist: CopilotKit's STATE_SNAPSHOT
  // filter keys off it, so `questions` (answer key) and `pdfText` never reach the
  // browser. See state.ts.
  output: LessonStateOutput,
})
  .addNode("plan", planNode)
  .addNode("approval", approvalNode)
  .addNode("generate_mcqs", generateMcqsNode)
  .addNode("quiz", quizNode)
  .addNode("summarize", summarizeNode)
  .addEdge(START, "plan")
  .addConditionalEdges("plan", routeAfterPlan, ["approval", END])
  .addConditionalEdges("approval", routeAfterApproval, ["generate_mcqs", "plan"])
  .addConditionalEdges("generate_mcqs", routeAfterGenerate, ["quiz", "summarize"])
  .addConditionalEdges("quiz", routeAfterQuiz, ["quiz", "generate_mcqs", "summarize"])
  .addEdge("summarize", END);

/**
 * Compiled without a checkpointer on purpose: the LangGraph dev server (and
 * LangGraph Platform) provide the checkpointer/thread store that powers interrupt()
 * and resume. Our Postgres usage is the attempts ledger (see db.ts). For a fully
 * self-hosted deployment you would pass `{ checkpointer: PostgresSaver.fromConnString(...) }`.
 */
export const graph = workflow.compile();
