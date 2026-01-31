import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Swipe } from '../../domain/entities/swipe.entity';
import { SwipeDto } from './dto/swipe.dto';
import { SportType, SwipeAction } from '../../domain/entities/enums';

@Injectable()
export class MatchmakingService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(SportProfile)
        private sportProfileRepository: Repository<SportProfile>,
        @InjectRepository(Swipe)
        private swipeRepository: Repository<Swipe>,
    ) { }

    async getFeed(userId: string, sport?: SportType) {
        // Get current user's location and profile
        const currentUser = await this.userRepository.findOne({
            where: { id: userId },
            relations: ['sportProfiles'],
        });

        if (!currentUser) {
            throw new Error('User not found');
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

        // Exclude already swiped users
        if (swipedUserIds.length > 0) {
            query.andWhere('profile.userId NOT IN (:...swipedUserIds)', {
                swipedUserIds,
            });
        }

        // TODO: Add location filter (radius)
        // TODO: Add schedule overlap filter

        const profiles = await query.limit(20).getMany();

        return profiles.map((profile) => ({
            id: profile.user.id,
            name: profile.user.name,
            age: this.calculateAge(profile.user.birthDate),
            distanceKm: this.calculateDistance(
                currentUser.latitude,
                currentUser.longitude,
                profile.user.latitude,
                profile.user.longitude,
            ),
            rating: profile.eloRating,
            sport: profile.sportType,
            level: profile.level,
            tags: profile.skills || [],
            imageUrl: profile.user.avatarUrl || '',
            verified: profile.user.reliabilityScore > 80,
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
            throw new Error('Already swiped this user');
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
            }
        }

        return {
            success: true,
            isMatch,
        };
    }

    private calculateAge(birthDate: Date | null): number {
        if (!birthDate) return 0;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
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
