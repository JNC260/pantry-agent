import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { PANTRY_CATEGORIES, type PantryCategory } from '../categories';
import { OptionalNotNull } from './optional-not-null';

// Not PartialType(CreatePantryItemDto): that marks every field @IsOptional,
// which accepts null. Here an omitted field is left unchanged, null clears
// the fields that can be empty, and null is rejected for the rest.
export class UpdatePantryItemDto {
  @OptionalNotNull()
  @IsString()
  @IsNotEmpty()
  ingredient?: string;

  @IsOptional()
  @IsNumber()
  quantity?: number | null;

  @IsOptional()
  @IsString()
  unit?: string | null;

  @IsOptional()
  @IsDateString()
  expirationDate?: string | null;

  @OptionalNotNull()
  @IsBoolean()
  lowStock?: boolean;

  @OptionalNotNull()
  @IsIn(PANTRY_CATEGORIES)
  category?: PantryCategory;
}
