import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../../domain/entities/game.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { Transaction } from '../../domain/entities/transaction.entity';
import { GameStatus, GameType, TransactionType } from '../../domain/entities/enums';
import { ContractDto } from './dto/contract.dto';
import { ResultDto } from './dto/result.dto';
import { EloService } from '../../infrastructure/services/elo.service';

const GAME_WIN_REWARD = 25;
const GAME_LOSS_REWARD = 5;
const GAME_DRAW_REWARD = 10;

type RatingChanges = {
    player1Before: number;
    player1After: number;
    player2Before: number;
    player2After: number;
};

@Injectable()
export class GamesService {
    constructor(
        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
        @InjectRepository(SportProfile)
        private sportProfileRepository: Repository<SportProfile>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(Transaction)
        private transactionRepository: Repository<Transaction>,
        private eloService: EloService,
    ) { }

    async getMyGames(userId: string) {
        const games = await this.gameRepository.find({
            where: [
                { player1Id: userId },
                { player2Id: userId },
            ],
            relations: ['player1', 'player2', 'winner'],
            order: { createdAt: 'DESC' },
            take: 50,
        });

        return games.map(game => ({
            ...this.mapGame(game),
            myRole: game.player1Id === userId ? 'player1' : 'player2',
            result: this.getMyResult(game, userId),
        }));
    }

    private getMyResult(game: Game, userId: string): 'win' | 'loss' | 'draw' | 'pending' {
        if (game.status !== GameStatus.PLAYED) return 'pending';
        if (!game.winnerId) return 'draw';
        return game.winnerId === userId ? 'win' : 'loss';
    }

    async getGameById(gameId: string, userId: string) {
        const game = await this.gameRepository.findOne({
            where: { id: gameId },
            relations: ['player1', 'player2', 'winner', 'dispute'],
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        if (game.player1Id !== userId && game.player2Id !== userId) {
            throw new BadRequestException('You are not a player in this game');
        }

        return this.mapGame(game);
    }

    async proposeContract(gameId: string, userId: string, dto: ContractDto) {
        const game = await this.gameRepository.findOne({
            where: { id: gameId },
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        // Verify user is a player in this game
        if (game.player1Id !== userId && game.player2Id !== userId) {
            throw new BadRequestException('You are not a player in this game');
        }

        const existing = game.contractData;
        if (existing?.date) {
            const isSamePayload =
                existing.date === dto.date &&
                (existing.venueId || '') === (dto.venueId || '') &&
                (existing.location || '') === (dto.location || '') &&
                !!existing.reminder === !!dto.reminder;

            if (isSamePayload) {
                return {
                    success: true,
                    gameId: game.id,
                    contractData: game.contractData,
                    locked: true,
                };
            }

            throw new BadRequestException(
                'Contract already finalized and cannot be changed',
            );
        }

        // Update contract data
        game.contractData = {
            date: dto.date,
            venueId: dto.venueId,
            location: dto.location,
            reminder: dto.reminder,
        };
        game.status = GameStatus.SCHEDULED;

        await this.gameRepository.save(game);

        return {
            success: true,
            gameId: game.id,
            contractData: game.contractData,
            locked: true,
        };
    }

    async acceptContract(gameId: string, userId: string) {
        const game = await this.gameRepository.findOne({
            where: { id: gameId },
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        // Verify user is a player in this game
        if (game.player1Id !== userId && game.player2Id !== userId) {
            throw new BadRequestException('You are not a player in this game');
        }

        // Update status to SCHEDULED
        game.status = GameStatus.SCHEDULED;
        await this.gameRepository.save(game);

        return {
            success: true,
            gameId: game.id,
            status: game.status,
        };
    }

    async submitResult(gameId: string, userId: string, dto: ResultDto) {
        const game = await this.gameRepository.findOne({
            where: { id: gameId },
            relations: ['player1', 'player2'],
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        // Determine if user is player1 or player2
        const isPlayer1 = game.player1Id === userId;
        const isPlayer2 = game.player2Id === userId;

        if (!isPlayer1 && !isPlayer2) {
            throw new BadRequestException('You are not a player in this game');
        }

        // Updated scores for the submitting player
        if (isPlayer1) {
            game.scorePlayer1 = `${dto.myScore}-${dto.opponentScore}`;
            game.player1Submitted = true;
        } else {
            // Store in canonical "player1-player2" format for reliable comparison.
            game.scorePlayer2 = `${dto.opponentScore}-${dto.myScore}`;
            game.player2Submitted = true;
        }

        // Check if both players submitted
        if (game.player1Submitted && game.player2Submitted) {
            // Compare scores
            if (game.scorePlayer1 === game.scorePlayer2) {
                // Scores match - finalize game
                await this.finalizeGame(game);
                game.status = GameStatus.PLAYED;
            } else {
                // Scores don't match - create conflict
                game.status = GameStatus.CONFLICT;
            }
        }

        await this.gameRepository.save(game);

        return {
            success: true,
            gameId: game.id,
            status: game.status,
            scoresMatch: game.player1Submitted && game.player2Submitted && game.scorePlayer1 === game.scorePlayer2,
            game: this.mapGame(game),
        };
    }

    private async finalizeGame(game: Game) {
        // Determine winner from score (format: "3-1" means winner scored 3)
        const [player1Score, player2Score] = game.scorePlayer1.split('-').map(Number);

        if (player1Score > player2Score) {
            game.winnerId = game.player1Id;
        } else if (player2Score > player1Score) {
            game.winnerId = game.player2Id;
        }
        // If equal, it's a draw (winnerId stays null)

        // Update ELO ratings
        await this.updateEloRatings(game, false);

        // Update reliability scores
        await this.updateReliabilityScores(game);

        // Award coins for game result
        await this.awardGameCoins(game);
    }

    async updateEloRatings(game: Game, isDisputeResolution: boolean = false): Promise<RatingChanges | null> {
        // Get sport profiles for both players (assumes same sport)
        const profiles = await this.sportProfileRepository.find({
            where: [
                { userId: game.player1Id },
                { userId: game.player2Id },
            ],
        });

        const player1Profile = profiles.find(p => p.userId === game.player1Id);
        const player2Profile = profiles.find(p => p.userId === game.player2Id);

        if (!player1Profile || !player2Profile) {
            return null; // Can't update ratings without profiles
        }

        const player1Before = player1Profile.eloRating;
        const player2Before = player2Profile.eloRating;

        if (game.winnerId) {
            const winnerId = game.winnerId;
            const winnerProfile = winnerId === game.player1Id ? player1Profile : player2Profile;
            const loserProfile = winnerId === game.player1Id ? player2Profile : player1Profile;

            const { winnerNewRating, loserNewRating } = this.eloService.calculateNewRatings(
                winnerProfile.eloRating,
                loserProfile.eloRating,
                winnerProfile.gamesPlayed,
                loserProfile.gamesPlayed,
                game.type === GameType.RANKED_CHALLENGE,
                false,
                isDisputeResolution,
            );

            winnerProfile.eloRating = winnerNewRating;
            loserProfile.eloRating = loserNewRating;
        } else {
            // Draw
            const { winnerNewRating, loserNewRating } = this.eloService.calculateNewRatings(
                player1Profile.eloRating,
                player2Profile.eloRating,
                player1Profile.gamesPlayed,
                player2Profile.gamesPlayed,
                game.type === GameType.RANKED_CHALLENGE,
                true,
                false,
            );

            player1Profile.eloRating = winnerNewRating;
            player2Profile.eloRating = loserNewRating;
        }

        // Increment games played
        player1Profile.gamesPlayed++;
        player2Profile.gamesPlayed++;

        await this.sportProfileRepository.save([player1Profile, player2Profile]);

        return {
            player1Before,
            player1After: player1Profile.eloRating,
            player2Before,
            player2After: player2Profile.eloRating,
        };
    }

    private async updateReliabilityScores(game: Game) {
        const users = await this.userRepository.find({
            where: [
                { id: game.player1Id },
                { id: game.player2Id },
            ],
        });

        // Successful game completion increases reliability
        for (const user of users) {
            user.reliabilityScore = Math.min(100, user.reliabilityScore + 2);
        }

        await this.userRepository.save(users);
    }

    async awardGameCoins(game: Game) {
        const users = await this.userRepository.find({
            where: [
                { id: game.player1Id },
                { id: game.player2Id },
            ],
        });

        const player1 = users.find(u => u.id === game.player1Id);
        const player2 = users.find(u => u.id === game.player2Id);
        if (!player1 || !player2) return;

        if (game.winnerId) {
            const winner = game.winnerId === player1.id ? player1 : player2;
            const loser = game.winnerId === player1.id ? player2 : player1;

            winner.balance += GAME_WIN_REWARD;
            loser.balance += GAME_LOSS_REWARD;

            await this.userRepository.save([winner, loser]);

            await this.transactionRepository.save([
                this.transactionRepository.create({
                    userId: winner.id,
                    type: TransactionType.GAME_WIN,
                    amount: GAME_WIN_REWARD,
                    balanceAfter: winner.balance,
                    description: `Won challenge vs ${loser.name}`,
                }),
                this.transactionRepository.create({
                    userId: loser.id,
                    type: TransactionType.GAME_LOSS,
                    amount: GAME_LOSS_REWARD,
                    balanceAfter: loser.balance,
                    description: `Lost challenge vs ${winner.name}`,
                }),
            ]);
        } else {
            // Draw
            player1.balance += GAME_DRAW_REWARD;
            player2.balance += GAME_DRAW_REWARD;

            await this.userRepository.save([player1, player2]);

            await this.transactionRepository.save([
                this.transactionRepository.create({
                    userId: player1.id,
                    type: TransactionType.GAME_DRAW,
                    amount: GAME_DRAW_REWARD,
                    balanceAfter: player1.balance,
                    description: `Draw vs ${player2.name}`,
                }),
                this.transactionRepository.create({
                    userId: player2.id,
                    type: TransactionType.GAME_DRAW,
                    amount: GAME_DRAW_REWARD,
                    balanceAfter: player2.balance,
                    description: `Draw vs ${player1.name}`,
                }),
            ]);
        }
    }

    private mapGame(game: Game) {
        return {
            id: game.id,
            type: game.type,
            status: game.status,
            player1: {
                id: game.player1?.id || game.player1Id,
                name: game.player1?.name || 'Player 1',
                avatarUrl: game.player1?.avatarUrl || '',
            },
            player2: {
                id: game.player2?.id || game.player2Id,
                name: game.player2?.name || 'Player 2',
                avatarUrl: game.player2?.avatarUrl || '',
            },
            winner: game.winner
                ? {
                    id: game.winner.id,
                    name: game.winner.name,
                }
                : null,
            contractData: game.contractData || null,
            scorePlayer1: game.scorePlayer1 || null,
            scorePlayer2: game.scorePlayer2 || null,
            player1Submitted: game.player1Submitted,
            player2Submitted: game.player2Submitted,
            disputeId: game.dispute?.id || null,
            createdAt: game.createdAt,
            updatedAt: game.updatedAt,
        };
    }
}
