import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatModule } from './chat/chat.module';
import { ChatController } from './chat/chat.controller';

@Module({
  imports: [AuthModule, ChatModule],
  controllers: [AppController, ChatController],
  providers: [AppService],
})
export class AppModule {}
