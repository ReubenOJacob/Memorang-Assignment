import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load the repo-root .env (shared with the agent) into this server's env —
// Next.js only auto-loads .env files from the web/ directory itself. Needed by
// /api/tutor (LLM key) and /api/seed + /api/copilotkit (LANGGRAPH_URL).
try {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const env = readFileSync(join(root, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  // no root .env — rely on ambient env vars
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
