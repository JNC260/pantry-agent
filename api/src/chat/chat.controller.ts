import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService, ChatMessage } from './chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body('messages') messages: ChatMessage[]) {
    const reply = await this.chatService.sendMessage(messages);
    return { reply };
  }
}
