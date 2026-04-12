import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly mlBaseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.mlBaseUrl = (
      this.config.get<string>('ML_SERVICE_URL') || 'http://localhost:8000'
    ).replace(/\/+$/, '');
    this.logger.log(`ML service URL: ${this.mlBaseUrl}`);
  }

  async chat(userId: string, message: string, userContext?: any) {
    const payload = {
      user_id: userId,
      message,
      ...(userContext ? { user_context: userContext } : {}),
    };

    const data = await this.requestMl(() =>
      firstValueFrom(
        this.http.post(`${this.mlBaseUrl}/chat`, payload, {
          timeout: 120_000,
        }),
      ),
    );

    if (data && typeof data.response === 'string') {
      data.response = this.sanitizeModelResponse(data.response);
    }

    return data;
  }

  async health(): Promise<{
    status: string;
    inference_backend?: string;
    version?: string;
  }> {
    try {
      const { data } = await firstValueFrom(
        this.http.get(`${this.mlBaseUrl}/health`, { timeout: 5_000 }),
      );
      return data;
    } catch (error) {
      this.logger.warn(`ML health check failed: ${this.getErrorMessage(error)}`);
      return { status: 'unavailable', inference_backend: 'none' };
    }
  }

  private async requestMl<T>(request: () => Promise<{ data: T }>): Promise<T> {
    try {
      const { data } = await request();
      return data;
    } catch (error) {
      this.rethrowMlError(error);
    }
  }

  private rethrowMlError(error: unknown): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const body = error.response?.data;
      const message = this.getAxiosErrorMessage(error);

      if (status) {
        this.logger.warn(`ML service error ${status}: ${message}`);
        throw new HttpException(
          this.buildHttpBody(body, message),
          status,
        );
      }

      this.logger.error(`ML transport error: ${message}`);
      throw new ServiceUnavailableException(message);
    }

    const message = this.getErrorMessage(error);
    this.logger.error(`ML unexpected error: ${message}`);
    throw new ServiceUnavailableException(message);
  }

  private getAxiosErrorMessage(error: AxiosError): string {
    const bodyMessage = this.getBodyMessage(error.response?.data);
    if (bodyMessage) {
      return bodyMessage;
    }

    if (error.message && error.message.trim().length > 0) {
      return error.message;
    }

    return 'AI service request failed';
  }

  private buildHttpBody(body: unknown, fallbackMessage: string) {
    if (body && typeof body === 'object') {
      return body as Record<string, unknown>;
    }
    if (typeof body === 'string' && body.trim().length > 0) {
      return { message: body };
    }
    return { message: fallbackMessage };
  }

  private getBodyMessage(body: unknown): string | null {
    if (!body) {
      return null;
    }
    if (typeof body === 'string') {
      return body;
    }
    if (typeof body === 'object') {
      const value = (body as Record<string, unknown>).message;
      if (typeof value === 'string') {
        return value;
      }
    }
    return null;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return 'AI service unavailable';
  }

  private sanitizeModelResponse(response: string): string {
    return response
      .replace(/^<\|channel[^>]*>[\s\S]*?<channel\|>\s*/, '')
      .replace(/^<\|[^>]+>[\s\S]*?<channel\|>\s*/i, '')
      .replace(/^<\|[^>]+>\s*/i, '')
      .replace(/^<channel\|>\s*/i, '')
      .trim();
  }
}
