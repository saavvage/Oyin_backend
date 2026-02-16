import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Swipe } from '../../domain/entities/swipe.entity';
import { SwipeDto } from './dto/swipe.dto';
import { SportType, SwipeAction } from '../../domain/entities/enums';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';

@Injectable()
export class MatchmakingService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SportProfile)
    private sportProfileRepository: Repository<SportProfile>,
    @InjectRepository(Swipe)
    private swipeRepository: Repository<Swipe>,
    @InjectRepository(ChatThread)
    private chatThreadRepository: Repository<ChatThread>,
    @InjectRepository(ChatParticipant)
    private chatParticipantRepository: Repository<ChatParticipant>,
  ) {}

  async getFeed(
    userId: string,
    sport?: SportType,
    filters?: {
      distanceMin?: number;
      distanceMax?: number;
      ageMin?: number;
      ageMax?: number;
    },
  ) {
    // Get current user's location and profile
    const currentUser = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sportProfiles'],
    });

    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    // Get users already swiped by current user
    const swipedUserIds = await this.swipeRepository
      .createQueryBuilder('swipe')
      .select('swipe.targetId')
      .where('swipe.actorId = :userId', { userId })
      .getRawMany()
      .then((results) => results.map((r) => r.swipe_targetId));

    // Build query for potential matches
    const query = this.sportProfileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('profile.userId != :userId', { userId });

    // Filter by sport if provided
    if (sport) {
      query.andWhere('profile.sportType = :sport', { sport });
    }

    // Filter by age range if provided
    if (filters?.ageMin !== undefined || filters?.ageMax !== undefined) {
      const minAge = filters?.ageMin ?? 0;
      const maxAge = filters?.ageMax ?? 200;
      const today = new Date();
      const maxBirthDate = new Date(
        today.getFullYear() - minAge,
        today.getMonth(),
        today.getDate(),
      );
      const minBirthDate = new Date(
        today.getFullYear() - maxAge,
        today.getMonth(),
        today.getDate(),
      );
      query.andWhere('user.birthDate BETWEEN :minBirthDate AND :maxBirthDate', {
        minBirthDate,
        maxBirthDate,
      });
    }

    // Exclude already swiped users
    if (swipedUserIds.length > 0) {
      query.andWhere('profile.userId NOT IN (:...swipedUserIds)', {
        swipedUserIds,
      });
    }

    // TODO: Add location filter (radius)
    // TODO: Add schedule overlap filter

    const rawProfiles = await query.limit(120).getMany();

    const minDistance = filters?.distanceMin ?? 0;
    const maxDistance = filters?.distanceMax ?? Number.MAX_SAFE_INTEGER;
    const minAge = filters?.ageMin ?? 0;
    const maxAge = filters?.ageMax ?? 200;

    const groupedByUser = new Map<
      string,
      {
        age: number;
        distanceKm: number;
        primaryProfile: SportProfile;
        sports: Set<string>;
        tags: Set<string>;
        maxRating: number;
      }
    >();

    for (const profile of rawProfiles) {
      const age = this.calculateAge(profile.user.birthDate);
      const distanceKm = this.calculateDistance(
        currentUser.latitude,
        currentUser.longitude,
        profile.user.latitude,
        profile.user.longitude,
      );

      if (age < minAge || age > maxAge) {
        continue;
      }
      if (distanceKm < minDistance || distanceKm > maxDistance) {
        continue;
      }

      const userId = profile.user.id;
      const existing = groupedByUser.get(userId);
      const profileSkills = (profile.skills || []).filter((item) => !!item);

      if (!existing) {
        groupedByUser.set(userId, {
          age,
          distanceKm,
          primaryProfile: profile,
          sports: new Set([profile.sportType]),
          tags: new Set(profileSkills),
          maxRating: profile.eloRating,
        });
        continue;
      }

      existing.sports.add(profile.sportType);
      profileSkills.forEach((skill) => existing.tags.add(skill));
      existing.maxRating = Math.max(existing.maxRating, profile.eloRating);

      if (profile.eloRating > existing.primaryProfile.eloRating) {
        existing.primaryProfile = profile;
      }
    }

    const groupedProfiles = Array.from(groupedByUser.values())
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);

    return groupedProfiles.map((item) => ({
      id: item.primaryProfile.user.id,
      name: item.primaryProfile.user.name,
      age: item.age,
      city: item.primaryProfile.user.city || '',
      distanceKm: item.distanceKm,
      rating: item.maxRating,
      sport: item.primaryProfile.sportType,
      sports: Array.from(item.sports),
      level: item.primaryProfile.level,
      tags: Array.from(item.tags).slice(0, 8),
      imageUrl: item.primaryProfile.user.avatarUrl || '',
      verified: item.primaryProfile.user.reliabilityScore > 80,
    }));
  }

  async swipe(userId: string, dto: SwipeDto) {
    // Check if already swiped
    const existing = await this.swipeRepository.findOne({
      where: {
        actorId: userId,
        targetId: dto.targetId,
      },
    });

    if (existing) {
      throw new ForbiddenException('Already swiped this user');
    }

    // Create swipe
    const swipe = this.swipeRepository.create({
      actorId: userId,
      targetId: dto.targetId,
      action: dto.action,
    });

    await this.swipeRepository.save(swipe);

    // Check for mutual match if this was a LIKE
    let isMatch = false;
    let threadId: string | null = null;
    if (dto.action === SwipeAction.LIKE) {
      const reciprocalSwipe = await this.swipeRepository.findOne({
        where: {
          actorId: dto.targetId,
          targetId: userId,
          action: SwipeAction.LIKE,
        },
      });

      if (reciprocalSwipe) {
        isMatch = true;
        // Update both swipes to mark as match
        swipe.isMatch = true;
        reciprocalSwipe.isMatch = true;
        await this.swipeRepository.save([swipe, reciprocalSwipe]);
        threadId = await this.ensureMatchThread(userId, dto.targetId);
      }
    }

    return {
      success: true,
      isMatch,
      threadId,
    };
  }

  private async ensureMatchThread(
    userId: string,
    partnerUserId: string,
  ): Promise<string> {
    const existingThread = await this.findDirectThreadId(userId, partnerUserId);
    if (existingThread) {
      return existingThread;
    }

    const [currentUser, partnerUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: partnerUserId } }),
    ]);

    if (!currentUser || !partnerUser) {
      throw new NotFoundException('User not found');
    }

    const thread = await this.chatThreadRepository.save(
      this.chatThreadRepository.create({
        bucket: 'upcoming',
        statusKey: 'status_matched',
        subtitle: "It's a match! Start chatting.",
      }),
    );

    await this.chatParticipantRepository.save([
      this.chatParticipantRepository.create({
        threadId: thread.id,
        userId,
        partnerName: partnerUser.name,
        partnerAvatarUrl: partnerUser.avatarUrl || '',
      }),
      this.chatParticipantRepository.create({
        threadId: thread.id,
        userId: partnerUser.id,
        partnerName: currentUser.name,
        partnerAvatarUrl: currentUser.avatarUrl || '',
      }),
    ]);

    return thread.id;
  }

  private async findDirectThreadId(
    userId: string,
    partnerUserId: string,
  ): Promise<string | null> {
    const existingThread = await this.chatThreadRepository
      .createQueryBuilder('thread')
      .innerJoin('thread.participants', 'participant')
      .where('participant.userId IN (:...userIds)', {
        userIds: [userId, partnerUserId],
      })
      .groupBy('thread.id')
      .having('COUNT(DISTINCT participant.userId) = 2')
      .andHaving(
        '(SELECT COUNT(1) FROM chat_participants cp WHERE cp."threadId" = thread.id) = 2',
      )
      .orderBy('thread.updatedAt', 'DESC')
      .getOne();

    return existingThread?.id ?? null;
  }

  async resetDislikes(userId: string) {
    await this.swipeRepository.delete({
      actorId: userId,
      action: SwipeAction.DISLIKE,
    });

    return {
      success: true,
    };
  }

  private calculateAge(birthDate: Date | null): number {
    if (!birthDate) return 0;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }

  private calculateDistance(
    lat1: number | null,
    lon1: number | null,
    lat2: number | null,
    lon2: number | null,
  ): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

    const R = 6371; // Earth radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
