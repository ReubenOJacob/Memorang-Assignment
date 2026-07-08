import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { RunnableConfig } from "@langchain/core/runnables";

/**
 * Config for INTERNAL LLM calls (plan/MCQ/summary structured output): the
 * CopilotKit bridge streams chat-model tokens to the browser unless these
 * metadata flags are false. Without this, raw JSON flashes in the chat while
 * generating — and the MCQ call would stream tool-call args CONTAINING THE
 * ANSWERS. Only the tutor's user-facing prose should stream.
 */
export const SILENT: RunnableConfig = {
  metadata: { "emit-messages": false, "emit-tool-calls": false },
};

/**
 * Provider-agnostic model factory. The graph never instantiates a model inline —
 * swapping providers is one env var, one file. Default: OpenAI.
 */
export function getModel(opts: { temperature?: number } = {}): BaseChatModel {
  const provider = (process.env.MODEL_PROVIDER ?? "openai").toLowerCase();
  const temperature = opts.temperature ?? 0.2;

  // Bound each call so a network blip fails fast (into the UI's recovery net)
  // instead of retrying with backoff for minutes.
  const timeout = 45_000;
  const maxRetries = 2;

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("MODEL_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set.");
    }
    return new ChatAnthropic({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
      temperature,
      apiKey: process.env.ANTHROPIC_API_KEY,
      maxRetries,
      clientOptions: { timeout },
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set. Add it to .env (or set MODEL_PROVIDER=anthropic).");
  }
  return new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    temperature,
    apiKey: process.env.OPENAI_API_KEY,
    timeout,
    maxRetries,
  });
}
