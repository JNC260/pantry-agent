import axios from "axios";

let cachedToken: string | null = null;
let expiresAt = 0; // epoch ms

export async function getValidPinterestToken(): Promise<string> {
  const now = Date.now();

  // refresh a bit early (60s buffer) to avoid edge-case races
  if (cachedToken && now < expiresAt - 60_000) {
    return cachedToken;
  }

  const response = await axios.post(
    "https://api.pinterest.com/v5/oauth/token",
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: process.env.PINTEREST_REFRESH_TOKEN!,
    }),
    {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.PINTEREST_CLIENT_ID}:${process.env.PINTEREST_CLIENT_SECRET}`
        ).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  cachedToken = response.data.access_token;
  // Pinterest returns expires_in (seconds)
  expiresAt = now + response.data.expires_in * 1000;

  return cachedToken;
}