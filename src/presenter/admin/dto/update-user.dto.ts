import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { UserRole } from '../../../domain/entities/enums';

export class AdminUpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  balance?: number;

  @IsOptional()
  @IsInt()
  karma?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reliabilityScore?: number;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  phoneVerified?: boolean;
}

export class AdminAdjustCoinsDto {
  @IsInt()
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminResolveDisputeDto {
  @IsEnum(['PLAYER1', 'PLAYER2', 'DRAW'])
  winningSide: 'PLAYER1' | 'PLAYER2' | 'DRAW';

  @IsOptional()
  @IsString()
  reason?: string;
}
