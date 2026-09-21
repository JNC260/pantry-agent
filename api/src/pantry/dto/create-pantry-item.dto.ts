import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

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
}
