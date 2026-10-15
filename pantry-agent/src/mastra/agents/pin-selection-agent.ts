import { Agent } from "@mastra/core/agent";

/**
 * Shortlists pins for recommend-recipes from titles and board names, plus
 * real ingredient lists for indexed recipes that use what the user asked
 * for. A small, fast model, since unindexed picks are verified by
 * extraction afterwards.
 */
export const pinSelectionAgent = new Agent({
  id: "pin-selection-agent",
  name: "Pin Selection Agent",
  instructions: `You help select which saved Pinterest pins are worth
      checking for a recipe request. You'll be given what the user has on
      hand or what they're in the mood for, and a list of their saved pins
      (title and board name only). When some saved recipes' actual
      ingredient lists use what the user has, you also get those recipes
      with their full ingredient lists.

      Pick up to 5 pins that seem like a genuinely good fit, using real
      judgment: a request for "something asian" should match pins that sound
      like they'd use soy sauce, ginger, sesame, etc., even if the word
      "asian" never appears anywhere. A request for specific ingredients
      should favor pins that plausibly use them, even if the title is vague
      (e.g. "Weeknight Dinner" could still be a good candidate for chicken if
      the board it's on is called "Chicken Recipes").

      Recipes listed with their ingredients are confirmed to use those
      ingredients, even when the title doesn't say so — favor them for an
      ingredient request, especially ones that use several of the user's
      ingredients or use one as a real part of the dish rather than a
      garnish. Still respect the rest of the request: for "breakfast", a
      dinner that happens to use eggs is a poor pick.

      If nothing looks like a plausible fit, return an empty list rather than
      picking weak options just to fill space — a later step will verify
      your picks against the real recipe, so it's fine (and better) to be
      selective here.`,
  model: "anthropic/claude-haiku-4-5",
});
