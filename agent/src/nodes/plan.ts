import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { getModel, SILENT } from "../model.js";
import { plannerPrompt } from "../prompts.js";
import { objectiveStatusesFor } from "../stats.js";
import { LessonPlanSchema, type LessonPlan } from "../schemas.js";
import type { LessonStateType, LessonStateUpdate } from "../state.js";

/**
 * Draft (or revise) the lesson plan from the PDF text via structured output.
 * Reached at START and again whenever the user asks for revisions in `approval`.
 *
 * If there is no document text, lessonPlan stays null and the plan->END
 * conditional edge halts the run (never an approval interrupt over a null plan).
 */
export async function planNode(state: LessonStateType): Promise<LessonStateUpdate> {
  if (!state.pdfText || state.pdfText.trim().length === 0) {
    return {
      messages: [
        new AIMessage(
          "I couldn't find any document text yet. Please upload a PDF so I can draft your lesson plan.",
        ),
      ],
      lessonPlan: null,
      phase: "planning",
    };
  }

  const model = getModel({ temperature: 0.2 });
  const structured = model.withStructuredOutput<LessonPlan>(LessonPlanSchema, { name: "lesson_plan" });

  const prompt = plannerPrompt(state.pdfTitle || "Untitled", state.pdfText, state.planFeedback);
  const plan = await structured.invoke([new HumanMessage(prompt)], SILENT);

  return {
    lessonPlan: plan,
    objectiveStatuses: objectiveStatusesFor(plan, 0),
    planApproved: false,
    planFeedback: "", // consumed
    phase: "awaiting_approval",
  };
}
