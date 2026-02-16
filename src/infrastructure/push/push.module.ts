import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { FcmService } from './fcm.service';
import { PushReminderSchedulerService } from './push-reminder-scheduler.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User])],
  providers: [FcmService, PushReminderSchedulerService],
  exports: [FcmService],
})
export class PushModule {}
