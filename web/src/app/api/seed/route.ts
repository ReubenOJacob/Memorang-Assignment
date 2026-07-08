import { LANGGRAPH_URL, LANGGRAPH_AGENT_ID } from "@/lib/langgraph";

export const runtime = "nodejs";

/**
 * Seeds the extracted document into the LangGraph thread state BEFORE the chat
 * kickoff runs the graph. Server-side and awaited by the client, so the plan
 * node deterministically sees pdfText — no dependency on CopilotKit's
 * client-state sync (which does not reliably deliver setState values as run
 * input). The thread is created with graph metadata so state updates attach.
 */
export async function POST(req: Request): Promise<Response> {
  let body: { threadId?: string; pdfText?: string; pdfTitle?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { threadId, pdfText, pdfTitle } = body;
  if (!threadId || !pdfText) {
    return Response.json({ error: "threadId and pdfText are required." }, { status: 400 });
  }

  try {
    const create = await fetch(`${LANGGRAPH_URL}/threads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thread_id: threadId,
        metadata: { graph_id: LANGGRAPH_AGENT_ID },
        if_exists: "do_nothing",
      }),
    });
    if (!create.ok) {
      return Response.json(
        { error: `Agent server rejected thread creation (${create.status}).` },
        { status: 502 },
      );
    }

    const seed = await fetch(`${LANGGRAPH_URL}/threads/${threadId}/state`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        values: { pdfText, pdfTitle: pdfTitle ?? "Untitled", phase: "planning" },
        as_node: "__start__",
      }),
    });
    if (!seed.ok) {
      return Response.json(
        { error: `Agent server rejected state seed (${seed.status}).` },
        { status: 502 },
      );
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "Could not reach the agent server. Is it running on " + LANGGRAPH_URL + "?" },
      { status: 502 },
    );
  }
}
