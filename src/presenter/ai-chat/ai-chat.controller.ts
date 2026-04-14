import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatDto } from './dto/ai-chat.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('ai')
//@UseGuards(JwtAuthGuard)
export class AiChatController {
  private readonly logger = new Logger(AiChatController.name);

  constructor(private readonly aiChatService: AiChatService) {}

  /** POST /api/ai/chat — proxy to ML service, persists both turns */
  @UseGuards(JwtAuthGuard)
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

  /** GET /api/ai/history — returns prior messages for the current user */
  @UseGuards(JwtAuthGuard)
  @Get('history')
  async history(
    @CurrentUser() user: any,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? Number(limit) : 50;
    return this.aiChatService.getHistory(
      user.userId,
      Number.isFinite(parsed) && parsed > 0 ? parsed : 50,
    );
  }

  /** DELETE /api/ai/history — clears the rolling thread */
  @UseGuards(JwtAuthGuard)
  @Delete('history')
  async clearHistory(@CurrentUser() user: any) {
    return this.aiChatService.clearHistory(user.userId);
  }

  /** GET /api/ai/health — check ML service status */
  @Get('health')
  async health() {
    return this.aiChatService.health();
  }
}
