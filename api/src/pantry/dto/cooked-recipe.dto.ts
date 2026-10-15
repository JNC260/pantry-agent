import {
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** A recipe that was cooked: a link or a pasted ingredient list (not both). */
export class CookedRecipeDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  ingredientsText?: string;

  // Multiplies the recipe's amounts (2 = doubled).
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(20)
  servings?: number;
}
