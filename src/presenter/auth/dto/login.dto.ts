import { IsString, IsOptional, ValidateIf } from 'class-validator';

export class LoginDto {
    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.phone)
    email?: string;
}
