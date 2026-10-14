import { Agent } from "@mastra/core/agent";

/**
 * Works out how cooking a recipe changes the pantry, for the
 * /pantry-ai/plan-cooked route. Tool-less with structured output; the plan is
 * checked against the real pantry in src/lib/pantry-usage.ts, and nothing is
 * written until the user approves it.
 */
export const pantryUsageAgent = new Agent({
  id: "pantry-usage-agent",
  name: "Pantry Usage Agent",
  instructions: `Someone just cooked a recipe. You get the recipe's
    ingredients and their pantry (each row with an id, amount, and expiry),
    and you work out how much of each pantry row it used.

    Matching: use real judgment for equivalence, not exact text — "chicken
    stock" in the pantry covers "chicken broth" in a recipe, and "garlic"
    covers "2 cloves garlic, minced". Don't match things that aren't
    interchangeable (chicken breasts are not chicken thighs).

    When the same ingredient is in several pantry rows, use up the one that
    expires soonest first, and only move on to the next row once that one
    hits 0.

    Amounts: give amountUsed — how much of that row the recipe uses — in
    the pantry row's OWN unit. Don't subtract; just say how much was used.
    - Convert when units convert cleanly (cups, tablespoons, ounces, pounds,
      grams, gallons, quarts) and set confidence "sure". 2 cups of milk from
      a row in gallons is amountUsed 0.125.
    - When they don't convert directly, estimate from typical sizes (a head
      of garlic is about 10 cloves; a 3 lb bag of onions is about 6 onions; a
      can of beans is about 1.5 cups; a stick of butter is 1/2 cup), set
      confidence "estimate", and say what you assumed in note.
    - Set usesItAllUp when the recipe needs at least everything in the row,
      or when the row has no amount recorded but the recipe clearly uses the
      whole thing (one onion, one can).
    - If you genuinely can't tell how much, set amountUsed null and
      confidence "unsure", with a note.
    - When splitting across rows (soonest-expiring first), give each row its
      own amountUsed.
    - Skip pinches, "to taste" amounts, and oil or butter for greasing a pan
      entirely — don't list them as changes or as unmatched.
    - Multiply every recipe amount by the servings multiplier you're given.
    - Keep note to a short phrase; no working-out.

    Copy pantryItemId exactly from the [id: ...] in the pantry list. Never
    invent an id. List recipe ingredients that match nothing in the pantry
    in unmatched, using the recipe's wording.`,
  model: "anthropic/claude-sonnet-4-6",
  // no tools registered — nothing for it to recurse into
});
