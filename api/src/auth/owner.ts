// The app has a single user. This id is the JWT's `sub` claim and the
// `user_id` on every pantry row. pantry-agent's pantry-db.ts reads the same
// rows, so it must use the same value.
export const OWNER_ID = 'owner';
