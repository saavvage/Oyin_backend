import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { CreateSportProfileDto } from './dto/create-sport-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePushSettingsDto } from './dto/update-push-settings.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { ReplaceSportProfilesDto } from './dto/replace-sport-profiles.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(SportProfile)
    private sportProfileRepository: Repository<SportProfile>,
  ) {}

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['sportProfiles'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      phone: user.phone,
      name: user.name,
      email: user.email,
      city: user.city,
      birthDate: user.birthDate,
      avatarUrl: user.avatarUrl,
      karma: user.karma,
      reliabilityScore: user.reliabilityScore,
      sportProfiles: (user.sportProfiles || [])
        .slice()
        .sort((a, b) => b.eloRating - a.eloRating),
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.getUserOrThrow(userId);

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.city !== undefined) user.city = dto.city;
    if (dto.birthDate !== undefined) user.birthDate = new Date(dto.birthDate);
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;

    await this.userRepository.save(user);

    return {
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        city: user.city,
        birthDate: user.birthDate,
        avatarUrl: user.avatarUrl,
        karma: user.karma,
        reliabilityScore: user.reliabilityScore,
      },
    };
  }

  async createSportProfile(userId: string, dto: CreateSportProfileDto) {
    const user = await this.getUserOrThrow(userId);
    const existingProfile = await this.sportProfileRepository.findOne({
      where: {
        userId,
        sportType: dto.sportType,
      },
    });

    const profile =
      existingProfile ||
      this.sportProfileRepository.create({
        user,
        userId,
        sportType: dto.sportType,
      });

    profile.level = dto.level;
    profile.skills = this.normalizeSkills(dto.skills);
    profile.availability = dto.schedule || {};
    profile.achievements = dto.achievements || [];
    profile.experienceYears = this.normalizeExperienceYears(
      dto.experienceYears,
    );

    // Set initial ELO based on skill level (only for new profiles)
    if (!existingProfile) {
      const initialElo = { AMATEUR: 1000, SEMI_PRO: 1300, PRO: 1600 };
      profile.eloRating = initialElo[dto.level] ?? 1000;
    }

    await this.sportProfileRepository.save(profile);

    return {
      success: true,
      profile,
    };
  }

  async replaceSportProfiles(userId: string, dto: ReplaceSportProfilesDto) {
    const user = await this.getUserOrThrow(userId);
    const inputProfiles = this.normalizeInputProfiles(dto.profiles);

    const existingProfiles = await this.sportProfileRepository.find({
      where: { userId },
    });

    const existingBySport = new Map(
      existingProfiles.map((item) => [item.sportType, item]),
    );
    const inputSportTypes = new Set(
      inputProfiles.map((item) => item.sportType),
    );

    const toSave: SportProfile[] = [];
    for (const input of inputProfiles) {
      const profile =
        existingBySport.get(input.sportType) ||
        this.sportProfileRepository.create({
          user,
          userId,
          sportType: input.sportType,
        });

      const isNew = !existingBySport.has(input.sportType);
      profile.level = input.level;
      profile.skills = this.normalizeSkills(input.skills);
      profile.availability = input.schedule || {};
      profile.achievements = input.achievements || [];
      profile.experienceYears = this.normalizeExperienceYears(
        input.experienceYears,
      );
      if (isNew) {
        const initialElo = { AMATEUR: 1000, SEMI_PRO: 1300, PRO: 1600 };
        profile.eloRating = initialElo[input.level] ?? 1000;
      }
      toSave.push(profile);
    }

    if (toSave.length > 0) {
      await this.sportProfileRepository.save(toSave);
    }

    const toRemove = existingProfiles.filter(
      (item) => !inputSportTypes.has(item.sportType),
    );
    if (toRemove.length > 0) {
      await this.sportProfileRepository.remove(toRemove);
    }

    const refreshed = await this.sportProfileRepository.find({
      where: { userId },
      order: { eloRating: 'DESC', createdAt: 'ASC' },
    });

    return {
      success: true,
      profiles: refreshed,
    };
  }

  async updateLocation(userId: string, dto: UpdateLocationDto) {
    const user = await this.getUserOrThrow(userId);

    user.latitude = dto.lat;
    user.longitude = dto.lng;
    await this.userRepository.save(user);

    return {
      success: true,
      location: {
        lat: user.latitude,
        lng: user.longitude,
      },
    };
  }

  async getPushSettings(userId: string) {
    const user = await this.getUserOrThrow(userId);

    return {
      enabled: user.pushNotificationsEnabled ?? false,
      intervalMinutes: this.normalizeIntervalMinutes(
        user.pushReminderIntervalMinutes || 60,
      ),
      hasFcmToken: !!user.fcmToken,
      pushPlatform: user.pushPlatform || null,
      pushTokenUpdatedAt: user.pushTokenUpdatedAt || null,
      pushReminderLastSentAt: user.pushReminderLastSentAt || null,
    };
  }

  async updatePushSettings(userId: string, dto: UpdatePushSettingsDto) {
    const user = await this.getUserOrThrow(userId);

    user.pushNotificationsEnabled = dto.enabled;
    user.pushReminderIntervalMinutes = this.normalizeIntervalMinutes(
      dto.intervalMinutes,
    );

    if (!dto.enabled) {
      user.pushReminderLastSentAt = null;
    }

    await this.userRepository.save(user);

    return {
      success: true,
      settings: {
        enabled: user.pushNotificationsEnabled,
        intervalMinutes: user.pushReminderIntervalMinutes,
      },
    };
  }

  async updateAvatarUrl(userId: string, avatarUrl: string) {
    const user = await this.getUserOrThrow(userId);
    user.avatarUrl = avatarUrl;
    await this.userRepository.save(user);

    return {
      success: true,
      avatarUrl: user.avatarUrl,
    };
  }

  async updatePushToken(userId: string, dto: UpdatePushTokenDto) {
    const user = await this.getUserOrThrow(userId);
    const token = dto.token.trim();

    user.fcmToken = token;
    if (dto.platform) {
      user.pushPlatform = dto.platform;
    }
    user.pushTokenUpdatedAt = new Date();

    await this.userRepository.save(user);

    return {
      success: true,
      hasFcmToken: !!user.fcmToken,
      pushPlatform: user.pushPlatform || null,
      pushTokenUpdatedAt: user.pushTokenUpdatedAt,
    };
  }

  private async getUserOrThrow(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private normalizeIntervalMinutes(value: number) {
    if (!Number.isFinite(value)) {
      return 60;
    }
    return Math.max(15, Math.min(1440, Math.trunc(value)));
  }

  private normalizeSkills(skills: string[] | undefined) {
    if (!skills || !Array.isArray(skills)) {
      return [];
    }

    const unique = new Set<string>();
    for (const rawSkill of skills) {
      const skill = (rawSkill || '').trim();
      if (!skill) continue;
      unique.add(skill);
    }
    return Array.from(unique);
  }

  private normalizeExperienceYears(rawValue: number | undefined) {
    if (rawValue == null || !Number.isFinite(rawValue)) {
      return 0;
    }
    const value = Math.trunc(rawValue);
    if (value < 0) return 0;
    if (value > 90) return 90;
    return value;
  }

  private normalizeInputProfiles(profiles: CreateSportProfileDto[]) {
    const bySport = new Map<string, CreateSportProfileDto>();
    for (const profile of profiles || []) {
      if (!profile?.sportType) continue;
      if (!profile?.level) continue;
      bySport.set(profile.sportType, profile);
    }
    return Array.from(bySport.values());
  }
}
