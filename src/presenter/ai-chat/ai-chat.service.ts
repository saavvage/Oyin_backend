import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly mlBaseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.mlBaseUrl =
      this.config.get<string>('ML_SERVICE_URL') || 'http://localhost:8000';
    this.logger.log(`ML service URL: ${this.mlBaseUrl}`);
  }

  async chat(userId: string, message: string, userContext?: any) {
    const payload = {
      user_id: userId,
      message,
      ...(userContext ? { user_context: userContext } : {}),
    };

    const { data } = await firstValueFrom(
      this.http.post(`${this.mlBaseUrl}/chat`, payload, {
        timeout: 120_000,
      }),
    );

    return data;
  }

  async health(): Promise<{
    status: string;
    inference_backend?: string;
  }> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.mlBaseUrl}/health`, { timeout: 5_000 }),
      );
      return data;
    } catch {
      return { status: 'unavailable' };
    }
  }
}
