import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChatsService } from './chats.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('chats')
@UseGuards(JwtAuthGuard)
export class ChatsController {
    constructor(private readonly chatsService: ChatsService) { }

    @Get('threads')
    getThreads(@CurrentUser() user: any) {
        return this.chatsService.getThreads(user.userId);
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
    sendMessage(
        @CurrentUser() user: any,
        @Param('id') id: string,
        @Body() dto: SendMessageDto,
    ) {
        return this.chatsService.sendMessage(user.userId, id, dto);
    }

    @Delete('threads/:id')
    deleteThread(@CurrentUser() user: any, @Param('id') id: string) {
        return this.chatsService.deleteThread(user.userId, id);
    }

    @Post('threads/:id/block')
    blockThread(@CurrentUser() user: any, @Param('id') id: string) {
        return this.chatsService.blockThread(user.userId, id);
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
