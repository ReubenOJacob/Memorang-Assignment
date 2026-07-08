import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getModel, SILENT } from "../model.js";
import { mcqPrompt, answerKeyAuditPrompt } from "../prompts.js";
import { objectiveStatusesFor } from "../stats.js";
import {
  McqBatchSchema,
  AnswerKeyCheckSchema,
  type McqBatch,
  type AnswerKeyCheck,
  type MCQ,
  type Objective,
} from "../schemas.js";
import type { LessonStateType, LessonStateUpdate } from "../state.js";

/**
 * Generate 2-3 MCQs for the objective at currentObjectiveIndex, grounded in the PDF.
 *
 * Advancement is NOT inferred here — the quiz node explicitly increments
 * currentObjectiveIndex when an objective completes, and this node simply
 * generates for whatever index it finds.
 *
 * Failure policy: two attempts per objective; if both fail, the objective is
 * SKIPPED (with a visible chat notice) and the next one is tried, so the graph
 * always makes forward progress. If every remaining objective fails, questions
 * stays empty and the conditional edge routes to summarize — never a loop.
 */
export async function generateMcqsNode(state: LessonStateType): Promise<LessonStateUpdate> {
  const plan = state.lessonPlan;
  if (!plan) {
    return { questions: [], phase: "summary" };
  }

  const model = getModel({ temperature: 0.3 });
  const structured = model.withStructuredOutput<McqBatch>(McqBatchSchema, { name: "mcq_batch" });
  const auditor = getModel({ temperature: 0 }).withStructuredOutput<AnswerKeyCheck>(
    AnswerKeyCheckSchema,
    { name: "answer_key_check" },
  );

  /**
   * Answer-key audit: solve each question independently and DROP any question
   * whose stored key the solver disputes (catches keys that contradict the
   * question's own content/explanation). Fails open: if the audit call itself
   * errors, the unaudited batch is used rather than losing the objective.
   */
  const auditKeys = async (questions: MCQ[]): Promise<MCQ[]> => {
    try {
      const check = await auditor.invoke(
        [new HumanMessage(answerKeyAuditPrompt(questions, state.pdfText))],
        SILENT,
      );
      const kept = questions.filter(
        (q) => check.answers.find((a) => a.id === q.id)?.answer === q.correctChoiceId,
      );
      if (kept.length < questions.length) {
        console.error(
          `[generateMcqs] answer-key audit dropped ${questions.length - kept.length} disputed question(s)`,
        );
      }
      return kept;
    } catch (err) {
      console.error("[generateMcqs] answer-key audit failed, using unaudited batch:", (err as Error).message);
      return questions;
    }
  };

  const generate = async (objective: Objective, n: number): Promise<MCQ[]> => {
    const batch = await structured.invoke(
      [new HumanMessage(mcqPrompt(objective, state.pdfText, n))],
      SILENT, // never stream MCQ JSON — the tool-call args contain the answers
    );
    // Defensive: enforce ids + objectiveId even if the model drifts.
    const questions = batch.questions.map((q, i) => ({
      ...q,
      id: `${objective.id}-q${i + 1}`,
      objectiveId: objective.id,
    }));
    const audited = await auditKeys(questions);
    if (audited.length === 0) throw new Error("all answer keys disputed by audit");
    return audited;
  };

  const skippedTitles: string[] = [];
  let objIndex = state.currentObjectiveIndex;

  while (objIndex < plan.objectives.length) {
    const objective = plan.objectives[objIndex];
    for (const n of [3, 2]) {
      try {
        const questions = await generate(objective, n);
        return {
          currentObjectiveIndex: objIndex,
          questions,
          currentQuestionIndex: 0,
          lastAnswerCorrect: true,
          objectiveStatuses: objectiveStatusesFor(plan, objIndex),
          phase: "quizzing",
          ...(skippedTitles.length > 0
            ? {
                messages: [
                  new AIMessage(
                    `I couldn't generate questions for: ${skippedTitles.join(", ")} — skipping ahead so we can keep going.`,
                  ),
                ],
              }
            : {}),
        };
      } catch (err) {
        console.error(
          `[generateMcqs] attempt (n=${n}) failed for "${objective.id}":`,
          (err as Error).message,
        );
      }
    }
    skippedTitles.push(objective.title);
    objIndex += 1;
  }

  // All remaining objectives failed — surface it and let the router summarize.
  return {
    currentObjectiveIndex: objIndex,
    questions: [],
    lastAnswerCorrect: true,
    objectiveStatuses: objectiveStatusesFor(plan, plan.objectives.length),
    messages: [
      new AIMessage(
        `I wasn't able to generate questions for: ${skippedTitles.join(", ")}. Wrapping up with what we covered so far.`,
      ),
    ],
  };
}
