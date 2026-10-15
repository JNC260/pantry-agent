import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RecipeIndexController } from './recipe-index.controller';
import { RecipeIndexService } from './recipe-index.service';

@Module({
  imports: [AuthModule],
  controllers: [RecipeIndexController],
  providers: [RecipeIndexService],
})
export class RecipeIndexModule {}
