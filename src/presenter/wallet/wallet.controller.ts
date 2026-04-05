import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TransferDto } from './dto/transfer.dto';
import { BuyItemDto } from './dto/buy-item.dto';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
    constructor(private walletService: WalletService) { }

    @Get('balance')
    async getBalance(@CurrentUser() user: any) {
        return this.walletService.getBalance(user.userId);
    }

    @Post('daily-reward')
    async claimDailyReward(@CurrentUser() user: any) {
        return this.walletService.claimDailyReward(user.userId);
    }

    @Post('transfer')
    async transfer(@CurrentUser() user: any, @Body() dto: TransferDto) {
        return this.walletService.transfer(user.userId, dto);
    }

    @Get('store')
    async getStoreItems() {
        return this.walletService.getStoreItems();
    }

    @Post('store/buy')
    async buyItem(@CurrentUser() user: any, @Body() dto: BuyItemDto) {
        return this.walletService.buyItem(user.userId, dto);
    }

    @Get('history')
    async getHistory(@CurrentUser() user: any) {
        return this.walletService.getHistory(user.userId);
    }
}
