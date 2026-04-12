import {
  Body,
  Controller,
  Get,
  Logger,
  Post,
} from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatDto } from './dto/ai-chat.dto';

@Controller('ai')
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(private readonly aiChatService: AiChatService) {}

  /** POST /api/ai/chat — proxy to ML service */
  @Post('chat')
  async chat(@Body() dto: AiChatDto) {
    const userId = dto.user_id;
    this.logger.log(`AI chat from user ${userId}: ${dto.message.slice(0, 50)}...`);
    return this.aiChatService.chat(
      userId,
      dto.message,
      dto.user_context,
    );
  }

  /** GET /api/ai/health — check ML service status */
  @Get('health')
  async health() {
    return this.aiChatService.health();
  }
}
