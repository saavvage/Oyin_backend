import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Game } from '../../domain/entities/game.entity';
import { User } from '../../domain/entities/user.entity';
import { SportType, GameType, GameStatus } from '../../domain/entities/enums';
import { ChallengeDto } from './dto/challenge.dto';

@Injectable()
export class ArenaService {
    constructor(
        @InjectRepository(SportProfile)
        private sportProfileRepository: Repository<SportProfile>,
        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
    ) { }

    async getLeaderboard(sport: SportType, currentUserId: string) {
        // Get current user's ELO for this sport
        const currentProfile = await this.sportProfileRepository.findOne({
            where: {
                userId: currentUserId,
                sportType: sport,
            },
        });

        // Build query for leaderboard
        const query = this.sportProfileRepository
            .createQueryBuilder('profile')
            .leftJoinAndSelect('profile.user', 'user')
            .where('profile.sportType = :sport', { sport });

        // Filter by ELO range if user has a profile
        if (currentProfile) {
            const minElo = currentProfile.eloRating - 200;
            const maxElo = currentProfile.eloRating + 200;
            query.andWhere('profile.eloRating BETWEEN :minElo AND :maxElo', {
                minElo,
                maxElo,
            });
        }

        const profiles = await query.orderBy('profile.eloRating', 'DESC').limit(50).getMany();

        return profiles.map((profile, index) => ({
            rank: index + 1,
            userId: profile.user.id,
            name: profile.user.name,
            rating: profile.eloRating,
            gamesPlayed: profile.gamesPlayed,
            avatar: profile.user.avatarUrl || '',
            reliabilityScore: profile.user.reliabilityScore,
        }));
    }

    async challenge(challengerId: string, dto: ChallengeDto) {
        // Create a new game with RANKED_CHALLENGE type
        const game = this.gameRepository.create({
            type: GameType.RANKED_CHALLENGE,
            status: GameStatus.PENDING,
            player1Id: challengerId,
            player2Id: dto.targetId,
        });

        await this.gameRepository.save(game);

        // TODO: Send push notification to target player

        return {
            success: true,
            gameId: game.id,
            status: game.status,
        };
    }
}
