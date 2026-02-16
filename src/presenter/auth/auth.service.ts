import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../domain/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';
import { TelegramGatewayService } from '../../infrastructure/services/telegram-gateway.service';

type PendingTelegramRequest = {
  requestId: string;
  expiresAt: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Fallback for development when Telegram Gateway token is not configured.
  private smsCodesMap = new Map<string, string>();

  // Stores active Telegram verification request by phone.
  private telegramRequests = new Map<string, PendingTelegramRequest>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private telegramGatewayService: TelegramGatewayService,
    private configService: ConfigService,
  ) {}

  async login(loginDto: LoginDto) {
    const phone = this.normalizePhone(loginDto.phone);

    if (this.telegramGatewayService.isEnabled()) {
      try {
        const sent =
          await this.telegramGatewayService.sendVerificationCode(phone);
        const ttlMs = this.telegramGatewayService.getCodeTtlSeconds() * 1000;

        this.telegramRequests.set(phone, {
          requestId: sent.requestId,
          expiresAt: Date.now() + ttlMs,
        });

        this.logger.log(`Telegram verification code requested for ${phone}`);

        return {
          status: 'sms_sent',
          provider: 'telegram_gateway',
        };
      } catch (error) {
        if (!this.allowMockFallback()) {
          throw error;
        }

        this.logger.warn(
          `Telegram Gateway failed for ${phone}. Falling back to mock code. ${(error as Error).message}`,
        );
      }
    }

    return this.issueMockCode(phone);
  }

  async verify(verifyDto: VerifyDto) {
    const phone = this.normalizePhone(verifyDto.phone);
    const code = verifyDto.code?.trim();

    if (!code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    const pendingTelegram = this.telegramRequests.get(phone);
    if (pendingTelegram) {
      await this.verifyWithTelegram(phone, code);
    } else if (this.smsCodesMap.has(phone)) {
      this.verifyWithMock(phone, code);
    } else if (this.telegramGatewayService.isEnabled()) {
      throw new UnauthorizedException(
        'Verification code was not requested for this phone',
      );
    } else {
      this.verifyWithMock(phone, code);
    }

    let user = await this.userRepository.findOne({ where: { phone } });
    const legacyPhone = (verifyDto.phone || '').trim();

    if (!user && legacyPhone && legacyPhone !== phone) {
      user = await this.userRepository.findOne({
        where: { phone: legacyPhone },
      });
      if (user) {
        user.phone = phone;
        await this.userRepository.save(user);
      }
    }

    const isNewUser = !user;

    if (!user) {
      user = this.userRepository.create({
        phone,
        name: 'New User',
      });
      await this.userRepository.save(user);
    }

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

  private async verifyWithTelegram(phone: string, code: string) {
    const pending = this.telegramRequests.get(phone);

    if (!pending) {
      throw new UnauthorizedException(
        'Verification code was not requested for this phone',
      );
    }

    if (pending.expiresAt < Date.now()) {
      this.telegramRequests.delete(phone);
      throw new UnauthorizedException(
        'Verification code expired. Request a new one',
      );
    }

    const check = await this.telegramGatewayService.checkVerificationCode(
      pending.requestId,
      code,
    );

    if (!check.isValid) {
      throw new UnauthorizedException(
        this.getTelegramVerificationErrorMessage(check.status),
      );
    }

    this.telegramRequests.delete(phone);
  }

  private verifyWithMock(phone: string, code: string) {
    const storedCode = this.smsCodesMap.get(phone);
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    this.smsCodesMap.delete(phone);
  }

  private issueMockCode(phone: string) {
    const mockCode = '123456';
    this.telegramRequests.delete(phone);
    this.smsCodesMap.set(phone, mockCode);

    this.logger.log(`Mock verification code for ${phone}: ${mockCode}`);

    return {
      status: 'sms_sent',
      provider: 'mock',
    };
  }

  private allowMockFallback() {
    const raw = this.configService.get<string>('AUTH_ALLOW_MOCK_FALLBACK');
    if (raw != null && raw.trim().isNotEmpty) {
      return raw.trim().toLowerCase() === 'true';
    }

    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') || 'development'
    ).toLowerCase();
    return nodeEnv !== 'production';
  }

  private getTelegramVerificationErrorMessage(status: string) {
    switch (status) {
      case 'code_invalid':
        return 'Invalid verification code';
      case 'code_expired':
        return 'Verification code expired. Request a new one';
      case 'max_attempts_reached':
        return 'Maximum verification attempts reached. Request a new code';
      default:
        return 'Verification failed. Please request a new code';
    }
  }

  private normalizePhone(rawPhone: string) {
    const value = (rawPhone || '').trim();
    const digits = value.replace(/\D/g, '');

    if (!digits) {
      throw new BadRequestException('Phone number is required');
    }

    if (value.startsWith('+')) {
      return `+${digits}`;
    }

    if (digits.startsWith('00') && digits.length > 2) {
      return `+${digits.slice(2)}`;
    }

    return `+${digits}`;
  }
}
