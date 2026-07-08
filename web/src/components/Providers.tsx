"use client";

import { CopilotKit } from "@copilotkit/react-core";
import { createContext, useContext, useEffect, useState } from "react";

const KEY = "pdf-lesson-thread-id";
const AGENT_ID = "lesson_agent";

/**
 * Thread lifecycle: one lesson = one LangGraph thread. The active threadId is
 * React state (CopilotKit's threadId prop is controlled), persisted to
 * localStorage so a refresh reconnects to the same lesson. `newThread()` mints
 * a fresh thread — called on every new upload so a new document NEVER lands in
 * an old thread (uploading into a mid-lesson thread corrupts it: stale
 * messages, abandoned interrupts, replanning over quiz state).
 */
const ThreadContext = createContext<{ threadId: string | null; newThread: () => string }>({
  threadId: null,
  newThread: () => "",
});

export function useThread() {
  return useContext(ThreadContext);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    setThreadId(id);
  }, []);

  const newThread = () => {
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    setThreadId(id);
    return id;
  };

  // Wait for the threadId so the provider mounts with a stable thread.
  if (!threadId) return null;

  return (
    <ThreadContext.Provider value={{ threadId, newThread }}>
      <CopilotKit
        runtimeUrl="/api/copilotkit"
        agent={AGENT_ID}
        threadId={threadId}
        showDevConsole={false}
        enableInspector={false}
      >
        {children}
      </CopilotKit>
    </ThreadContext.Provider>
  );
}

export function resetThread() {
  localStorage.removeItem(KEY);
  location.reload();
}
