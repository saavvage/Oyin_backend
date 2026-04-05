import { IsString, IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';

export class VerifyDto {
    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    @ValidateIf((o) => !o.phone)
    email?: string;

    @IsString()
    @IsNotEmpty()
    code: string;
}
