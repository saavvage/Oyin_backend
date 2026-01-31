import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '../../domain/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';

@Injectable()
export class AuthService {
    // Mock SMS codes storage (in production, use Redis)
    private smsCodesMap = new Map<string, string>();

    constructor(
        @InjectRepository(User)
        private userRepository: Repository<User>,
        private jwtService: JwtService,
        private configService: ConfigService,
    ) { }

    async login(loginDto: LoginDto) {
        // Mock SMS sending - always use code "123456" for development
        const mockCode = '123456';
        this.smsCodesMap.set(loginDto.phone, mockCode);

        // In production, integrate with SMS gateway here
        console.log(`📱 Mock SMS sent to ${loginDto.phone}: ${mockCode}`);

        return { status: 'sms_sent' };
    }

    async verify(verifyDto: VerifyDto) {
        const { phone, code } = verifyDto;

        // Verify code
        const storedCode = this.smsCodesMap.get(phone);
        if (!storedCode || storedCode !== code) {
            throw new Error('Invalid verification code');
        }

        // Remove used code
        this.smsCodesMap.delete(phone);

        // Find or create user
        let user = await this.userRepository.findOne({ where: { phone } });
        const isNewUser = !user;

        if (!user) {
            user = this.userRepository.create({
                phone,
                name: 'New User', // Will be updated during onboarding
            });
            await this.userRepository.save(user);
        }

        // Generate JWT
        const payload = { sub: user.id, phone: user.phone };
        const accessToken = this.jwtService.sign(payload);

        return {
            accessToken,
            user: {
                id: user.id,
                phone: user.phone,
                name: user.name,
                email: user.email,
                city: user.city,
                avatarUrl: user.avatarUrl,
                karma: user.karma,
                reliabilityScore: user.reliabilityScore,
            },
            isNewUser,
        };
    }
}
