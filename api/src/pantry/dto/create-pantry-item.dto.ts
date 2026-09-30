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

export class CreatePantryItemDto {
  @IsString()
  @IsNotEmpty()
  ingredient!: string;

  @IsOptional()
  @IsNumber()
  quantity?: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsDateString()
  expirationDate?: string;

  @OptionalNotNull()
  @IsBoolean()
  lowStock?: boolean;

  @OptionalNotNull()
  @IsIn(PANTRY_CATEGORIES)
  category?: PantryCategory;
}
