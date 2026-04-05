import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private transporter: nodemailer.Transporter | null = null;
  private enabled = false;

  constructor(private readonly configService: ConfigService) {
    this.init();
  }

  private init() {
    const smtpHost = (this.configService.get<string>('SMTP_HOST') || '').trim();
    const smtpPort = Number(this.configService.get<string>('SMTP_PORT') || '587');
    const smtpUser = (this.configService.get<string>('SMTP_USER') || '').trim();
    const smtpPass = (this.configService.get<string>('SMTP_PASS') || '').trim();

    if (!smtpHost || !smtpUser) {
      this.logger.log('Email verification disabled (SMTP_HOST or SMTP_USER not set). Mock codes will be used.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    this.enabled = true;
    this.logger.log(`Email verification enabled via ${smtpHost}:${smtpPort}`);
  }

  isEnabled(): boolean {
    return this.enabled && !!this.transporter;
  }

  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendCode(email: string, code: string): Promise<boolean> {
    if (!this.isEnabled()) {
      this.logger.log(`[Mock email] Code for ${email}: ${code}`);
      return true;
    }

    const fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'Oyin';
    const fromEmail = this.configService.get<string>('SMTP_USER') || '';

    try {
      await this.transporter!.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: `${code} — your Oyin verification code`,
        text: `Your verification code is: ${code}\n\nThis code expires in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
          <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px;">
            <h2 style="color:#333;">Oyin Verification</h2>
            <p style="font-size:16px;">Your verification code is:</p>
            <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#2196F3;padding:16px 0;">${code}</div>
            <p style="color:#666;font-size:14px;">This code expires in 5 minutes.</p>
            <p style="color:#999;font-size:12px;">If you did not request this, please ignore this email.</p>
          </div>
        `,
      });

      this.logger.log(`Verification code sent to ${email}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${email}: ${(error as Error).message}`);
      return false;
    }
  }
}
