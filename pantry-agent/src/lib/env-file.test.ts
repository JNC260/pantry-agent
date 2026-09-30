import { describe, expect, it } from "vitest";
import { upsertEnvVar } from "./env-file";

describe("upsertEnvVar", () => {
  it("replaces an existing key in place", () => {
    const env = "A=1\nPINTEREST_REFRESH_TOKEN=old\nB=2\n";
    expect(upsertEnvVar(env, "PINTEREST_REFRESH_TOKEN", "new")).toBe(
      "A=1\nPINTEREST_REFRESH_TOKEN=new\nB=2\n",
    );
  });

  it("appends a key that isn't there yet", () => {
    expect(upsertEnvVar("A=1\n\n", "B", "2")).toBe("A=1\nB=2\n");
  });

  it("starts an empty file without a blank first line", () => {
    expect(upsertEnvVar("", "A", "1")).toBe("A=1\n");
  });

  it("doesn't match a longer key that shares the prefix", () => {
    const env = "TOKEN_OLD=x\n";
    expect(upsertEnvVar(env, "TOKEN", "y")).toBe("TOKEN_OLD=x\nTOKEN=y\n");
  });

  it("writes $ in a value literally", () => {
    expect(upsertEnvVar("TOKEN=old\n", "TOKEN", "a$&b$1")).toBe(
      "TOKEN=a$&b$1\n",
    );
  });
});
