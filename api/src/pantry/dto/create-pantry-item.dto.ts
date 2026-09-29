import {
  IsString,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsIn,
} from 'class-validator';
import { PANTRY_CATEGORIES, type PantryCategory } from '../categories';

export class CreatePantryItemDto {
  @IsString()
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

  @IsOptional()
  @IsBoolean()
  lowStock?: boolean;

  @IsOptional()
  @IsIn(PANTRY_CATEGORIES)
  category?: PantryCategory;
}
