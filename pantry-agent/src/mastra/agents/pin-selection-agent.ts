import { Agent } from "@mastra/core/agent";

export const pinSelectionAgent = new Agent({
  id: "pin-selection-agent",
  name: "Pin Selection Agent",
  instructions: `You help select which saved Pinterest pins are worth
      checking for a recipe request. You'll be given what the user has on
      hand or what they're in the mood for, and a list of their saved pins
      (title and board name only — you have not seen the actual recipe
      content yet).

      Pick up to 5 pins that seem like a genuinely good fit, using real
      judgment: a request for "something asian" should match pins that sound
      like they'd use soy sauce, ginger, sesame, etc., even if the word
      "asian" never appears anywhere. A request for specific ingredients
      should favor pins that plausibly use them, even if the title is vague
      (e.g. "Weeknight Dinner" could still be a good candidate for chicken if
      the board it's on is called "Chicken Recipes").

      If nothing looks like a plausible fit, return an empty list rather than
      picking weak options just to fill space — a later step will verify
      your picks against the real recipe, so it's fine (and better) to be
      selective here.`,
  model: "anthropic/claude-sonnet-4-6",
});
