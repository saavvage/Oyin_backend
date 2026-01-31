import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, In } from 'typeorm';
import { Dispute } from '../../domain/entities/dispute.entity';
import { JuryVote } from '../../domain/entities/jury-vote.entity';
import { Game } from '../../domain/entities/game.entity';
import { User } from '../../domain/entities/user.entity';
import { DisputeStatus, GameStatus, VoteChoice } from '../../domain/entities/enums';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { VoteDto } from './dto/vote.dto';
import { GamesService } from '../games/games.service';

@Injectable()
export class DisputesService {
    constructor(
        @InjectRepository(Dispute)
        private disputeRepository: Repository<Dispute>,
        @InjectRepository(JuryVote)
        private juryVoteRepository: Repository<JuryVote>,
        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private gamesService: GamesService,
    ) { }

    async createDispute(userId: string, dto: CreateDisputeDto) {
        const game = await this.gameRepository.findOne({
            where: { id: dto.gameId },
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        if (game.status !== GameStatus.CONFLICT) {
            throw new BadRequestException('Can only create dispute for conflicted games');
        }

        // Determine plaintiff and defendant
        const plaintiffId = userId;
        const defendantId = game.player1Id === userId ? game.player2Id : game.player1Id;

        // Check if dispute already exists
        const existing = await this.disputeRepository.findOne({
            where: { gameId: dto.gameId },
        });

        if (existing) {
            throw new BadRequestException('Dispute already exists for this game');
        }

        const dispute = this.disputeRepository.create({
            gameId: dto.gameId,
            plaintiffId,
            defendantId,
            evidenceVideoUrl: dto.evidenceUrl,
            description: dto.comment,
        });

        await this.disputeRepository.save(dispute);

        // Update game status
        game.status = GameStatus.DISPUTED;
        await this.gameRepository.save(game);

        return {
            success: true,
            disputeId: dispute.id,
        };
    }

    async getJuryDuty(userId: string) {
        // Get disputes where user is not a participant and has high karma
        const user = await this.userRepository.findOne({
            where: { id: userId },
        });

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // Get user's existing votes
        const votedDisputeIds = await this.juryVoteRepository
            .createQueryBuilder('vote')
            .select('vote.disputeId')
            .where('vote.jurorId = :userId', { userId })
            .getRawMany()
            .then((results) => results.map((r) => r.vote_disputeId));

        // Find disputes where user is eligible to vote
        const query = this.disputeRepository
            .createQueryBuilder('dispute')
            .leftJoinAndSelect('dispute.game', 'game')
            .leftJoinAndSelect('dispute.plaintiff', 'plaintiff')
            .leftJoinAndSelect('dispute.defendant', 'defendant')
            .where('dispute.status = :status', { status: DisputeStatus.VOTING })
            .andWhere('dispute.plaintiffId != :userId', { userId })
            .andWhere('dispute.defendantId != :userId', { userId });

        if (votedDisputeIds.length > 0) {
            query.andWhere('dispute.id NOT IN (:...votedDisputeIds)', {
                votedDisputeIds,
            });
        }

        // Optionally filter by karma threshold
        // For now, all users can vote

        const disputes = await query.limit(10).getMany();

        return disputes.map((dispute) => ({
            id: dispute.id,
            gameId: dispute.gameId,
            plaintiff: {
                id: dispute.plaintiff.id,
                name: dispute.plaintiff.name,
            },
            defendant: {
                id: dispute.defendant.id,
                name: dispute.defendant.name,
            },
            evidenceUrl: dispute.evidenceVideoUrl,
            description: dispute.description,
            createdAt: dispute.createdAt,
        }));
    }

    async vote(disputeId: string, userId: string, dto: VoteDto) {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: ['votes', 'game'],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.status !== DisputeStatus.VOTING) {
            throw new BadRequestException('Dispute is not open for voting');
        }

        // Check if user already voted
        const existingVote = await this.juryVoteRepository.findOne({
            where: {
                disputeId,
                jurorId: userId,
            },
        });

        if (existingVote) {
            throw new BadRequestException('You have already voted on this dispute');
        }

        // Create vote
        const vote = this.juryVoteRepository.create({
            disputeId,
            jurorId: userId,
            voteFor: dto.winner,
        });

        await this.juryVoteRepository.save(vote);

        // Get all votes for this dispute
        const allVotes = await this.juryVoteRepository.find({
            where: { disputeId },
        });

        // Check if we have a majority (3/5 votes)
        const voteCounts = {
            [VoteChoice.PLAYER1]: 0,
            [VoteChoice.PLAYER2]: 0,
            [VoteChoice.DRAW]: 0,
        };

        allVotes.forEach((v) => {
            voteCounts[v.voteFor]++;
        });

        const totalVotes = allVotes.length;
        const requiredVotes = 3;

        let resolved = false;
        let winningSide: VoteChoice | null = null;

        for (const choice of Object.keys(voteCounts)) {
            if (voteCounts[choice as VoteChoice] >= requiredVotes) {
                resolved = true;
                winningSide = choice as VoteChoice;
                break;
            }
        }

        if (resolved && winningSide) {
            await this.resolveDispute(dispute, winningSide);
        }

        return {
            success: true,
            voteCount: totalVotes,
            resolved,
            winningSide: resolved ? winningSide : null,
        };
    }

    private async resolveDispute(dispute: Dispute, winningSide: VoteChoice) {
        dispute.status = DisputeStatus.RESOLVED;
        dispute.winningSide = winningSide;
        dispute.resolvedAt = new Date();
        await this.disputeRepository.save(dispute);

        // Update game based on resolution
        const game = await this.gameRepository.findOne({
            where: { id: dispute.gameId },
        });

        if (game) {
            if (winningSide === VoteChoice.PLAYER1) {
                game.winnerId = game.player1Id;
            } else if (winningSide === VoteChoice.PLAYER2) {
                game.winnerId = game.player2Id;
            }
            // If DRAW, winnerId stays null

            game.status = GameStatus.PLAYED;
            await this.gameRepository.save(game);

            // Update ELO with dispute penalty for loser
            await this.gamesService.updateEloRatings(game, true);

            // Award karma to jurors
            await this.awardKarmaToJurors(dispute.id);
        }
    }

    private async awardKarmaToJurors(disputeId: string) {
        const votes = await this.juryVoteRepository.find({
            where: { disputeId },
            relations: ['juror'],
        });

        const karmaReward = 10;

        for (const vote of votes) {
            vote.juror.karma += karmaReward;
            await this.userRepository.save(vote.juror);
        }
    }
}
