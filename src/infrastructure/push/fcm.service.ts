import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

type FcmSendResult = {
  success: boolean;
  invalidToken: boolean;
};

type LegacyServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private messaging: admin.messaging.Messaging | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const enabledRaw = (
      this.configService.get<string>('FCM_ENABLED') || 'false'
    ).toLowerCase();

    if (enabledRaw !== 'true') {
      this.logger.log('FCM is disabled by env (FCM_ENABLED=false).');
      return;
    }

    const serviceAccount = this.resolveServiceAccount();
    if (!serviceAccount) {
      this.logger.warn(
        'FCM is enabled but service account is missing. Set FCM_SERVICE_ACCOUNT_PATH or FCM_SERVICE_ACCOUNT_JSON or FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY.',
      );
      return;
    }

    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }

      this.messaging = admin.messaging();
      this.enabled = true;
      this.logger.log('FCM service initialized.');
    } catch (error) {
      this.logger.error(
        `Failed to initialize FCM service: ${(error as Error).message}`,
      );
    }
  }

  isEnabled() {
    return this.enabled && !!this.messaging;
  }

  async sendToToken(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
  }): Promise<FcmSendResult> {
    const token = (params.token || '').trim();
    if (!this.isEnabled() || !token) {
      return { success: false, invalidToken: false };
    }

    try {
      const dryRun =
        (this.configService.get<string>('FCM_DRY_RUN') || 'false').toLowerCase() ===
        'true';

      await this.messaging!.send(
        {
          token,
          notification: {
            title: params.title,
            body: params.body,
          },
          data: params.data,
        },
        dryRun,
      );

      return { success: true, invalidToken: false };
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      const invalidToken =
        code === 'messaging/invalid-registration-token' ||
        code === 'messaging/registration-token-not-registered';

      this.logger.warn(
        `Failed to send FCM push (invalidToken=${invalidToken}, code=${code}): ${(error as Error).message}`,
      );

      return { success: false, invalidToken };
    }
  }

  private resolveServiceAccount(): admin.ServiceAccount | null {
    const serviceAccountPath = (
      this.configService.get<string>('FCM_SERVICE_ACCOUNT_PATH') || ''
    ).trim();

    if (serviceAccountPath) {
      try {
        const raw = readFileSync(serviceAccountPath, 'utf8');
        const parsed = this.parseServiceAccountJson(raw);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        this.logger.warn(
          `Failed to read FCM_SERVICE_ACCOUNT_PATH (${serviceAccountPath}): ${(error as Error).message}`,
        );
      }
    }

    const rawJson = (this.configService.get<string>('FCM_SERVICE_ACCOUNT_JSON') || '')
      .trim();

    if (rawJson) {
      const parsed = this.parseServiceAccountJson(rawJson);
      if (parsed) {
        return parsed;
      }
    }

    const projectId = (this.configService.get<string>('FCM_PROJECT_ID') || '').trim();
    const clientEmail = (
      this.configService.get<string>('FCM_CLIENT_EMAIL') || ''
    ).trim();
    const privateKeyRaw = this.configService.get<string>('FCM_PRIVATE_KEY') || '';
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();

    if (!projectId || !clientEmail || !privateKey) {
      return null;
    }

    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  private parseServiceAccountJson(rawJson: string): admin.ServiceAccount | null {
    try {
      const parsed = JSON.parse(rawJson) as
        | admin.ServiceAccount
        | LegacyServiceAccountShape;

      const projectId = (parsed.projectId || parsed.project_id || '').trim();
      const clientEmail = (parsed.clientEmail || parsed.client_email || '').trim();
      const privateKey = (
        parsed.privateKey ||
        parsed.private_key ||
        ''
      )
        .toString()
        .replace(/\\n/g, '\n')
        .trim();

      if (!projectId || !clientEmail || !privateKey) {
        return null;
      }

      return {
        projectId,
        clientEmail,
        privateKey,
      };
    } catch {
      this.logger.warn('Invalid FCM_SERVICE_ACCOUNT_JSON format.');
      return null;
    }
  }
}
