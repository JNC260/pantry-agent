import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PantryService } from './pantry.service';
import { BatchPantryDto } from './dto/batch-pantry.dto';
import { CreatePantryItemDto } from './dto/create-pantry-item.dto';
import { UpdatePantryItemDto } from './dto/update-pantry-item.dto';

/** /pantry CRUD routes, plus POST /pantry/batch (all require a JWT). */
@Controller('pantry')
@UseGuards(JwtAuthGuard)
export class PantryController {
  constructor(private readonly pantryService: PantryService) {}

  @Get()
  list() {
    return this.pantryService.list();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.pantryService.get(id);
    if (!item) throw new NotFoundException('Pantry item not found');
    return item;
  }

  @Post()
  create(@Body() dto: CreatePantryItemDto) {
    return this.pantryService.create(dto);
  }

  @Post('batch')
  async batch(@Body() dto: BatchPantryDto) {
    const result = await this.pantryService.batch(dto);
    if (!result) throw new NotFoundException('Pantry item not found');
    return result;
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdatePantryItemDto) {
    const updated = await this.pantryService.update(id, dto);
    if (!updated) throw new NotFoundException('Pantry item not found');
    return updated;
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    const deleted = await this.pantryService.delete(id);
    if (!deleted) throw new NotFoundException('Pantry item not found');
    return { deleted: true };
  }
}
