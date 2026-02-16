import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { ChatsGateway } from './chats.gateway';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { ChatAttachment } from '../../domain/entities/chat-attachment.entity';
import { ChatReport } from '../../domain/entities/chat-report.entity';
import { User } from '../../domain/entities/user.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      ChatThread,
      ChatParticipant,
      ChatMessage,
      ChatAttachment,
      ChatReport,
      User,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRATION') || '7d',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ChatsController],
  providers: [ChatsService, ChatsGateway],
})
export class ChatsModule {}
