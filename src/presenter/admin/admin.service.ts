import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { Dispute } from '../../domain/entities/dispute.entity';
import { Game } from '../../domain/entities/game.entity';
import { AdminAuditLog } from '../../domain/entities/admin-audit-log.entity';
import {
  DisputeStatus,
  GameStatus,
  UserRole,
  VoteChoice,
} from '../../domain/entities/enums';
import {
  AdminAdjustCoinsDto,
  AdminResolveDisputeDto,
  AdminUpdateUserDto,
} from './dto/update-user.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Dispute)
    private readonly disputeRepository: Repository<Dispute>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(AdminAuditLog)
    private readonly auditRepository: Repository<AdminAuditLog>,
  ) {}

  async getStats() {
    const [
      totalUsers,
      admins,
      verifiedUsers,
      totalDisputes,
      activeDisputes,
      resolvedDisputes,
      totalGames,
      playedGames,
      disputedGames,
      balanceAgg,
    ] = await Promise.all([
      this.userRepository.count(),
      this.userRepository.count({ where: { role: UserRole.ADMIN } }),
      this.userRepository.count({ where: { phoneVerified: true } }),
      this.disputeRepository.count(),
      this.disputeRepository.count({ where: { status: DisputeStatus.VOTING } }),
      this.disputeRepository.count({
        where: { status: DisputeStatus.RESOLVED },
      }),
      this.gameRepository.count(),
      this.gameRepository.count({ where: { status: GameStatus.PLAYED } }),
      this.gameRepository.count({ where: { status: GameStatus.DISPUTED } }),
      this.userRepository
        .createQueryBuilder('u')
        .select('COALESCE(SUM(u.balance), 0)', 'total')
        .getRawOne<{ total: string }>(),
    ]);

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const newUsersLast7d = await this.userRepository
      .createQueryBuilder('u')
      .where('u.createdAt >= :since', { since })
      .getCount();

    return {
      users: {
        total: totalUsers,
        admins,
        verified: verifiedUsers,
        newLast7Days: newUsersLast7d,
      },
      disputes: {
        total: totalDisputes,
        active: activeDisputes,
        resolved: resolvedDisputes,
      },
      games: {
        total: totalGames,
        played: playedGames,
        disputed: disputedGames,
      },
      economy: {
        totalBalance: Number(balanceAgg?.total || 0),
      },
    };
  }

  async listUsers(params: {
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where = params.search
      ? [
          { name: ILike(`%${params.search}%`) },
          { phone: ILike(`%${params.search}%`) },
          { email: ILike(`%${params.search}%`) },
        ]
      : undefined;

    const [items, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((u) => this.serializeUser(u)),
      total,
      page,
      limit,
    };
  }

  async getUser(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sportProfiles'],
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...this.serializeUser(user),
      sportProfiles: user.sportProfiles || [],
    };
  }

  async updateUser(
    adminId: string,
    userId: string,
    dto: AdminUpdateUserDto,
  ) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    const fields: (keyof AdminUpdateUserDto)[] = [
      'name',
      'email',
      'city',
      'balance',
      'karma',
      'reliabilityScore',
      'role',
      'phoneVerified',
    ];

    for (const key of fields) {
      if (dto[key] !== undefined && (user as any)[key] !== dto[key]) {
        before[key] = (user as any)[key];
        (user as any)[key] = dto[key];
        after[key] = dto[key];
      }
    }

    await this.userRepository.save(user);
    await this.log(adminId, 'USER_UPDATE', 'user', user.id, { before, after });

    return this.serializeUser(user);
  }

  async adjustCoins(
    adminId: string,
    userId: string,
    dto: AdminAdjustCoinsDto,
  ) {
    if (!Number.isFinite(dto.amount) || dto.amount === 0) {
      throw new BadRequestException('Amount must be a non-zero integer');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const newBalance = user.balance + dto.amount;
    if (newBalance < 0) {
      throw new BadRequestException('Resulting balance cannot be negative');
    }
    user.balance = newBalance;
    await this.userRepository.save(user);
    await this.log(adminId, 'USER_ADJUST_COINS', 'user', user.id, {
      amount: dto.amount,
      reason: dto.reason || null,
      newBalance,
    });

    return { id: user.id, balance: user.balance };
  }

  async deleteUser(adminId: string, userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot delete an admin');
    }
    await this.userRepository.remove(user);
    await this.log(adminId, 'USER_DELETE', 'user', userId, null);
    return { success: true };
  }

  async listDisputes(params: { status?: DisputeStatus; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.disputeRepository.findAndCount({
      where: params.status ? { status: params.status } : {},
      relations: ['plaintiff', 'defendant', 'game', 'votes'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((d) => ({
        id: d.id,
        status: d.status,
        subject: d.subject,
        description: d.description,
        sport: d.sport,
        winningSide: d.winningSide,
        createdAt: d.createdAt,
        resolvedAt: d.resolvedAt,
        votesCount: d.votes?.length || 0,
        plaintiff: d.plaintiff
          ? { id: d.plaintiff.id, name: d.plaintiff.name }
          : null,
        defendant: d.defendant
          ? { id: d.defendant.id, name: d.defendant.name }
          : null,
        gameId: d.gameId,
      })),
      total,
      page,
      limit,
    };
  }

  async getDispute(disputeId: string) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
      relations: [
        'plaintiff',
        'defendant',
        'game',
        'votes',
        'votes.juror',
        'evidences',
      ],
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async resolveDispute(
    adminId: string,
    disputeId: string,
    dto: AdminResolveDisputeDto,
  ) {
    const dispute = await this.disputeRepository.findOne({
      where: { id: disputeId },
    });
    if (!dispute) throw new NotFoundException('Dispute not found');

    dispute.status = DisputeStatus.RESOLVED;
    dispute.winningSide = dto.winningSide as VoteChoice;
    dispute.resolvedAt = new Date();
    await this.disputeRepository.save(dispute);

    await this.log(adminId, 'DISPUTE_FORCE_RESOLVE', 'dispute', dispute.id, {
      winningSide: dto.winningSide,
      reason: dto.reason || null,
    });

    return dispute;
  }

  async listGames(params: { status?: GameStatus; page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await this.gameRepository.findAndCount({
      where: params.status ? { status: params.status } : {},
      relations: ['player1', 'player2'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((g) => ({
        id: g.id,
        status: g.status,
        type: (g as any).type,
        sport: (g as any).sport,
        createdAt: (g as any).createdAt,
        player1: g.player1 ? { id: g.player1.id, name: g.player1.name } : null,
        player2: g.player2 ? { id: g.player2.id, name: g.player2.name } : null,
      })),
      total,
      page,
      limit,
    };
  }

  async listAuditLog(params: { page?: number; limit?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 30));
    const skip = (page - 1) * limit;

    const [items, total] = await this.auditRepository.findAndCount({
      relations: ['admin'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items: items.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        payload: l.payload,
        createdAt: l.createdAt,
        admin: l.admin ? { id: l.admin.id, name: l.admin.name } : null,
      })),
      total,
      page,
      limit,
    };
  }

  private serializeUser(user: User) {
    return {
      id: user.id,
      phone: user.phone,
      phoneVerified: user.phoneVerified,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      city: user.city,
      avatarUrl: user.avatarUrl,
      balance: user.balance,
      karma: user.karma,
      reliabilityScore: user.reliabilityScore,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async log(
    adminId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    payload: Record<string, any> | null,
  ) {
    const entry = this.auditRepository.create({
      adminId,
      action,
      targetType,
      targetId,
      payload,
    });
    await this.auditRepository.save(entry);
  }
}
