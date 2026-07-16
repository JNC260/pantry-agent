import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import { exec } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, "../../.env"); // project root .env

dotenv.config({ path: ENV_PATH });

const CLIENT_ID = process.env.PINTEREST_CLIENT_ID!;
const CLIENT_SECRET = process.env.PINTEREST_CLIENT_SECRET!;
const REDIRECT_URI = process.env.PINTEREST_REDIRECT_URI || "http://localhost:3000/callback";
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

async function exchangeCodeForTokens(code: string) {
  const response = await axios.post(
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
  return response.data; // { access_token, refresh_token, expires_in, ... }
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

async function main() {
  const app = express();
  const authUrl = buildAuthUrl();

  const server = app.listen(3000, async () => {
    console.log("\nOpening Pinterest authorization in your browser...");
    console.log("If it doesn't open automatically, visit:\n" + authUrl + "\n");

    // best-effort auto-open (macOS)
    exec(`open "${authUrl}"`, () => {});
  });

  app.get("/callback", async (req, res) => {
    const { code, state: returnedState, error } = req.query;

    if (error) {
      res.send(`Authorization failed: ${error}. Check your terminal and try again.`);
      server.close();
      process.exit(1);
    }

    if (returnedState !== state) {
      res.send("State mismatch — possible CSRF issue. Aborting.");
      server.close();
      process.exit(1);
    }

    if (!code || typeof code !== "string") {
      res.send("No code returned. Check your terminal.");
      server.close();
      process.exit(1);
    }

    try {
      console.log("Got code, exchanging for tokens immediately...");
      const tokens = await exchangeCodeForTokens(code);

      saveTokensToEnv(tokens.access_token, tokens.refresh_token);

      console.log("\nSuccess! Saved to .env:");
      console.log("  PINTEREST_ACCESS_TOKEN");
      console.log("  PINTEREST_REFRESH_TOKEN");
      console.log(`\nAccess token expires in ${tokens.expires_in}s, but the refresh token will keep you going from here on.`);

      res.send("Authorization complete! Tokens saved. You can close this tab and return to your terminal.");
    } catch (err: any) {
      console.error("Token exchange failed:", err.response?.data ?? err.message);
      res.send("Token exchange failed — check your terminal for details.");
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

main();