import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from '../../domain/entities/dispute.entity';
import { JuryVote } from '../../domain/entities/jury-vote.entity';
import { Game } from '../../domain/entities/game.entity';
import { User } from '../../domain/entities/user.entity';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { GamesModule } from '../games/games.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([Dispute, JuryVote, Game, User]),
        GamesModule,
    ],
    controllers: [DisputesController],
    providers: [DisputesService],
})
export class DisputesModule { }
