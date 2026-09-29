// Mirrored in web/src/lib/pantry-api.ts — keep the two lists in sync.
export const PANTRY_CATEGORIES = [
  'produce',
  'meat_seafood',
  'dairy_eggs',
  'grains_pasta',
  'canned_jarred',
  'condiments_sauces',
  'spices_seasonings',
  'baking',
  'snacks',
  'frozen',
  'beverages',
  'other',
] as const;

export type PantryCategory = (typeof PANTRY_CATEGORIES)[number];
