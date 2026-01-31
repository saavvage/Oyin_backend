import { Controller, Get, Post, Put, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateSportProfileDto } from './dto/create-sport-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
    constructor(private usersService: UsersService) { }

    @Get('me')
    async getMe(@CurrentUser() user: any) {
        return this.usersService.getMe(user.userId);
    }

    @Post('onboarding')
    async createSportProfile(
        @CurrentUser() user: any,
        @Body() dto: CreateSportProfileDto,
    ) {
        return this.usersService.createSportProfile(user.userId, dto);
    }

    @Put('me/location')
    async updateLocation(
        @CurrentUser() user: any,
        @Body() dto: UpdateLocationDto,
    ) {
        return this.usersService.updateLocation(user.userId, dto);
    }
}
