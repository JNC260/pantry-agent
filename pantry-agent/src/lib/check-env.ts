const REQUIRED_ENV = {
  ANTHROPIC_API_KEY: "every agent's model",
  TAVILY_API_KEY: "web search and recipe extraction",
  PINTEREST_CLIENT_ID: "Pinterest token refresh",
  PINTEREST_CLIENT_SECRET: "Pinterest token refresh",
  PINTEREST_REFRESH_TOKEN: "Pinterest token refresh",
  PANTRY_DB_URL: "reading the pantry for grocery lists",
} as const;

// Called at the top of src/mastra/index.ts. It's an explicit call rather
// than a side-effect import because `mastra build` tree-shakes imports it
// considers side-effect free. Logs instead of throwing: without Pinterest the
// agent can still answer from web search, and /health/pinterest reports the
// broken connection.
export function checkRequiredEnv() {
  const missing = Object.entries(REQUIRED_ENV).filter(
    ([name]) => !process.env[name],
  );
  if (missing.length > 0) {
    console.error(
      "[check-env] Missing environment variables:\n" +
        missing.map(([name, usedFor]) => `  ${name} (${usedFor})`).join("\n"),
    );
  }
}
