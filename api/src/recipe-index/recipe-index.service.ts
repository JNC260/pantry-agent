import { Injectable } from '@nestjs/common';
import { getFromMastra } from '../mastra/mastra-client';

// Mirrors RecipeIndexReport in pantry-agent/src/lib/recipe-index-report.ts.
export type RecipeIndexReport = {
  counts: {
    recipes: number;
    indexed: number;
    unreadable: number;
    pending: number;
  };
  unreadable: {
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
    }[];
  }[];
};

/** Relays the recipe index report from the Mastra server. */
@Injectable()
export class RecipeIndexService {
  getReport(): Promise<RecipeIndexReport> {
    return getFromMastra<RecipeIndexReport>('/recipe-index/report');
  }
}
