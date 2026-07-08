import { HumanMessage } from "@langchain/core/messages";
import { getModel, SILENT } from "../model.js";
import { summaryPrompt } from "../prompts.js";
import { computeStats, objectiveStatusesFor } from "../stats.js";
import {
  SummaryNarrativeSchema,
  type SummaryNarrative,
  type Summary,
} from "../schemas.js";
import type { LessonStateType, LessonStateUpdate } from "../state.js";

/**
 * Final node. Stats are computed deterministically from the event ledgers;
 * the LLM only turns those numbers into a narrative + personalized study tips.
 */
export async function summarizeNode(state: LessonStateType): Promise<LessonStateUpdate> {
  const plan = state.lessonPlan;
  if (!plan) return { phase: "done" };

  const stats = computeStats(plan, state.attempts, state.hintEvents);

  const model = getModel({ temperature: 0.4 });
  const structured = model.withStructuredOutput<SummaryNarrative>(SummaryNarrativeSchema, {
    name: "summary",
  });

  let summary: Summary;
  try {
    const narrative = await structured.invoke(
      [new HumanMessage(summaryPrompt(plan.title, stats))],
      SILENT,
    );
    summary = { stats, narrative };
  } catch (err) {
    console.error("[summarize] narration failed, using deterministic fallback:", (err as Error).message);
    summary = {
      stats,
      narrative: {
        headline: `You completed "${plan.title}" with ${stats.overall.firstTryAccuracyPct}% first-try accuracy.`,
        objectiveBreakdown: stats.perObjective.map(
          (o) => `${o.title}: ${o.firstTryCorrect}/${o.questions} correct on the first try.`,
        ),
        studyTips: [
          stats.overall.weakest !== "—"
            ? `Revisit "${stats.overall.weakest}" — it needed the most tries.`
            : "Try to explain each objective aloud in one sentence to test recall.",
          "Re-read the source passages behind any question you retried.",
          "Space out a quick review tomorrow to lock in what you learned.",
        ],
        encouragement: "Nice work finishing the lesson — keep going!",
      },
    };
  }

  // No chat message: the SummaryReport component is the single rendering of
  // the summary (a chat echo duplicated the headline/encouragement on screen).
  return {
    summary,
    objectiveStatuses: objectiveStatusesFor(plan, plan.objectives.length),
    phase: "summary",
  };
}
