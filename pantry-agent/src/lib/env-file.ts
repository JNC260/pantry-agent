// Sets `key=value` in the text of a .env file: replaces the existing line for
// that key, or appends one. Other lines are left untouched.
export function upsertEnvVar(
  envContent: string,
  key: string,
  value: string,
): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(envContent)) {
    // A replacer function, so a `$` in the value is inserted literally
    // rather than read as a replacement pattern like `$&`.
    return envContent.replace(pattern, () => line);
  }
  const rest = envContent.trimEnd();
  return rest ? `${rest}\n${line}\n` : `${line}\n`;
}
