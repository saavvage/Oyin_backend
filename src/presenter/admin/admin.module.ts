import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../domain/entities/user.entity';
import { Dispute } from '../../domain/entities/dispute.entity';
import { Game } from '../../domain/entities/game.entity';
import { AdminAuditLog } from '../../domain/entities/admin-audit-log.entity';
import { UserRole } from '../../domain/entities/enums';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Dispute, Game, AdminAuditLog]),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleGuard],
})
export class AdminModule implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const phone = this.configService.get<string>('ADMIN_PHONE');
    if (!phone) return;
    const normalized = phone.trim();
    if (!normalized) return;

    const user = await this.userRepository.findOne({
      where: { phone: normalized },
    });
    if (!user) {
      console.log(
        `[AdminModule] ADMIN_PHONE=${normalized} not found, skipping seed`,
      );
      return;
    }
    if (user.role !== UserRole.ADMIN) {
      user.role = UserRole.ADMIN;
      await this.userRepository.save(user);
      console.log(`[AdminModule] Promoted ${normalized} to ADMIN`);
    }
  }
}
