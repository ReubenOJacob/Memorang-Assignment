import { getThreadValues, currentQuestion, ThreadError, type ThreadMCQ } from "@/lib/langgraph";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Client-side hint/learn-more tutoring WITHOUT resolving the quiz interrupt:
 * the widget calls this endpoint directly, so the question card never
 * re-renders — the reply just appears beneath the question.
 *
 * The full MCQ (including the answer) is read from the LangGraph thread state
 * HERE, server-side, and only for the CURRENT question; only the vetted tutor
 * text is returned. Guardrails: prompt constraints + verbatim leak check with
 * one regeneration + canned fallback.
 */

function tutorPrompt(
  q: ThreadMCQ,
  kind: "hint" | "learn_more",
  query: string,
  retryCount: number,
  leakRetry = false,
): string {
  const correctText = q.choices.find((c) => c.id === q.correctChoiceId)?.text ?? "";
  const choicesRendered = q.choices.map((c) => `${c.id}: ${c.text}`).join("\n");
  const requestLine = kind === "hint" ? "They asked for a hint." : `They asked: "${query}"`;
  const leakWarning = leakRetry
    ? "\nYOUR PREVIOUS REPLY LEAKED THE ANSWER TEXT. Rewrite it so it does NOT contain or paraphrase the correct choice.\n"
    : "";
  return `You are a patient Socratic tutor helping a student who is mid-quiz.

CURRENT QUESTION: ${q.question}
CHOICES:
${choicesRendered}
CORRECT ANSWER: ${q.correctChoiceId}: ${correctText}
  <- For your awareness ONLY. You must NEVER state it, quote its text, hint at its letter, eliminate the other three options, or construct any explanation from which the answer follows in one trivial step.

SOURCE MATERIAL: ${q.sourceQuote}

STUDENT REQUEST: ${requestLine}
ATTEMPTS SO FAR ON THIS QUESTION: ${retryCount}
${leakWarning}
Respond in under 120 words:
1. Address their request by teaching the UNDERLYING CONCEPT from the source material (definitions, mechanisms, contrasts) — concept-level, never choice-level.
2. If attempts >= 2, be more generous: narrow the conceptual space, still without touching the choices.
3. End with one encouraging sentence steering them back to answer the question.`;
}

async function callLlm(prompt: string): Promise<string> {
  const provider = (process.env.MODEL_PROVIDER ?? "openai").toLowerCase();
  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
        max_tokens: 400,
        temperature: 0.5,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text ?? "";
  }
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
      temperature: 0.5,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(req: Request): Promise<Response> {
  let body: {
    threadId?: string;
    questionId?: string;
    kind?: "hint" | "learn_more";
    query?: string;
    attemptsSoFar?: number;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { threadId, questionId, kind = "hint", query = "", attemptsSoFar } = body;
  if (!threadId || !questionId) {
    return Response.json({ error: "threadId and questionId are required." }, { status: 400 });
  }

  try {
    // Only tutor the CURRENT question, so this route can't fish for hints on
    // upcoming questions in the batch.
    const q = currentQuestion(await getThreadValues(threadId), questionId);
    if (!q) return Response.json({ error: "Question not found in this lesson." }, { status: 404 });

    // Attempt count comes from the client (grading is client-side, so the graph
    // state doesn't track it mid-question); drives the "be more generous" rule.
    const retryCount: number =
      typeof attemptsSoFar === "number" && attemptsSoFar >= 0 ? Math.floor(attemptsSoFar) : 0;

    const correctText = (q.choices.find((c) => c.id === q.correctChoiceId)?.text ?? "").toLowerCase();
    const leaks = (text: string) =>
      (correctText.length >= 4 && text.toLowerCase().includes(correctText)) ||
      new RegExp(`answer\\s+is\\s+${q.correctChoiceId}\\b`, "i").test(text);

    let reply = await callLlm(tutorPrompt(q, kind, query, retryCount));
    if (leaks(reply)) {
      reply = await callLlm(tutorPrompt(q, kind, query, retryCount, true));
      if (leaks(reply)) {
        reply = `Here's a nudge without giving it away: revisit this idea from the material — "${q.sourceQuote}". Think about which option is most consistent with that, then give the question another try.`;
      }
    }
    return Response.json({ text: reply });
  } catch (err) {
    if (err instanceof ThreadError) return Response.json({ error: err.message }, { status: err.status });
    console.error("[tutor] failed:", (err as Error).message);
    return Response.json({ error: "The tutor is unavailable right now — try again." }, { status: 502 });
  }
}
