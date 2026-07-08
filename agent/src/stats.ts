import type {
  Attempt,
  HintEvent,
  LessonPlan,
  LessonStats,
  ObjectiveResult,
  ObjectiveStatus,
} from "./schemas.js";

/**
 * Deterministic stats from the event ledgers. Computed in pure TS — the LLM only
 * narrates these numbers, it never derives them (LLM for language, code for logic).
 *
 * Hint counts come from `hintEvents` (one record per actual hint/learn-more click),
 * NOT from the per-attempt `usedHint` flag — that flag marks attempts influenced by
 * a hint and would over/under-count the number of hints requested.
 */
export function computeStats(
  plan: LessonPlan,
  attempts: Attempt[],
  hintEvents: HintEvent[],
): LessonStats {
  const perObjective: ObjectiveResult[] = plan.objectives.map((obj) => {
    const objAttempts = attempts.filter((a) => a.objectiveId === obj.id);
    const questionIds = [...new Set(objAttempts.map((a) => a.questionId))];

    let firstTryCorrect = 0;
    for (const qid of questionIds) {
      const first = objAttempts.find((a) => a.questionId === qid && a.attemptNumber === 1);
      if (first?.isCorrect) firstTryCorrect += 1;
    }
    const hintsRequested = hintEvents.filter((h) => h.objectiveId === obj.id).length;
    const questions = questionIds.length;
    const accuracyPct = questions === 0 ? 0 : Math.round((firstTryCorrect / questions) * 100);

    return {
      objectiveId: obj.id,
      title: obj.title,
      questions,
      firstTryCorrect,
      totalAttempts: objAttempts.length,
      hintsRequested,
      accuracyPct,
    };
  });

  const totalQuestions = perObjective.reduce((s, o) => s + o.questions, 0);
  const firstTryCorrect = perObjective.reduce((s, o) => s + o.firstTryCorrect, 0);
  const totalAttempts = perObjective.reduce((s, o) => s + o.totalAttempts, 0);
  const hintsRequested = hintEvents.length;
  // Objectives with zero answered questions (e.g. generation skipped) are excluded
  // from strongest/weakest so an unseen objective is never reported as "weakest".
  const answeredObjectives = perObjective.filter((o) => o.questions > 0);

  const sortedByAcc = [...answeredObjectives].sort((a, b) => b.accuracyPct - a.accuracyPct);
  const strongest = sortedByAcc[0]?.title ?? "—";
  const worst = sortedByAcc[sortedByAcc.length - 1];
  // Only name a "weakest" when it is genuinely weaker than the best AND not a
  // perfect score — otherwise a flawless run would label a 100% objective weakest.
  const weakest =
    worst && worst.accuracyPct < 100 && worst.title !== strongest ? worst.title : "—";

  return {
    perObjective,
    overall: {
      totalQuestions,
      firstTryCorrect,
      firstTryAccuracyPct: totalQuestions === 0 ? 0 : Math.round((firstTryCorrect / totalQuestions) * 100),
      totalAttempts,
      totalRetries: Math.max(0, totalAttempts - totalQuestions),
      hintsRequested,
      strongest,
      weakest,
    },
  };
}

/**
 * Single source of truth for per-objective status derivation (used by the plan,
 * generate_mcqs, and summarize nodes): objectives before `activeIndex` are done,
 * `activeIndex` is in progress, the rest pending. Pass plan.objectives.length as
 * activeIndex to mark everything done.
 */
export function objectiveStatusesFor(
  plan: LessonPlan,
  activeIndex: number,
): Record<string, ObjectiveStatus> {
  const statuses: Record<string, ObjectiveStatus> = {};
  plan.objectives.forEach((o, i) => {
    statuses[o.id] = i < activeIndex ? "done" : i === activeIndex ? "in_progress" : "pending";
  });
  return statuses;
}
