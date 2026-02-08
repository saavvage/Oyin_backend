import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { ChatAttachment } from '../../domain/entities/chat-attachment.entity';
import { ChatReport } from '../../domain/entities/chat-report.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            ChatThread,
            ChatParticipant,
            ChatMessage,
            ChatAttachment,
            ChatReport,
        ]),
    ],
    controllers: [ChatsController],
    providers: [ChatsService],
})
export class ChatsModule { }
