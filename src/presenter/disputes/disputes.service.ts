import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from '../../domain/entities/dispute.entity';
import { JuryVote } from '../../domain/entities/jury-vote.entity';
import { DisputeEvidence } from '../../domain/entities/dispute-evidence.entity';
import { Game } from '../../domain/entities/game.entity';
import { User } from '../../domain/entities/user.entity';
import {
    DisputeEvidenceType,
    DisputeStatus,
    GameStatus,
    VoteChoice,
} from '../../domain/entities/enums';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { VoteDto } from './dto/vote.dto';
import { GamesService } from '../games/games.service';

const REQUIRED_VOTES = 3;
const KARMA_REWARD_CORRECT = 50;
const KARMA_REWARD_PARTICIPATION = 10;

@Injectable()
export class DisputesService {
    constructor(
        @InjectRepository(Dispute)
        private disputeRepository: Repository<Dispute>,
        @InjectRepository(JuryVote)
        private juryVoteRepository: Repository<JuryVote>,
        @InjectRepository(DisputeEvidence)
        private disputeEvidenceRepository: Repository<DisputeEvidence>,
        @InjectRepository(Game)
        private gameRepository: Repository<Game>,
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private gamesService: GamesService,
    ) { }

    async createDispute(userId: string, dto: CreateDisputeDto) {
        const game = await this.gameRepository.findOne({
            where: { id: dto.gameId },
            relations: ['player1', 'player2'],
        });

        if (!game) {
            throw new NotFoundException('Game not found');
        }

        if (game.player1Id !== userId && game.player2Id !== userId) {
            throw new BadRequestException('You are not a player in this game');
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
            subject: dto.subject || this.buildDefaultSubject(game),
            sport: dto.sport || this.buildDefaultSport(game),
            locationLabel: dto.locationLabel || game.contractData?.location || null,
            plaintiffStatement: dto.plaintiffStatement || null,
            defendantStatement: dto.defendantStatement || null,
        });

        await this.disputeRepository.save(dispute);

        const evidenceItems = this.resolveEvidenceItems(dto);
        if (evidenceItems.length > 0) {
            const entities = evidenceItems.map((item) =>
                this.disputeEvidenceRepository.create({
                    disputeId: dispute.id,
                    type: item.type,
                    url: item.url,
                    thumbnailUrl: item.thumbnailUrl || null,
                    durationLabel: item.durationLabel || null,
                }),
            );
            await this.disputeEvidenceRepository.save(entities);
        }

        // Update game status
        game.status = GameStatus.DISPUTED;
        await this.gameRepository.save(game);

        return {
            success: true,
            disputeId: dispute.id,
            status: game.status,
            dispute: await this.getDisputeById(dispute.id, userId),
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
            .leftJoinAndSelect('game.player1', 'player1')
            .leftJoinAndSelect('game.player2', 'player2')
            .leftJoinAndSelect('dispute.plaintiff', 'plaintiff')
            .leftJoinAndSelect('dispute.defendant', 'defendant')
            .leftJoinAndSelect('dispute.evidences', 'evidences')
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

        const results: any[] = [];
        for (const dispute of disputes) {
            results.push(await this.mapDispute(dispute, userId));
        }
        return results;
    }

    async getMyDisputes(userId: string) {
        const disputes = await this.disputeRepository
            .createQueryBuilder('dispute')
            .leftJoinAndSelect('dispute.game', 'game')
            .leftJoinAndSelect('game.player1', 'player1')
            .leftJoinAndSelect('game.player2', 'player2')
            .leftJoinAndSelect('dispute.plaintiff', 'plaintiff')
            .leftJoinAndSelect('dispute.defendant', 'defendant')
            .leftJoinAndSelect('dispute.evidences', 'evidences')
            .where('dispute.plaintiffId = :userId', { userId })
            .orWhere('dispute.defendantId = :userId', { userId })
            .orderBy('dispute.createdAt', 'DESC')
            .limit(20)
            .getMany();

        const results: any[] = [];
        for (const dispute of disputes) {
            results.push(await this.mapDispute(dispute, userId));
        }
        return results;
    }

    async getDisputeById(disputeId: string, userId: string) {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: [
                'game',
                'game.player1',
                'game.player2',
                'plaintiff',
                'defendant',
                'evidences',
            ],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        return this.mapDispute(dispute, userId);
    }

    async vote(disputeId: string, userId: string, dto: VoteDto) {
        const dispute = await this.disputeRepository.findOne({
            where: { id: disputeId },
            relations: ['votes', 'game', 'game.player1', 'game.player2', 'plaintiff', 'defendant', 'evidences'],
        });

        if (!dispute) {
            throw new NotFoundException('Dispute not found');
        }

        if (dispute.status !== DisputeStatus.VOTING) {
            throw new BadRequestException('Dispute is not open for voting');
        }

        if (dispute.plaintiffId === userId || dispute.defendantId === userId) {
            throw new BadRequestException('Dispute participants cannot vote');
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

        const voteSummary = await this.buildVoteSummary(disputeId);
        const voteCounts = voteSummary.counts;

        let resolved = false;
        let winningSide: VoteChoice | null = null;

        for (const choice of Object.keys(voteCounts)) {
            if (voteCounts[choice as VoteChoice] >= REQUIRED_VOTES) {
                resolved = true;
                winningSide = choice as VoteChoice;
                break;
            }
        }

        if (resolved && winningSide) {
            await this.resolveDispute(dispute, winningSide);
        }

        const myKarmaAward = resolved && winningSide
            ? dto.winner === winningSide
                ? KARMA_REWARD_CORRECT
                : KARMA_REWARD_PARTICIPATION
            : 0;

        return {
            success: true,
            voteCount: voteSummary.totalVotes,
            requiredVotes: REQUIRED_VOTES,
            resolved,
            winningSide: resolved ? winningSide : null,
            myKarmaAward,
            dispute: await this.getDisputeById(disputeId, userId),
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
            const ratingChanges = await this.gamesService.updateEloRatings(game, true);
            if (ratingChanges) {
                dispute.player1RatingBefore = ratingChanges.player1Before;
                dispute.player1RatingAfter = ratingChanges.player1After;
                dispute.player2RatingBefore = ratingChanges.player2Before;
                dispute.player2RatingAfter = ratingChanges.player2After;
                await this.disputeRepository.save(dispute);
            }

            await this.applyReliabilityImpact(game, winningSide);

            // Award karma to jurors
            await this.awardKarmaToJurors(dispute.id, winningSide);
        }
    }

    private async awardKarmaToJurors(disputeId: string, winningSide: VoteChoice) {
        const votes = await this.juryVoteRepository.find({
            where: { disputeId },
            relations: ['juror'],
        });

        const usersToSave: User[] = [];
        for (const vote of votes) {
            const reward = vote.voteFor === winningSide
                ? KARMA_REWARD_CORRECT
                : KARMA_REWARD_PARTICIPATION;
            vote.juror.karma += reward;
            usersToSave.push(vote.juror);
        }

        if (usersToSave.length > 0) {
            await this.userRepository.save(usersToSave);
        }
    }

    private async applyReliabilityImpact(game: Game, winningSide: VoteChoice) {
        if (winningSide === VoteChoice.DRAW) {
            return;
        }

        const winnerId = winningSide === VoteChoice.PLAYER1 ? game.player1Id : game.player2Id;
        const loserId = winningSide === VoteChoice.PLAYER1 ? game.player2Id : game.player1Id;

        const users = await this.userRepository.find({
            where: [{ id: winnerId }, { id: loserId }],
        });

        const winner = users.find((item) => item.id === winnerId);
        const loser = users.find((item) => item.id === loserId);

        if (!winner || !loser) {
            return;
        }

        winner.reliabilityScore = Math.min(100, winner.reliabilityScore + 1);
        loser.reliabilityScore = Math.max(0, loser.reliabilityScore - 5);

        await this.userRepository.save([winner, loser]);
    }

    private resolveEvidenceItems(dto: CreateDisputeDto) {
        if (dto.evidenceItems && dto.evidenceItems.length > 0) {
            return dto.evidenceItems;
        }
        if (dto.evidenceUrl) {
            return [
                {
                    type: DisputeEvidenceType.VIDEO,
                    url: dto.evidenceUrl,
                    thumbnailUrl: undefined,
                    durationLabel: undefined,
                },
            ];
        }
        return [];
    }

    private buildDefaultSubject(game: Game) {
        if (game.contractData?.location) {
            return `Result dispute at ${game.contractData.location}`;
        }
        return 'Match result dispute';
    }

    private buildDefaultSport(_game: Game) {
        return 'TENNIS';
    }

    private async buildVoteSummary(disputeId: string) {
        const allVotes = await this.juryVoteRepository.find({
            where: { disputeId },
        });

        const counts = {
            [VoteChoice.PLAYER1]: 0,
            [VoteChoice.PLAYER2]: 0,
            [VoteChoice.DRAW]: 0,
        };

        for (const vote of allVotes) {
            counts[vote.voteFor]++;
        }

        return {
            counts,
            totalVotes: allVotes.length,
        };
    }

    private async mapDispute(dispute: Dispute, userId: string) {
        const voteSummary = await this.buildVoteSummary(dispute.id);
        const existingVote = await this.juryVoteRepository.findOne({
            where: {
                disputeId: dispute.id,
                jurorId: userId,
            },
        });

        const player1 = dispute.game?.player1 || null;
        const player2 = dispute.game?.player2 || null;

        const evidence: Array<{
            id: string;
            type: DisputeEvidenceType;
            url: string;
            thumbnailUrl: string | null;
            durationLabel: string | null;
        }> = (dispute.evidences || []).map((item) => ({
            id: item.id,
            type: item.type,
            url: item.url,
            thumbnailUrl: item.thumbnailUrl || null,
            durationLabel: item.durationLabel || null,
        }));

        if (evidence.length === 0 && dispute.evidenceVideoUrl) {
            evidence.push({
                id: 'legacy-video',
                type: DisputeEvidenceType.VIDEO,
                url: dispute.evidenceVideoUrl,
                thumbnailUrl: null,
                durationLabel: null,
            });
        }

        const canVote = dispute.status === DisputeStatus.VOTING &&
            dispute.plaintiffId !== userId &&
            dispute.defendantId !== userId &&
            !existingVote;

        const resolution = this.buildResolution(dispute, player1, player2);

        return {
            id: dispute.id,
            displayId: this.buildDisplayId(dispute.id),
            gameId: dispute.gameId,
            status: dispute.status,
            sport: dispute.sport || 'TENNIS',
            subject: dispute.subject || 'Match result dispute',
            locationLabel: dispute.locationLabel || dispute.game?.contractData?.location || '',
            description: dispute.description,
            createdAt: dispute.createdAt,
            resolvedAt: dispute.resolvedAt,
            rewardKarma: KARMA_REWARD_CORRECT,
            players: {
                player1: {
                    id: player1?.id || dispute.game?.player1Id || '',
                    name: player1?.name || 'Player 1',
                    avatarUrl: player1?.avatarUrl || '',
                    reliabilityScore: player1?.reliabilityScore ?? null,
                },
                player2: {
                    id: player2?.id || dispute.game?.player2Id || '',
                    name: player2?.name || 'Player 2',
                    avatarUrl: player2?.avatarUrl || '',
                    reliabilityScore: player2?.reliabilityScore ?? null,
                },
            },
            plaintiff: {
                id: dispute.plaintiff?.id || dispute.plaintiffId,
                name: dispute.plaintiff?.name || 'Plaintiff',
                avatarUrl: dispute.plaintiff?.avatarUrl || '',
                statement: dispute.plaintiffStatement || '',
            },
            defendant: {
                id: dispute.defendant?.id || dispute.defendantId,
                name: dispute.defendant?.name || 'Defendant',
                avatarUrl: dispute.defendant?.avatarUrl || '',
                statement: dispute.defendantStatement || '',
            },
            evidence,
            voteSummary: {
                total: voteSummary.totalVotes,
                requiredToResolve: REQUIRED_VOTES,
                player1: voteSummary.counts[VoteChoice.PLAYER1],
                player2: voteSummary.counts[VoteChoice.PLAYER2],
                draw: voteSummary.counts[VoteChoice.DRAW],
            },
            hasVoted: !!existingVote,
            myVote: existingVote?.voteFor || null,
            canVote,
            resolution,
        };
    }

    private buildResolution(dispute: Dispute, player1: User | null, player2: User | null) {
        if (dispute.status !== DisputeStatus.RESOLVED || !dispute.winningSide) {
            return null;
        }

        if (dispute.winningSide === VoteChoice.DRAW) {
            return {
                winningSide: dispute.winningSide,
                winner: null,
                loser: null,
                ratingImpact: {
                    player1Before: dispute.player1RatingBefore,
                    player1After: dispute.player1RatingAfter,
                    player2Before: dispute.player2RatingBefore,
                    player2After: dispute.player2RatingAfter,
                },
            };
        }

        const isPlayer1Winner = dispute.winningSide === VoteChoice.PLAYER1;
        const winner = isPlayer1Winner ? player1 : player2;
        const loser = isPlayer1Winner ? player2 : player1;

        return {
            winningSide: dispute.winningSide,
            winner: winner
                ? {
                    id: winner.id,
                    name: winner.name,
                    avatarUrl: winner.avatarUrl || '',
                }
                : null,
            loser: loser
                ? {
                    id: loser.id,
                    name: loser.name,
                    avatarUrl: loser.avatarUrl || '',
                }
                : null,
            ratingImpact: {
                player1Before: dispute.player1RatingBefore,
                player1After: dispute.player1RatingAfter,
                player2Before: dispute.player2RatingBefore,
                player2After: dispute.player2RatingAfter,
            },
        };
    }

    private buildDisplayId(disputeId: string) {
        const compact = disputeId.replace(/-/g, '').slice(0, 8);
        const numeric = parseInt(compact, 16);
        if (Number.isNaN(numeric)) {
            return '0000';
        }
        return (numeric % 9000 + 1000).toString();
    }
}
