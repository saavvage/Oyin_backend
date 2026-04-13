import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ChatsGateway } from './chats.gateway';
import { CreateThreadDto } from './dto/create-thread.dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
  private readonly logger = new Logger(ChatsController.name);

  constructor(
    private readonly chatsService: ChatsService,
    private readonly chatsGateway: ChatsGateway,
  ) {}

  @Post('threads')
  createThread(@CurrentUser() user: any, @Body() dto: CreateThreadDto) {
    return this.chatsService.createOrGetDirectThread(user.userId, dto);
  }

  @Get('threads')
  getThreads(@CurrentUser() user: any) {
    return this.chatsService.getThreads(user.userId);
  }

  @Get('blocked')
  getBlockedThreads(@CurrentUser() user: any) {
    return this.chatsService.getBlockedThreads(user.userId);
  }

  @Get('threads/:id/messages')
  getMessages(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('before') before?: string,
  ) {
    return this.chatsService.getMessages(user.userId, id, before);
  }

  @Post('threads/:id/messages')
  async sendMessage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatsService.sendMessage(user.userId, id, dto);

    try {
      await this.chatsGateway.emitMessageToThreadParticipants({
        id: message.id,
        threadId: message.threadId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt,
        attachments: message.attachments,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to broadcast chat message ${message.id}: ${(error as Error).message}`,
      );
    }

    return message;
  }

  @Delete('threads/:id')
  deleteThread(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatsService.deleteThread(user.userId, id);
  }

  @Post('threads/:id/block')
  blockThread(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatsService.blockThread(user.userId, id);
  }

  @Post('threads/:id/unblock')
  unblockThread(@CurrentUser() user: any, @Param('id') id: string) {
    return this.chatsService.unblockThread(user.userId, id);
  }

  @Post('threads/:id/report')
  reportThread(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.chatsService.reportThread(user.userId, id, reason);
  }
}
