import { registerApiRoute } from "@mastra/core/server";
import { isValidationError, noopObserve } from "@mastra/core/tools";
import { z } from "zod";
import { formatRecipeLine } from "../../lib/grocery-prompt";
import { getPantryRows } from "../../lib/pantry-db";
import {
  formatUsagePantryLine,
  toCookedProposal,
  usagePlanSchema,
} from "../../lib/pantry-usage";
import {
  parsedReceiptSchema,
  toReceiptProposal,
} from "../../lib/receipt-items";
import { extractRecipeTool } from "../tools/extract-recipe";

// The media types Claude can read directly.
const RECEIPT_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

const parseReceiptBody = z
  .object({
    files: z
      .array(
        z.object({
          data: z.string().min(1).describe("base64"),
          mediaType: z.enum(RECEIPT_MEDIA_TYPES),
        }),
      )
      .max(6)
      .default([]),
    text: z.string().max(20_000).optional(),
  })
  .refine((body) => body.files.length > 0 || body.text?.trim(), {
    message: "Send at least one file or some text",
  });

/**
 * POST /pantry-ai/parse-receipt: reads a receipt into proposed pantry items.
 * Writes nothing — the api applies whatever the user approves.
 */
export const parseReceiptRoute = registerApiRoute("/pantry-ai/parse-receipt", {
  method: "POST",
  handler: async (c) => {
    const parsedBody = parseReceiptBody.safeParse(await c.req.json());
    if (!parsedBody.success) {
      return c.json({ error: parsedBody.error.message }, 400);
    }
    const { files, text } = parsedBody.data;

    const pantry = await getPantryRows();
    const existingIngredients = [
      ...new Set(pantry.map((item) => item.ingredient)),
    ];

    const prompt = `Already in the pantry:
${existingIngredients.join("\n") || "(pantry is empty)"}

Turn every line of this receipt into a pantry item.${
      text?.trim() ? `\n\nRECEIPT TEXT:\n${text.trim()}` : ""
    }`;

    const result = await c
      .get("mastra")
      .getAgent("receiptAgent")
      .generate(
        [
          {
            role: "user",
            content: [
              ...files.map((file) => ({
                type: "file" as const,
                data: file.data,
                mediaType: file.mediaType,
              })),
              { type: "text" as const, text: prompt },
            ],
          },
        ],
        { structuredOutput: { schema: parsedReceiptSchema } },
      );

    return c.json(toReceiptProposal(result.object, existingIngredients));
  },
});

const planCookedBody = z
  .object({
    url: z.url().optional(),
    ingredientsText: z.string().max(20_000).optional(),
    servings: z.number().positive().max(20).default(1),
  })
  .refine((body) => !!body.url !== !!body.ingredientsText?.trim(), {
    message: "Send either a recipe url or ingredientsText",
  });

/**
 * POST /pantry-ai/plan-cooked: proposes how cooking a recipe (from a link or
 * a pasted ingredient list) changes the pantry. Writes nothing — the api
 * applies whatever the user approves.
 */
export const planCookedRoute = registerApiRoute("/pantry-ai/plan-cooked", {
  method: "POST",
  handler: async (c) => {
    const parsedBody = planCookedBody.safeParse(await c.req.json());
    if (!parsedBody.success) {
      return c.json({ error: parsedBody.error.message }, 400);
    }
    const { url, ingredientsText, servings } = parsedBody.data;
    const mastra = c.get("mastra");

    let recipe: string;
    let title: string | null = null;
    if (url) {
      // Called outside an agent run, so there's no tracing context to join.
      // The tool throws when the page can't be fetched.
      const extracted = await extractRecipeTool
        .execute?.({ url }, { mastra, observe: noopObserve })
        .catch((err: unknown) => {
          mastra
            .getLogger()
            .warn(`extract-recipe failed for ${url}: ${String(err)}`);
          return undefined;
        });
      if (!extracted || isValidationError(extracted)) {
        return c.json({ error: `Could not read a recipe from ${url}` }, 422);
      }
      title = extracted.title;
      recipe = extracted.ingredients.map(formatRecipeLine).join("\n");
    } else {
      recipe = ingredientsText!.trim();
    }

    const pantry = await getPantryRows();
    if (pantry.length === 0) {
      return c.json({ recipeTitle: title, changes: [], unmatched: [] });
    }

    const prompt = `Recipe ingredients${title ? ` (${title})` : ""}:
${recipe}

Servings multiplier: ${servings}

Pantry:
${pantry.map(formatUsagePantryLine).join("\n")}`;

    const result = await mastra
      .getAgent("pantryUsageAgent")
      .generate(prompt, { structuredOutput: { schema: usagePlanSchema } });

    const proposal = toCookedProposal(result.object, pantry);
    return c.json({ ...proposal, recipeTitle: title ?? proposal.recipeTitle });
  },
});
