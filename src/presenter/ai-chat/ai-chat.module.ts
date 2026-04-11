import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AiChatController } from './ai-chat.controller';
import { AiChatService } from './ai-chat.service';

@Module({
  imports: [ConfigModule, HttpModule],
  controllers: [AiChatController],
  providers: [AiChatService],
})
export class AiChatModule {}
