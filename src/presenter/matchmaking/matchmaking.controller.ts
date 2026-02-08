import {
    Controller,
    Get,
    Post,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SwipeDto } from './dto/swipe.dto';
import { SportType } from '../../domain/entities/enums';

@Controller('matchmaking')
@UseGuards(JwtAuthGuard)
export class MatchmakingController {
    constructor(private matchmakingService: MatchmakingService) { }

    @Get('feed')
    async getFeed(
        @CurrentUser() user: any,
        @Query('sport') sport?: SportType,
        @Query('distanceMin') distanceMin?: string,
        @Query('distanceMax') distanceMax?: string,
        @Query('ageMin') ageMin?: string,
        @Query('ageMax') ageMax?: string,
    ) {
        const parsedDistanceMin = distanceMin ? Number(distanceMin) : undefined;
        const parsedDistanceMax = distanceMax ? Number(distanceMax) : undefined;
        const parsedAgeMin = ageMin ? Number(ageMin) : undefined;
        const parsedAgeMax = ageMax ? Number(ageMax) : undefined;

        return this.matchmakingService.getFeed(user.userId, sport, {
            distanceMin: Number.isFinite(parsedDistanceMin) ? parsedDistanceMin : undefined,
            distanceMax: Number.isFinite(parsedDistanceMax) ? parsedDistanceMax : undefined,
            ageMin: Number.isFinite(parsedAgeMin) ? parsedAgeMin : undefined,
            ageMax: Number.isFinite(parsedAgeMax) ? parsedAgeMax : undefined,
        });
    }

    @Post('swipe')
    async swipe(@CurrentUser() user: any, @Body() dto: SwipeDto) {
        return this.matchmakingService.swipe(user.userId, dto);
    }

    @Post('reset-dislikes')
    async resetDislikes(@CurrentUser() user: any) {
        return this.matchmakingService.resetDislikes(user.userId);
    }
}
