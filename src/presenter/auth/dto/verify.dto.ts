import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyDto {
    @IsString()
    @IsNotEmpty()
    phone: string;

    @IsString()
    @IsNotEmpty()
    code: string;
}
