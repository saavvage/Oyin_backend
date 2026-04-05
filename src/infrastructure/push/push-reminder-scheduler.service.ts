import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { FcmService } from './fcm.service';

@Injectable()
export class PushReminderSchedulerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PushReminderSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private checkIntervalSeconds = 60;
  private tickInProgress = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly fcmService: FcmService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  onModuleInit() {
    const enabled = (
      this.configService.get<string>('PUSH_REMINDER_SCHEDULER_ENABLED') ||
      'true'
    ).toLowerCase();

    if (enabled !== 'true') {
      this.logger.log('Push reminder scheduler is disabled by env.');
      return;
    }

    if (!this.fcmService.isEnabled()) {
      this.logger.log('Push reminder scheduler is disabled because FCM is not ready.');
      return;
    }

    this.checkIntervalSeconds = this.readCheckIntervalSeconds();

    this.timer = setInterval(() => {
      void this.tick();
    }, this.checkIntervalSeconds * 1000);

    this.logger.log(
      `Push reminder scheduler started (every ${this.checkIntervalSeconds}s).`,
    );

    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.tickInProgress) {
      return;
    }

    this.tickInProgress = true;

    try {
      const users = await this.userRepository
        .createQueryBuilder('user')
        .where('user.pushNotificationsEnabled = :enabled', { enabled: true })
        .andWhere('user.fcmToken IS NOT NULL')
        .andWhere("user.fcmToken <> ''")
        .getMany();

      if (users.length === 0) {
        return;
      }

      const now = new Date();
      const nowMs = now.getTime();

      for (const user of users) {
        const intervalMinutes = this.normalizeIntervalMinutes(
          user.pushReminderIntervalMinutes,
        );
        const intervalMs = intervalMinutes * 60 * 1000;

        const lastSentAtMs = user.pushReminderLastSentAt
          ? user.pushReminderLastSentAt.getTime()
          : 0;

        if (lastSentAtMs > 0 && nowMs - lastSentAtMs < intervalMs) {
          continue;
        }

        const result = await this.fcmService.sendToToken({
          token: user.fcmToken!,
          title: this.getReminderTitle(),
          body: this.getReminderBody(),
          data: {
            type: 'timed_reminder',
            userId: user.id,
          },
        });

        if (result.success) {
          await this.userRepository.update(user.id, {
            pushReminderLastSentAt: now,
          });
          continue;
        }

        if (result.invalidToken) {
          await this.userRepository.update(user.id, {
            fcmToken: null as any,
            pushTokenUpdatedAt: now,
          });
        }
      }
    } catch (error) {
      this.logger.error(
        `Push reminder scheduler tick failed: ${(error as Error).message}`,
      );
    } finally {
      this.tickInProgress = false;
    }
  }

  private readCheckIntervalSeconds() {
    const raw = Number(
      this.configService.get<string>('PUSH_REMINDER_CHECK_INTERVAL_SECONDS') ||
      '60',
    );

    if (!Number.isFinite(raw)) {
      return 60;
    }

    return Math.max(15, Math.min(3600, Math.trunc(raw)));
  }

  private normalizeIntervalMinutes(value: number | null | undefined) {
    if (!value || !Number.isFinite(value)) {
      return 60;
    }

    return Math.max(15, Math.min(1440, Math.trunc(value)));
  }

  private getReminderTitle() {
    return (
      this.configService.get<string>('FCM_REMINDER_TITLE') || 'Oyin reminder'
    );
  }

  private getReminderBody() {
    return (
      this.configService.get<string>('FCM_REMINDER_BODY') ||
      'Open the app to check matches, chats and dispute updates.'
    );
  }
}
