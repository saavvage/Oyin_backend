import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { CreateSportProfileDto } from './dto/create-sport-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        @InjectRepository(SportProfile)
        private sportProfileRepository: Repository<SportProfile>,
    ) { }

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
            sportProfiles: user.sportProfiles,
        };
    }

    async updateProfile(userId: string, dto: UpdateProfileDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (dto.name !== undefined) user.name = dto.name;
        if (dto.email !== undefined) user.email = dto.email;
        if (dto.city !== undefined) user.city = dto.city;
        if (dto.birthDate !== undefined) user.birthDate = new Date(dto.birthDate);

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
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        const profile = this.sportProfileRepository.create({
            user,
            sportType: dto.sportType,
            level: dto.level,
            skills: dto.skills || [],
            availability: dto.schedule || {},
            achievements: dto.achievements || [],
        });

        await this.sportProfileRepository.save(profile);

        return {
            success: true,
            profile,
        };
    }

    async updateLocation(userId: string, dto: UpdateLocationDto) {
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

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
}
