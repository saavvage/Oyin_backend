import {
    Controller,
    Post,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContractDto } from './dto/contract.dto';
import { ResultDto } from './dto/result.dto';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
    constructor(private gamesService: GamesService) { }

    @Post(':gameId/contract')
    async proposeContract(
        @Param('gameId') gameId: string,
        @CurrentUser() user: any,
        @Body() dto: ContractDto,
    ) {
        return this.gamesService.proposeContract(gameId, user.userId, dto);
    }

    @Post(':gameId/accept')
    async acceptContract(
        @Param('gameId') gameId: string,
        @CurrentUser() user: any,
    ) {
        return this.gamesService.acceptContract(gameId, user.userId);
    }

    @Post(':gameId/result')
    async submitResult(
        @Param('gameId') gameId: string,
        @CurrentUser() user: any,
        @Body() dto: ResultDto,
    ) {
        return this.gamesService.submitResult(gameId, user.userId, dto);
    }
}
