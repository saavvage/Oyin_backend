import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { TransactionType } from '../../domain/entities/enums';
import { TransferDto } from './dto/transfer.dto';
import { BuyItemDto } from './dto/buy-item.dto';

const STORE_ITEMS = [
    { id: 'gym_pass', name: 'Gym pass', price: 150 },
    { id: 'equipment', name: 'Equipment', price: 200 },
    { id: 'coach_session', name: 'Coach session', price: 300 },
    { id: 'energy_drink', name: 'Energy drink', price: 50 },
];

const DAILY_REWARDS = [10, 20, 30, 40, 50, 60, 500];

@Injectable()
export class WalletService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
    ) { }

    private async getUserOrThrow(userId: string): Promise<User> {
        const user = await this.userRepository.findOneBy({ id: userId });
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async getBalance(userId: string) {
        const user = await this.getUserOrThrow(userId);
        return {
            balance: user.balance,
            dailyRewardStreak: user.dailyRewardStreak,
            lastDailyRewardAt: user.lastDailyRewardAt,
        };
    }

    async claimDailyReward(userId: string) {
        const user = await this.getUserOrThrow(userId);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (user.lastDailyRewardAt) {
            const lastClaim = new Date(user.lastDailyRewardAt);
            lastClaim.setHours(0, 0, 0, 0);
            if (lastClaim.getTime() === today.getTime()) {
                throw new BadRequestException('Daily reward already claimed today');
            }

            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            if (lastClaim.getTime() < yesterday.getTime()) {
                user.dailyRewardStreak = 0;
            }
        }

        const streakDay = Math.min(user.dailyRewardStreak, 6);
        const reward = DAILY_REWARDS[streakDay];

        user.balance += reward;
        user.dailyRewardStreak += 1;
        user.lastDailyRewardAt = today;

        await this.userRepository.save(user);

        const tx = this.transactionRepository.create({
            userId,
            type: TransactionType.DAILY_REWARD,
            amount: reward,
            balanceAfter: user.balance,
            description: `Daily reward day ${user.dailyRewardStreak}`,
        });
        await this.transactionRepository.save(tx);

        return {
            reward,
            balance: user.balance,
            streak: user.dailyRewardStreak,
        };
    }

    async transfer(userId: string, dto: TransferDto) {
        const sender = await this.getUserOrThrow(userId);
        if (sender.balance < dto.amount) {
            throw new BadRequestException('Insufficient balance');
        }

        const recipient = await this.userRepository.findOneBy({ phone: dto.phone });
        if (!recipient) {
            throw new NotFoundException('Recipient not found');
        }
        if (recipient.id === userId) {
            throw new BadRequestException('Cannot transfer to yourself');
        }

        sender.balance -= dto.amount;
        recipient.balance += dto.amount;

        await this.userRepository.save(sender);
        await this.userRepository.save(recipient);

        const txOut = this.transactionRepository.create({
            userId,
            type: TransactionType.TRANSFER_OUT,
            amount: -dto.amount,
            balanceAfter: sender.balance,
            description: `Transfer to ${recipient.name}`,
            relatedUserId: recipient.id,
        });

        const txIn = this.transactionRepository.create({
            userId: recipient.id,
            type: TransactionType.TRANSFER_IN,
            amount: dto.amount,
            balanceAfter: recipient.balance,
            description: `Transfer from ${sender.name}`,
            relatedUserId: userId,
        });

        await this.transactionRepository.save([txOut, txIn]);

        return {
            success: true,
            balance: sender.balance,
            recipientName: recipient.name,
        };
    }

    async getStoreItems() {
        return STORE_ITEMS;
    }

    async buyItem(userId: string, dto: BuyItemDto) {
        const item = STORE_ITEMS.find((i) => i.id === dto.itemId);
        if (!item) {
            throw new NotFoundException('Store item not found');
        }

        const user = await this.getUserOrThrow(userId);
        if (user.balance < item.price) {
            throw new BadRequestException('Insufficient balance');
        }

        user.balance -= item.price;
        await this.userRepository.save(user);

        const tx = this.transactionRepository.create({
            userId,
            type: TransactionType.PURCHASE,
            amount: -item.price,
            balanceAfter: user.balance,
            description: `Purchased ${item.name}`,
        });
        await this.transactionRepository.save(tx);

        return {
            success: true,
            balance: user.balance,
            item: item.name,
        };
    }

    async getHistory(userId: string) {
        const transactions = await this.transactionRepository.find({
            where: { userId },
            order: { createdAt: 'DESC' },
            take: 50,
        });

        return transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            balanceAfter: tx.balanceAfter,
            description: tx.description,
            createdAt: tx.createdAt,
        }));
    }
}
