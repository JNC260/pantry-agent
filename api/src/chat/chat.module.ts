import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ChatController } from './chat.controller';

@Module({
  imports: [AuthModule],
  controllers: [ChatController],
  exports: [],
})
export class ChatModule {}
