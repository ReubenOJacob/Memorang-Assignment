import {
  CopilotRuntime,
  EmptyAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AGENT_ID = process.env.LANGGRAPH_AGENT_ID ?? "lesson_agent";
const LANGGRAPH_URL = process.env.LANGGRAPH_URL ?? "http://localhost:8123";

/**
 * Bridges CopilotKit's protocol to the self-hosted LangGraph dev server.
 * The agent id here MUST match:
 *   - the `agent="lesson_agent"` prop on <CopilotKit>, and
 *   - the graph key in agent/langgraph.json.
 *
 * EmptyAdapter is used because all intelligence lives in the LangGraph agent — we
 * don't need a separate chat-completion service adapter.
 */
const serviceAdapter = new EmptyAdapter();

const runtimeInstance = new CopilotRuntime({
  agents: {
    [AGENT_ID]: new LangGraphAgent({
      deploymentUrl: LANGGRAPH_URL,
      graphId: AGENT_ID,
      langsmithApiKey: process.env.LANGSMITH_API_KEY,
    }),
  },
});

const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
  runtime: runtimeInstance,
  serviceAdapter,
  endpoint: "/api/copilotkit",
});

export const POST = (req: NextRequest) => handleRequest(req);
