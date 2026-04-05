import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
    imports: [TypeOrmModule.forFeature([User, Transaction])],
    controllers: [WalletController],
    providers: [WalletService],
})
export class WalletModule { }
