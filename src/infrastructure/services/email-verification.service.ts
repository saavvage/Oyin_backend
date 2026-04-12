import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly fromName: string;
  private readonly fromEmail: string;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = (
      this.configService.get<string>('BREVO_API_URL') || 'https://api.brevo.com/v3'
    ).replace(/\/+$/, '');
    this.apiKey = (this.configService.get<string>('BREVO_API_KEY') || '').trim();
    this.fromName =
      (this.configService.get<string>('BREVO_EMAIL_SENDER_NAME') || 'Oyin').trim() ||
      'Oyin';
    this.fromEmail = (
      this.configService.get<string>('BREVO_EMAIL_SENDER') || ''
    ).trim();
    this.init();
  }

  private init() {
    if (!this.apiKey || !this.fromEmail) {
      this.logger.log(
        'Email verification disabled (BREVO_API_KEY or BREVO_EMAIL_SENDER not set). Mock codes will be used.',
      );
      return;
    }

    this.enabled = true;
    this.logger.log('Email verification enabled via Brevo API');
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendCode(email: string, code: string): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.log(`[Mock email] Code for ${email}: ${code}`);
      return true;
    }

    try {
      const response = await fetch(`${this.apiUrl}/smtp/email`, {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: [{ email }],
          subject: `${code} — your Oyin verification code`,
          textContent:
            `Your verification code is: ${code}\n\n` +
            'This code expires in 5 minutes.\n\n' +
            'If you did not request this, please ignore this email.',
          htmlContent: `
            <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
              <h2 style="color:#333;">Oyin Verification</h2>
              <p style="font-size:16px;">Your verification code is:</p>
              <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2196F3;padding:16px 0;">${code}</div>
              <p style="color:#666;font-size:14px;">This code expires in 5 minutes.</p>
              <p style="color:#999;font-size:12px;">If you did not request this, please ignore this email.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await this.readBrevoError(response);
        this.logger.error(
          `Brevo failed to send email to ${email}: ${response.status} ${errorText}`,
        );
        return false;
      }

      this.logger.log(`Verification code sent to ${email} via Brevo`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${email}: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async readBrevoError(response: Response): Promise<string> {
    try {
      const text = await response.text();
      if (!text) {
        return 'empty response';
      }

      try {
        const json = JSON.parse(text) as { message?: string; code?: string };
        if (json.message && json.code) {
          return `${json.code}: ${json.message}`;
        }
        if (json.message) {
          return json.message;
        }
      } catch {
        // fall through to raw text
      }

      return text;
    } catch {
      return 'failed to read response body';
    }
  }
}
