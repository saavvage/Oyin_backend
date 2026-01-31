import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Game } from '../../domain/entities/game.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { User } from '../../domain/entities/user.entity';
import { GameStatus, GameType } from '../../domain/entities/enums';
import { ContractDto } from './dto/contract.dto';
import { ResultDto } from './dto/result.dto';
import { EloService } from '../../infrastructure/services/elo.service';

@Injectable()
export class GamesService {
    constructor(
        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
        @InjectRepository(SportProfile)
        private sportProfileRepository: Repository<SportProfile>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private eloService: EloService,
    ) { }

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

        // Update contract data
        game.contractData = {
            date: dto.date,
            venueId: dto.venueId,
            location: dto.location,
            reminder: dto.reminder,
        };

        await this.gameRepository.save(game);

        return {
            success: true,
            gameId: game.id,
            contractData: game.contractData,
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
            game.scorePlayer2 = `${dto.myScore}-${dto.opponentScore}`;
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
    }

    async updateEloRatings(game: Game, isDisputeResolution: boolean = false) {
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
            return; // Can't update ratings without profiles
        }

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
}
