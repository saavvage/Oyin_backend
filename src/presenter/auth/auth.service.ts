import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../../domain/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { PasswordLoginDto } from './dto/password-login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';
import { TelegramGatewayService } from '../../infrastructure/services/telegram-gateway.service';
import { EmailVerificationService } from '../../infrastructure/services/email-verification.service';
import { JwtPayload } from './strategies/jwt.strategy';

type PendingTelegramRequest = {
  requestId: string;
  expiresAt: number;
};

type PendingEmailRequest = {
  code: string;
  expiresAt: number;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private smsCodesMap = new Map<string, string>();
  private telegramRequests = new Map<string, PendingTelegramRequest>();
  private emailCodes = new Map<string, PendingEmailRequest>();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private telegramGatewayService: TelegramGatewayService,
    private emailVerificationService: EmailVerificationService,
    private configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const password = dto.password?.trim() || '';
    if (password.length < 6) {
      throw new BadRequestException(
        'Password must contain at least 6 characters',
      );
    }

    const existingByEmail = await this.userRepository.findOne({
      where: { email },
    });
    if (existingByEmail) {
      throw new BadRequestException('Email is already registered');
    }

    let phone = '';
    if (dto.phone && dto.phone.trim().length > 0) {
      phone = this.normalizePhone(dto.phone);
      const existingByPhone = await this.userRepository.findOne({
        where: { phone },
      });
      if (existingByPhone) {
        throw new BadRequestException('Phone is already registered');
      }
    } else {
      phone = this.generatePlaceholderPhone();
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        name: 'New User',
        email,
        phone,
        passwordHash,
        emailVerified: false,
        phoneVerified: false,
      }),
    );

    return this.buildAuthResponse(user, true);
  }

  async loginWithPassword(dto: PasswordLoginDto) {
    const login = (dto.login || '').trim();
    const password = dto.password || '';
    if (!login || !password) {
      throw new BadRequestException('Login and password are required');
    }

    const isEmail = login.includes('@');
    const normalized = isEmail
      ? this.normalizeEmail(login)
      : this.normalizePhone(login);
    const user = await this.userRepository.findOne({
      where: isEmail ? { email: normalized } : { phone: normalized },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid login or password');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid login or password');
    }

    return this.buildAuthResponse(user, false);
  }

  async login(loginDto: LoginDto) {
    if (loginDto.email) {
      return this.loginWithEmail(loginDto.email);
    }
    if (loginDto.phone) {
      return this.loginWithPhone(loginDto.phone);
    }
    throw new BadRequestException('Phone or email is required');
  }

  private async loginWithEmail(rawEmail: string) {
    const email = this.normalizeEmail(rawEmail);

    const code = this.emailVerificationService.generateCode();
    const ttlMs = 5 * 60 * 1000; // 5 minutes

    this.emailCodes.set(email, {
      code,
      expiresAt: Date.now() + ttlMs,
    });

    if (!this.emailVerificationService.isEnabled()) {
      // Mock fallback for development — use fixed code
      const mockCode = '123456';
      this.emailCodes.set(email, {
        code: mockCode,
        expiresAt: Date.now() + ttlMs,
      });
      this.logger.log(`Mock email verification code for ${email}: ${mockCode}`);
      return { status: 'email_sent', provider: 'mock' };
    }

    const sent = await this.emailVerificationService.sendCode(email, code);

    if (!sent) {
      if (!this.allowMockFallback()) {
        throw new BadRequestException('Failed to send verification email');
      }
      const mockCode = '123456';
      this.emailCodes.set(email, {
        code: mockCode,
        expiresAt: Date.now() + ttlMs,
      });
      this.logger.log(`Mock email verification code for ${email}: ${mockCode}`);
      return { status: 'email_sent', provider: 'mock' };
    }

    return { status: 'email_sent', provider: 'email' };
  }

  private async loginWithPhone(rawPhone: string) {
    const phone = this.normalizePhone(rawPhone);

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

  async verify(verifyDto: VerifyDto, authorizationHeader?: string) {
    const code = verifyDto.code?.trim();
    if (!code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    let identifier: string;
    let identifierType: 'phone' | 'email';

    if (verifyDto.email) {
      identifier = this.normalizeEmail(verifyDto.email);
      identifierType = 'email';
    } else if (verifyDto.phone) {
      identifier = this.normalizePhone(verifyDto.phone);
      identifierType = 'phone';
    } else {
      throw new BadRequestException('Phone or email is required');
    }

    const currentUserId = this.resolveCurrentUserId(authorizationHeader);

    if (currentUserId) {
      const currentUser = await this.userRepository.findOne({
        where: { id: currentUserId },
      });

      if (currentUser) {
        if (identifierType === 'email') {
          const conflict = await this.userRepository.findOne({
            where: { email: identifier },
          });
          if (conflict && conflict.id !== currentUser.id) {
            throw new BadRequestException(
              'Email is already used by another account',
            );
          }
          this.verifyEmailCode(identifier, code);
          currentUser.email = identifier;
          currentUser.emailVerified = true;
        } else {
          const conflict = await this.userRepository.findOne({
            where: { phone: identifier },
          });
          if (conflict && conflict.id !== currentUser.id) {
            throw new BadRequestException(
              'Phone is already used by another account',
            );
          }
          await this.verifyPhoneCode(identifier, code);
          currentUser.phone = identifier;
          currentUser.phoneVerified = true;
        }

        const saved = await this.userRepository.save(currentUser);
        return this.buildAuthResponse(saved, false);
      }
    }

    // Find or create user for unauthenticated flow
    let user: User | null;
    if (identifierType === 'email') {
      this.verifyEmailCode(identifier, code);
      user = await this.userRepository.findOne({
        where: { email: identifier },
      });
    } else {
      await this.verifyPhoneCode(identifier, code);
      user = await this.userRepository.findOne({
        where: { phone: identifier },
      });
      // Legacy phone normalization fallback
      if (!user) {
        const legacyPhone = (verifyDto.phone || '').trim();
        if (legacyPhone && legacyPhone !== identifier) {
          user = await this.userRepository.findOne({
            where: { phone: legacyPhone },
          });
          if (user) {
            user.phone = identifier;
            await this.userRepository.save(user);
          }
        }
      }
    }

    const isNewUser = !user;

    if (!user) {
      const createData: Partial<User> = { name: 'New User' };
      if (identifierType === 'email') {
        createData.email = identifier;
        createData.phone = this.generatePlaceholderPhone();
        createData.emailVerified = true;
        createData.phoneVerified = false;
      } else {
        createData.phone = identifier;
        createData.phoneVerified = true;
        createData.emailVerified = false;
      }
      const created = this.userRepository.create(createData as any);
      user = (await this.userRepository.save(created)) as any as User;
    } else {
      if (identifierType === 'email') {
        user.email = identifier;
        user.emailVerified = true;
      } else {
        user.phone = identifier;
        user.phoneVerified = true;
      }
      user = await this.userRepository.save(user);
    }

    return this.buildAuthResponse(user, isNewUser);
  }

  private verifyEmailCode(email: string, code: string) {
    const pending = this.emailCodes.get(email);

    if (!pending) {
      // Allow mock fallback in dev
      if (this.allowMockFallback() && code === '123456') {
        return;
      }
      throw new UnauthorizedException(
        'Verification code was not requested for this email',
      );
    }

    if (pending.expiresAt < Date.now()) {
      this.emailCodes.delete(email);
      throw new UnauthorizedException(
        'Verification code expired. Request a new one',
      );
    }

    if (pending.code !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }

    this.emailCodes.delete(email);
  }

  private async verifyPhoneCode(phone: string, code: string) {
    const pendingTelegram = this.telegramRequests.get(phone);
    if (pendingTelegram) {
      await this.verifyWithTelegram(phone, code, pendingTelegram);
      return;
    }

    if (this.smsCodesMap.has(phone)) {
      this.verifyWithMock(phone, code);
      return;
    }

    if (this.telegramGatewayService.isEnabled()) {
      throw new UnauthorizedException(
        'Verification code was not requested for this phone',
      );
    }

    this.verifyWithMock(phone, code);
  }

  private async verifyWithTelegram(
    phone: string,
    code: string,
    pending: PendingTelegramRequest,
  ) {
    if (pending.expiresAt < Date.now()) {
      this.telegramRequests.delete(phone);
      throw new UnauthorizedException(
        'Verification code expired. Request a new one',
      );
    }

    const result = await this.telegramGatewayService.checkVerificationCode(
      pending.requestId,
      code,
    );
    if (!result.isValid) {
      throw new UnauthorizedException('Invalid verification code');
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

  private buildAuthResponse(user: User, isNewUser: boolean) {
    const payload = { sub: user.id, phone: user.phone };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        city: user.city,
        phoneVerified: user.phoneVerified,
        avatarUrl: user.avatarUrl,
        karma: user.karma,
        reliabilityScore: user.reliabilityScore,
      },
      isNewUser,
    };
  }

  private allowMockFallback() {
    const raw = this.configService.get<string>('AUTH_ALLOW_MOCK_FALLBACK');
    if (raw != null && raw.trim() !== '') {
      return raw.trim().toLowerCase() === 'true';
    }

    const nodeEnv = (
      this.configService.get<string>('NODE_ENV') || 'development'
    ).toLowerCase();
    return nodeEnv !== 'production';
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

  private normalizeEmail(rawEmail: string) {
    const email = (rawEmail || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    return email;
  }

  private generatePlaceholderPhone() {
    return `tmp_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
  }

  private resolveCurrentUserId(authorizationHeader?: string) {
    const token = (authorizationHeader || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return null;

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.configService.get('JWT_SECRET') || 'fallback-secret-key',
      });
      return payload?.sub || null;
    } catch (_) {
      return null;
    }
  }
}
