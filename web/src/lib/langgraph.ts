/**
 * Shared server-side access to the self-hosted LangGraph thread state, used by
 * the /api/grade, /api/tutor and /api/seed routes. One place for the base URL,
 * the state fetch, and the current-question lookup.
 */
export const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:8123";
export const LANGGRAPH_AGENT_ID = process.env.LANGGRAPH_AGENT_ID ?? "lesson_agent";

/** Full MCQ shape as stored server-side (includes the answer key — never returned raw). */
export type ThreadMCQ = {
  id: string;
  objectiveId: string;
  question: string;
  choices: { id: string; text: string }[];
  correctChoiceId: string;
  explanation: string;
  hint: string;
  sourceQuote: string;
};

export type ThreadValues = {
  questions?: ThreadMCQ[];
  currentQuestionIndex?: number;
  [k: string]: unknown;
};

/** Thrown with an HTTP status the route can forward verbatim. */
export class ThreadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Read the thread's channel values from the LangGraph platform REST API. */
export async function getThreadValues(threadId: string): Promise<ThreadValues> {
  const res = await fetch(`${LANGGRAPH_URL}/threads/${threadId}/state`);
  if (!res.ok) throw new ThreadError(502, `Could not load lesson state (${res.status}).`);
  return (await res.json()).values ?? {};
}

/**
 * The question currently on screen, matched by id. Returns null for any other id
 * so a client can't fish grades/hints for upcoming questions in the batch (their
 * answers live in the same `questions` array).
 */
export function currentQuestion(values: ThreadValues, questionId: string): ThreadMCQ | null {
  const idx = values.currentQuestionIndex ?? 0;
  const q = values.questions?.[idx];
  return q?.id === questionId ? q : null;
}
