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
    ) {
        return this.matchmakingService.getFeed(user.userId, sport);
    }

    @Post('swipe')
    async swipe(@CurrentUser() user: any, @Body() dto: SwipeDto) {
        return this.matchmakingService.swipe(user.userId, dto);
    }
}
