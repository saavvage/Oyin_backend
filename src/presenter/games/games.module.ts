import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Game } from '../../domain/entities/game.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { EloService } from '../../infrastructure/services/elo.service';

@Module({
    imports: [TypeOrmModule.forFeature([Game, SportProfile, User, Transaction])],
    controllers: [GamesController],
    providers: [GamesService, EloService],
    exports: [GamesService],
})
export class GamesModule { }
