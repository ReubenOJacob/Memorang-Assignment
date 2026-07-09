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

/**
 * Approval is NEVER the fallback. The resume normally arrives as the parsed
 * {action} object from LessonPlanCard, but a typed chat message can also
 * resolve a pending interrupt (same hazard normalizeResume guards in the quiz
 * node) — that text is treated as revision feedback, not as an approval.
 */
function normalizeApproval(raw: unknown): ApprovalResume {
  let v: unknown = raw;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      /* plain text — falls through to the revise-with-feedback default */
    }
  }
  if (v && typeof v === "object") {
    const r = v as Record<string, unknown>;
    if (r.action === "approve") return { action: "approve" };
    if (r.action === "revise") {
      return { action: "revise", feedback: typeof r.feedback === "string" ? r.feedback : "" };
    }
  }
  return { action: "revise", feedback: typeof raw === "string" ? raw : "" };
}

export async function approvalNode(state: LessonStateType): Promise<LessonStateUpdate> {
  const decision = normalizeApproval(
    interrupt({
      type: "plan_approval",
      plan: state.lessonPlan,
    }),
  );

  if (decision.action === "revise") {
    return {
      planApproved: false,
      planFeedback: decision.feedback,
      phase: "planning",
    };
  }

  return {
    planApproved: true,
    phase: "quizzing",
  };
}
