import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePushTokenDto {
  @IsString()
  @MinLength(10)
  @MaxLength(1024)
  token: string;

  @IsOptional()
  @IsString()
  @IsIn(['ios', 'android', 'web'])
  platform?: string;
}
