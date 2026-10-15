import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HealthController } from './health/health.controller';
import { PantryModule } from './pantry/pantry.module';
import { RecipeIndexModule } from './recipe-index/recipe-index.module';

@Module({
  imports: [AuthModule, ChatModule, PantryModule, RecipeIndexModule],
  controllers: [HealthController],
})
export class AppModule {}
