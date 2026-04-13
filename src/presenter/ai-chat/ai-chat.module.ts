import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';
import { UserContextBuilderService } from './user-context-builder.service';
import { AiChatMessage } from '../../domain/entities/ai-chat-message.entity';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Game } from '../../domain/entities/game.entity';
import { Swipe } from '../../domain/entities/swipe.entity';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    TypeOrmModule.forFeature([
      AiChatMessage,
      User,
      SportProfile,
      Game,
      Swipe,
    ]),
  ],
  controllers: [AiChatController],
  providers: [AiChatService, UserContextBuilderService],
})
export class AiChatModule {}
