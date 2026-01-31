import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Game } from '../../domain/entities/game.entity';
import { User } from '../../domain/entities/user.entity';
import { ArenaController } from './arena.controller';
import { ArenaService } from './arena.service';

@Module({
    imports: [TypeOrmModule.forFeature([SportProfile, Game, User])],
    controllers: [ArenaController],
    providers: [ArenaService],
})
export class ArenaModule { }
