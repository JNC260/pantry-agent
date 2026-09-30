import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatRequestDto } from './dto/chat-request.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async chat(@Body() { messages }: ChatRequestDto) {
    const reply = await this.chatService.sendMessage(messages);
    return { reply };
  }
}
