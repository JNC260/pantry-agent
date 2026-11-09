import { Injectable } from '@nestjs/common';
import { getFromMastra, postToMastra } from '../mastra/mastra-client';
import { AcceptRecipeDto } from './dto/accept-recipe.dto';

// Mirrors RecipeIndexReport in pantry-agent/src/lib/recipe-index-report.ts.
export type RecipeIndexReport = {
  counts: {
    recipes: number;
    indexed: number;
    unreadable: number;
    accepted: number;
    pending: number;
  };
  unreadable: UnreadableRecipe[];
  // Marked "looks fine" by the user.
  accepted: UnreadableRecipe[];
  blockedSites: string[];
};

type UnreadableRecipe = {
  sourceLink: string;
  reason: 'dead-link' | 'unreadable' | 'not-a-recipe' | 'errors';
  error: string;
  attempts: number;
  lastTriedAt: string;
  pins: {
    id: string;
    url: string;
    title: string | null;
    boardName: string;
    sectionName: string | null;
  }[];
};

// The report after a refresh, plus the recipe boards that couldn't be
// re-downloaded (their pins are as they were).
export type RecipeIndexRefresh = RecipeIndexReport & { failedBoards: string[] };

/** Relays the recipe index report (and its refresh) from the Mastra server. */
@Injectable()
export class RecipeIndexService {
  getReport(): Promise<RecipeIndexReport> {
    return getFromMastra<RecipeIndexReport>('/recipe-index/report');
  }

  refresh(): Promise<RecipeIndexRefresh> {
    return postToMastra<RecipeIndexRefresh>('/recipe-index/refresh', {});
  }

  setAccepted(dto: AcceptRecipeDto): Promise<RecipeIndexReport> {
    return postToMastra<RecipeIndexReport>('/recipe-index/accept', {
      url: dto.url,
      accepted: dto.accepted,
    });
  }
}
