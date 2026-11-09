import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator';

/** Marks an unreadable recipe link "looks fine", or takes the mark off. */
export class AcceptRecipeDto {
  // The recipe link exactly as the report gave it (not re-validated as a
  // URL: it's matched against what Pinterest stored).
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  url!: string;

  @IsBoolean()
  accepted!: boolean;
}
