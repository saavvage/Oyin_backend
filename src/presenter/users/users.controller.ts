import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSportProfileDto } from './dto/create-sport-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePushSettingsDto } from './dto/update-push-settings.dto';
import { UpdatePushTokenDto } from './dto/update-push-token.dto';
import { ReplaceSportProfilesDto } from './dto/replace-sport-profiles.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

const avatarUploadDir = () => {
  const configured = (process.env.UPLOAD_AVATAR_DIR || '').trim();
  const relative = configured || 'uploads/avatars';
  return join(process.cwd(), relative);
};

const ensureAvatarUploadDir = () => {
  const dir = avatarUploadDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const avatarStorage = diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, ensureAvatarUploadDir());
  },
  filename: (_req, file, cb) => {
    const originalExt = extname(file.originalname || '').toLowerCase();
    const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
    const safeExt = allowedExt.has(originalExt) ? originalExt : '.jpg';
    const uniqueId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `avatar-${uniqueId}${safeExt}`);
  },
});

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('avatar/:fileName')
  getAvatarFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const safeFileName = (fileName || '').trim();
    if (!/^[A-Za-z0-9._-]+$/.test(safeFileName)) {
      throw new NotFoundException('Avatar file not found');
    }

    const fullPath = join(avatarUploadDir(), safeFileName);
    if (!existsSync(fullPath)) {
      throw new NotFoundException('Avatar file not found');
    }

    return res.sendFile(fullPath);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.usersService.getMe(user.userId);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  @Put('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: avatarStorage,
      limits: {
        fileSize: 8 * 1024 * 1024,
      },
    }),
  )
  async updateAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: any,
    @Req() req: Request,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('Avatar file is required');
    }

    const avatarUrl = this.buildAvatarUrl(req, file.filename);
    return this.usersService.updateAvatarUrl(user.userId, avatarUrl);
  }

  @Post('onboarding')
  @UseGuards(JwtAuthGuard)
  async createSportProfile(
    @CurrentUser() user: any,
    @Body() dto: CreateSportProfileDto,
  ) {
    return this.usersService.createSportProfile(user.userId, dto);
  }

  @Put('me/sport-profiles')
  @UseGuards(JwtAuthGuard)
  async replaceSportProfiles(
    @CurrentUser() user: any,
    @Body() dto: ReplaceSportProfilesDto,
  ) {
    return this.usersService.replaceSportProfiles(user.userId, dto);
  }

  @Put('me/location')
  @UseGuards(JwtAuthGuard)
  async updateLocation(
    @CurrentUser() user: any,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.usersService.updateLocation(user.userId, dto);
  }

  @Get('me/availability')
  @UseGuards(JwtAuthGuard)
  async getAvailability(@CurrentUser() user: any) {
    return this.usersService.getAvailability(user.userId);
  }

  @Put('me/availability')
  @UseGuards(JwtAuthGuard)
  async updateAvailability(
    @CurrentUser() user: any,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.usersService.updateAvailability(user.userId, dto);
  }

  @Get('me/push-settings')
  @UseGuards(JwtAuthGuard)
  async getPushSettings(@CurrentUser() user: any) {
    return this.usersService.getPushSettings(user.userId);
  }

  @Put('me/push-settings')
  @UseGuards(JwtAuthGuard)
  async updatePushSettings(
    @CurrentUser() user: any,
    @Body() dto: UpdatePushSettingsDto,
  ) {
    return this.usersService.updatePushSettings(user.userId, dto);
  }

  @Put('me/push-token')
  @UseGuards(JwtAuthGuard)
  async updatePushToken(
    @CurrentUser() user: any,
    @Body() dto: UpdatePushTokenDto,
  ) {
    return this.usersService.updatePushToken(user.userId, dto);
  }

  private buildAvatarUrl(req: Request, fileName: string) {
    const configuredBase = (process.env.PUBLIC_BASE_URL || '')
      .trim()
      .replace(/\/$/, '');

    const requestBase = `${req.protocol}://${req.get('host')}`.replace(
      /\/$/,
      '',
    );
    const baseUrl = configuredBase || requestBase;
    return `${baseUrl}/api/users/avatar/${encodeURIComponent(fileName)}`;
  }
}
