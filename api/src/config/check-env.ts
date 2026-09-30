// Imported for its side effect, before AppModule, so a missing variable
// fails at startup with a clear message instead of deep inside a request
// (or with a cryptic error from a client created at import time).
const REQUIRED_ENV = [
  'AUTH_PASSWORD_HASH',
  'JWT_SECRET',
  'PANTRY_DB_URL',
] as const;

const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}`,
  );
}
