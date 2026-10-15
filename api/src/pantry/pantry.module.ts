import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PantryAiController } from './pantry-ai.controller';
import { PantryAiService } from './pantry-ai.service';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';

@Module({
  imports: [AuthModule],
  controllers: [PantryController, PantryAiController],
  providers: [PantryService, PantryAiService],
})
export class PantryModule {}
