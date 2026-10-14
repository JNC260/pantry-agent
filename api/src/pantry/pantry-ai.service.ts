import { Injectable } from '@nestjs/common';
import { postToMastra } from '../mastra/mastra-client';
import type { PantryCategory } from './categories';
import type { CookedRecipeDto } from './dto/cooked-recipe.dto';

// Mirrors ReceiptProposal in pantry-agent/src/lib/receipt-items.ts.
export type ReceiptProposal = {
  purchaseDate: string;
  items: {
    receiptText: string;
    ingredient: string;
    quantity: number | null;
    unit: string | null;
    category: PantryCategory;
    expirationDate: string;
    existingIngredient: string | null;
  }[];
  skipped: string[];
};

// Mirrors CookedProposal in pantry-agent/src/lib/pantry-usage.ts.
export type CookedProposal = {
  recipeTitle: string | null;
  changes: {
    pantryItemId: string;
    ingredient: string;
    unit: string | null;
    recipeIngredient: string;
    before: number | null;
    after: number | null;
    action: 'decrement' | 'remove';
    confidence: 'sure' | 'estimate' | 'unsure';
    note: string;
  }[];
  unmatched: string[];
};

export type ReceiptFile = { buffer: Buffer; mimetype: string };

/**
 * Relays pantry-AI requests to the Mastra server's /pantry-ai routes. Those
 * only propose changes; nothing here writes to the pantry.
 */
@Injectable()
export class PantryAiService {
  parseReceipt(files: ReceiptFile[], text?: string): Promise<ReceiptProposal> {
    return postToMastra<ReceiptProposal>('/pantry-ai/parse-receipt', {
      files: files.map((file) => ({
        data: file.buffer.toString('base64'),
        mediaType: file.mimetype,
      })),
      text,
    });
  }

  planCooked(input: CookedRecipeDto): Promise<CookedProposal> {
    return postToMastra<CookedProposal>('/pantry-ai/plan-cooked', input);
  }
}
