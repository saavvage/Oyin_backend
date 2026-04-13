import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @MinLength(6)
  newPassword: string;

  @IsOptional()
  @IsString()
  currentPassword?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @ValidateIf((dto: UpdatePasswordDto) => dto.email !== undefined)
  @IsEmail()
  email?: string;

  @ValidateIf((dto: UpdatePasswordDto) => dto.phone !== undefined)
  @IsString()
  phone?: string;
}
