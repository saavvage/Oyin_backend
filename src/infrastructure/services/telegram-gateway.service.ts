import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type GatewayResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type SendVerificationResult = {
  request_id: string;
  phone_number: string;
  request_cost: number;
  remaining_balance: number;
  delivery_status?: {
    status: string;
    updated_at: number;
  };
  verification_status?: {
    status: string;
    updated_at: number;
  };
  payload?: string;
};

type CheckVerificationResult = {
  request_id: string;
  phone_number: string;
  request_cost: number;
  remaining_balance: number;
  delivery_status?: {
    status: string;
    updated_at: number;
  };
  verification_status?: {
    status: string;
    updated_at: number;
  };
  payload?: string;
};

@Injectable()
export class TelegramGatewayService {
  private readonly logger = new Logger(TelegramGatewayService.name);
  private readonly apiUrl = 'https://gatewayapi.telegram.org';

  constructor(private readonly configService: ConfigService) {}

  isEnabled() {
    const flag = this.configService.get<string>('TELEGRAM_GATEWAY_ENABLED');
    const token = this.configService.get<string>('TELEGRAM_GATEWAY_TOKEN');

    if (flag != null && flag.trim().length > 0) {
      return flag.trim().toLowerCase() === 'true' && !!token;
    }

    return !!token;
  }

  getCodeTtlSeconds() {
    return this.getPositiveInt('TELEGRAM_GATEWAY_CODE_TTL', 300);
  }

  async sendVerificationCode(phoneNumber: string) {
    this.ensureEnabled();

    const codeLength = this.getPositiveInt('TELEGRAM_GATEWAY_CODE_LENGTH', 6);
    const ttl = this.getCodeTtlSeconds();
    const senderUsername = this.configService
      .get<string>('TELEGRAM_GATEWAY_SENDER_USERNAME')
      ?.trim();

    const payload: Record<string, unknown> = {
      phone_number: phoneNumber,
      code_length: codeLength,
      ttl,
      payload: 'oyin-auth',
    };

    if (senderUsername) {
      payload.sender_username = senderUsername;
    }

    const result = await this.callApi<SendVerificationResult>(
      'sendVerificationMessage',
      payload,
    );

    if (!result.request_id) {
      throw new ServiceUnavailableException(
        'Telegram Gateway did not return request id',
      );
    }

    return {
      requestId: result.request_id,
      verificationStatus: result.verification_status?.status || 'pending',
      deliveryStatus: result.delivery_status?.status || 'pending',
    };
  }

  async checkVerificationCode(requestId: string, code: string) {
    this.ensureEnabled();

    const result = await this.callApi<CheckVerificationResult>(
      'checkVerificationStatus',
      {
        request_id: requestId,
        code,
      },
    );

    const status = result.verification_status?.status || 'unknown';

    return {
      status,
      isValid: status === 'code_valid',
    };
  }

  private ensureEnabled() {
    if (!this.isEnabled()) {
      throw new BadRequestException('Telegram Gateway is not configured');
    }
  }

  private getPositiveInt(key: string, fallback: number) {
    const raw = this.configService.get<string>(key);
    const parsed = raw == null ? NaN : Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }

    return Math.floor(parsed);
  }

  private async callApi<T>(method: string, payload: Record<string, unknown>) {
    const token = this.configService.get<string>('TELEGRAM_GATEWAY_TOKEN');
    if (!token) {
      throw new BadRequestException('TELEGRAM_GATEWAY_TOKEN is missing');
    }

    const response = await fetch(`${this.apiUrl}/${method}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    let json: GatewayResponse<T> | null = null;
    try {
      json = (await response.json()) as GatewayResponse<T>;
    } catch {
      throw new ServiceUnavailableException(
        `Telegram Gateway ${method} returned invalid JSON`,
      );
    }

    if (!response.ok) {
      this.logger.warn(
        `Telegram Gateway ${method} failed: ${response.status} ${json?.description || ''}`,
      );
      throw new ServiceUnavailableException(
        json?.description || 'Telegram Gateway request failed',
      );
    }

    if (!json || !json.ok || !json.result) {
      throw new ServiceUnavailableException(
        json?.description || 'Telegram Gateway returned unexpected response',
      );
    }

    return json.result;
  }
}
