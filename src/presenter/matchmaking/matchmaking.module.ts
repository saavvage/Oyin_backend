import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Swipe } from '../../domain/entities/swipe.entity';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';
import { MatchmakingController } from './matchmaking.controller';
import { MatchmakingService } from './matchmaking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      SportProfile,
      Swipe,
      ChatThread,
      ChatParticipant,
    ]),
  ],
  controllers: [MatchmakingController],
  providers: [MatchmakingService],
})
export class MatchmakingModule {}
