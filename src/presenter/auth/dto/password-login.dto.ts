import { IsString, MinLength } from 'class-validator';

export class PasswordLoginDto {
  @IsString()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;
}
