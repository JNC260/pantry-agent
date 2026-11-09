import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AcceptRecipeDto } from './dto/accept-recipe.dto';
import { RecipeIndexService } from './recipe-index.service';

/**
 * GET /recipe-index/report (requires a JWT): how much of the user's recipe
 * pins the agent can read by ingredient, and the pins it couldn't read.
 * POST /recipe-index/refresh re-downloads the recipe boards from Pinterest
 * first, so pins deleted or fixed there drop off. POST /recipe-index/accept
 * marks an unreadable recipe "looks fine" (or unmarks it).
 */
@Controller('recipe-index')
@UseGuards(JwtAuthGuard)
export class RecipeIndexController {
  constructor(private readonly recipeIndexService: RecipeIndexService) {}

  @Get('report')
  getReport() {
    return this.recipeIndexService.getReport();
  }

  @Post('refresh')
  @HttpCode(200)
  refresh() {
    return this.recipeIndexService.refresh();
  }

  @Post('accept')
  @HttpCode(200)
  setAccepted(@Body() dto: AcceptRecipeDto) {
    return this.recipeIndexService.setAccepted(dto);
  }
}
