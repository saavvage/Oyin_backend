import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AiChatMessage } from '../../domain/entities/ai-chat-message.entity';
import { UserContextBuilderService } from './user-context-builder.service';

const HISTORY_TURNS = 20; // last 10 user + 10 assistant messages

type MlChatResponse = {
  response: string;
  sources?: string[] | null;
  used_rag: boolean;
};

type HistoryTurn = { role: 'user' | 'assistant'; content: string };

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private readonly mlBaseUrl: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(AiChatMessage)
    private readonly messages: Repository<AiChatMessage>,
    private readonly contextBuilder: UserContextBuilderService,
  ) {
    this.mlBaseUrl =
      this.config.get<string>('ML_SERVICE_URL') || 'http://localhost:8000';
    this.logger.log(`ML service URL: ${this.mlBaseUrl}`);
  }

  async chat(userId: string, message: string, clientContext?: any) {
    await this.messages.save(
      this.messages.create({
        userId,
        role: 'user',
        content: message,
        usedRag: false,
        sources: null,
      }),
    );

    const [history, builtContext] = await Promise.all([
      this.loadHistory(userId, HISTORY_TURNS),
      this.contextBuilder.build(userId).catch((e) => {
        this.logger.warn(`UserContextBuilder failed for ${userId}: ${e}`);
        return null;
      }),
    ]);

    const userContext = builtContext
      ? { ...builtContext, ...(clientContext ?? {}) }
      : clientContext;

    const payload = {
      user_id: userId,
      message,
      history,
      ...(userContext ? { user_context: userContext } : {}),
    };

    const { data } = await firstValueFrom(
      this.http.post<MlChatResponse>(`${this.mlBaseUrl}/chat`, payload, {
        timeout: 120_000,
      }),
    );

    await this.messages.save(
      this.messages.create({
        userId,
        role: 'assistant',
        content: data.response,
        usedRag: !!data.used_rag,
        sources: data.sources ?? null,
      }),
    );

    return data;
  }

  /**
   * Returns the last `limit` messages for this user in chronological order
   * (oldest → newest), excluding the row we just inserted for the current turn.
   */
  private async loadHistory(
    userId: string,
    limit: number,
  ): Promise<HistoryTurn[]> {
    const rows = await this.messages.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit + 1, // +1 to drop the message we just stored for this turn
    });

    const withoutCurrent = rows.slice(1).reverse();
    return withoutCurrent.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async getHistory(userId: string, limit = 50) {
    const rows = await this.messages.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: limit,
    });
    return rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      usedRag: m.usedRag,
      sources: m.sources,
      createdAt: m.createdAt,
    }));
  }

  async clearHistory(userId: string) {
    await this.messages.delete({ userId });
    return { status: 'ok' };
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
