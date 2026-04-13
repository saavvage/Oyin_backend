import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/admin-role.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import {
  AdminAdjustCoinsDto,
  AdminResolveDisputeDto,
  AdminUpdateUserDto,
} from './dto/update-user.dto';
import { DisputeStatus, GameStatus } from '../../domain/entities/enums';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listUsers({
      search,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() admin: { userId: string },
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminService.updateUser(admin.userId, id, dto);
  }

  @Post('users/:id/coins')
  adjustCoins(
    @CurrentUser() admin: { userId: string },
    @Param('id') id: string,
    @Body() dto: AdminAdjustCoinsDto,
  ) {
    return this.adminService.adjustCoins(admin.userId, id, dto);
  }

  @Delete('users/:id')
  deleteUser(
    @CurrentUser() admin: { userId: string },
    @Param('id') id: string,
  ) {
    return this.adminService.deleteUser(admin.userId, id);
  }

  @Get('disputes')
  listDisputes(
    @Query('status') status?: DisputeStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listDisputes({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('disputes/:id')
  getDispute(@Param('id') id: string) {
    return this.adminService.getDispute(id);
  }

  @Post('disputes/:id/resolve')
  resolveDispute(
    @CurrentUser() admin: { userId: string },
    @Param('id') id: string,
    @Body() dto: AdminResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(admin.userId, id, dto);
  }

  @Get('games')
  listGames(
    @Query('status') status?: GameStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listGames({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('audit-log')
  listAuditLog(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listAuditLog({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
