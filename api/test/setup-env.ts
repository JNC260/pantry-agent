// Runs before each e2e suite. Always overrides, so tests never reach a real
// database or reuse a real signing secret from the environment.
process.env.PANTRY_DB_URL = 'file::memory:';
process.env.PANTRY_DB_AUTH_TOKEN = '';
process.env.JWT_SECRET = 'e2e-test-secret';
