import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { HealthController } from './health/health.controller';
import { PantryModule } from './pantry/pantry.module';

@Module({
  imports: [AuthModule, ChatModule, PantryModule],
  controllers: [HealthController],
})
export class AppModule {}
