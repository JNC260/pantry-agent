import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreatePantryItemDto } from './create-pantry-item.dto';
import { UpdatePantryItemDto } from './update-pantry-item.dto';

// Comfortably more than one big grocery order.
const MAX_PER_KIND = 200;

export class BatchUpdatePantryItemDto extends UpdatePantryItemDto {
  @IsString()
  @IsNotEmpty()
  id!: string;
}

/** Creates, updates, and deletes applied together, all or nothing. */
export class BatchPantryDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PER_KIND)
  @ValidateNested({ each: true })
  @Type(() => CreatePantryItemDto)
  create?: CreatePantryItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PER_KIND)
  @ValidateNested({ each: true })
  @Type(() => BatchUpdatePantryItemDto)
  update?: BatchUpdatePantryItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PER_KIND)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  delete?: string[];
}
