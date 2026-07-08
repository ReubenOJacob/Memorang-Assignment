import { getThreadValues, currentQuestion, ThreadError } from "@/lib/langgraph";

export const runtime = "nodejs";

/**
 * Client-side grading WITHOUT resolving the quiz interrupt — the widget calls
 * this on Submit so the result (green explanation / red hint) renders beneath
 * the question with no card re-render. The graph only advances when the widget
 * later resolves the interrupt with the correct answer ("Next question").
 *
 * Grading is server-authoritative: the answer key is read from the LangGraph
 * thread state HERE, and only for the CURRENT question. The response reveals
 * `explanation` + the correct choice ONLY on a correct answer; a wrong answer
 * gets only the hint. (Trust caveat: see README "Known limitations".)
 */
export async function POST(req: Request): Promise<Response> {
  let body: { threadId?: string; questionId?: string; choiceId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { threadId, questionId, choiceId } = body;
  if (!threadId || !questionId || !choiceId || !["A", "B", "C", "D"].includes(choiceId)) {
    return Response.json({ error: "threadId, questionId and choiceId (A-D) are required." }, { status: 400 });
  }

  try {
    const q = currentQuestion(await getThreadValues(threadId), questionId);
    if (!q) return Response.json({ error: "Question not found in this lesson." }, { status: 404 });

    if (choiceId === q.correctChoiceId) {
      return Response.json({
        correct: true,
        explanation: q.explanation,
        revealedCorrectChoiceId: q.correctChoiceId, // no longer secret once earned
      });
    }
    return Response.json({ correct: false, hint: q.hint });
  } catch (err) {
    if (err instanceof ThreadError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[grade] failed:", (err as Error).message);
    return Response.json({ error: "Grading is unavailable right now — try again." }, { status: 502 });
  }
}
