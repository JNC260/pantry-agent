import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { execFile } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../.env"); // project root .env

dotenv.config({ path: ENV_PATH });

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID!;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET!;
// Must exactly match a redirect URI registered on the Pinterest app.
const REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI || "http://localhost:3000/callback";
const redirectUrl = new URL(REDIRECT_URI);
const PORT = Number(redirectUrl.port || 80);
const SCOPES = "boards:read,pins:read"; // adjust if your app needs more

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing PINTEREST_CLIENT_ID / PINTEREST_CLIENT_SECRET in .env");
  process.exit(1);
}

const state = randomBytes(8).toString("hex");

function buildAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    state,
  });
  return `https://www.pinterest.com/oauth/?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number; // seconds
};

async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const response = await axios.post<TokenResponse>(
    "https://api.pinterest.com/v5/oauth/token",
    new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return response.data;
}

function upsertEnvVar(envContent: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, "m");
  if (regex.test(envContent)) {
    return envContent.replace(regex, line);
  }
  return envContent.trimEnd() + `\n${line}\n`;
}

function saveTokensToEnv(accessToken: string, refreshToken: string) {
  let envContent = fs.readFileSync(ENV_PATH, "utf-8");
  envContent = upsertEnvVar(envContent, "PINTEREST_ACCESS_TOKEN", accessToken);
  envContent = upsertEnvVar(envContent, "PINTEREST_REFRESH_TOKEN", refreshToken);
  fs.writeFileSync(ENV_PATH, envContent);
}

function main() {
  const app = express();
  const authUrl = buildAuthUrl();

  // Stops the local server and exits once the one callback is handled.
  function finish(res: express.Response, message: string, exitCode: number) {
    res.type("text/plain").send(message);
    server.close();
    process.exit(exitCode);
  }

  app.get(redirectUrl.pathname, async (req, res) => {
    const { code, state: returnedState, error } = req.query;

    if (error) {
      return finish(res, `Authorization failed: ${String(error)}. Check your terminal and try again.`, 1);
    }
    if (returnedState !== state) {
      return finish(res, "State mismatch — possible CSRF issue. Aborting.", 1);
    }
    if (!code || typeof code !== "string") {
      return finish(res, "No code returned. Check your terminal.", 1);
    }

    try {
      console.log("Got code, exchanging for tokens immediately...");
      const tokens = await exchangeCodeForTokens(code);
      saveTokensToEnv(tokens.access_token, tokens.refresh_token);

      console.log("\nSuccess! Saved to .env:");
      console.log("  PINTEREST_ACCESS_TOKEN");
      console.log("  PINTEREST_REFRESH_TOKEN");
      console.log(`\nAccess token expires in ${tokens.expires_in}s, but the refresh token will keep you going from here on.`);
      finish(res, "Authorization complete! Tokens saved. You can close this tab and return to your terminal.", 0);
    } catch (err) {
      console.error(
        "Token exchange failed:",
        axios.isAxiosError(err) ? (err.response?.data ?? err.message) : err,
      );
      finish(res, "Token exchange failed — check your terminal for details.", 1);
    }
  });

  const server = app.listen(PORT, () => {
    console.log("\nOpening Pinterest authorization in your browser...");
    console.log("If it doesn't open automatically, visit:\n" + authUrl + "\n");

    // Best-effort auto-open (macOS). execFile passes the URL as an argument
    // rather than through a shell.
    execFile("open", [authUrl], () => {});
  });

  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${PORT} (from ${REDIRECT_URI}) is in use. Stop whatever is running there (e.g. the api) and try again.`,
      );
    } else {
      console.error("Could not start the callback server:", err);
    }
    process.exit(1);
  });
}

main();
