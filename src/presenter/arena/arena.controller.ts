import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { ArenaService } from './arena.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ChallengeDto } from './dto/challenge.dto';
import { SportType } from '../../domain/entities/enums';

@Controller('arena')
@UseGuards(JwtAuthGuard)
export class ArenaController {
    constructor(private arenaService: ArenaService) { }

    @Get('leaderboard')
    async getLeaderboard(
        @CurrentUser() user: any,
        @Query('sport') sport: SportType,
    ) {
        return this.arenaService.getLeaderboard(sport, user.userId);
    }

    @Post('challenge')
    async challenge(@CurrentUser() user: any, @Body() dto: ChallengeDto) {
        return this.arenaService.challenge(user.userId, dto);
    }
}
