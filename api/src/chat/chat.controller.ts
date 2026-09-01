import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { mastra } from 'pantry-agent';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  @Post()
  async chat(@Body('message') message: string) {
    const agent = mastra.getAgent('pantryAgent');
    const result = await agent.generate(message);
    console.log('RESULT from Chat Controller', result);
    return { reply: result.text };
  }
}
