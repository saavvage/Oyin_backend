import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { VoteDto } from './dto/vote.dto';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
    constructor(private disputesService: DisputesService) { }

    @Post()
    async createDispute(@CurrentUser() user: any, @Body() dto: CreateDisputeDto) {
        return this.disputesService.createDispute(user.userId, dto);
    }

    @Get('jury-duty')
    async getJuryDuty(@CurrentUser() user: any) {
        return this.disputesService.getJuryDuty(user.userId);
    }

    @Get('my')
    async getMyDisputes(@CurrentUser() user: any) {
        return this.disputesService.getMyDisputes(user.userId);
    }

    @Get(':id')
    async getDispute(@Param('id') disputeId: string, @CurrentUser() user: any) {
        return this.disputesService.getDisputeById(disputeId, user.userId);
    }

    @Post(':id/vote')
    async vote(
        @Param('id') disputeId: string,
        @CurrentUser() user: any,
        @Body() dto: VoteDto,
    ) {
        return this.disputesService.vote(disputeId, user.userId, dto);
    }
}
