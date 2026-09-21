import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PantryController } from './pantry.controller';
import { PantryService } from './pantry.service';

@Module({
  imports: [AuthModule],
  controllers: [PantryController],
  providers: [PantryService],
})
export class PantryModule {}
