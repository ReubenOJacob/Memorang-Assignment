import { interrupt } from "@langchain/langgraph";
import type { LessonStateType, LessonStateUpdate } from "../state.js";

/**
 * HITL interrupt #1 — plan approval.
 *
 * Pauses the graph and hands the plan to the browser. Resumes with either
 * { action: 'approve' } or { action: 'revise', feedback }. The router
 * (routeAfterApproval) sends us to generate_mcqs or back to plan accordingly.
 *
 * IMPORTANT: no side effects before interrupt() — this node re-executes from the
 * top on resume, so it must be idempotent up to the interrupt call.
 */
type ApprovalResume =
  | { action: "approve" }
  | { action: "revise"; feedback: string };

export async function approvalNode(state: LessonStateType): Promise<LessonStateUpdate> {
  const decision = interrupt({
    type: "plan_approval",
    plan: state.lessonPlan,
  }) as ApprovalResume;

  if (decision.action === "revise") {
    return {
      planApproved: false,
      planFeedback: decision.feedback ?? "",
      phase: "planning",
    };
  }

  // approve
  return {
    planApproved: true,
    phase: "quizzing",
  };
}
