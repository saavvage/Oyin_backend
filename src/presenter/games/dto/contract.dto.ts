import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class ContractDto {
    @IsString()
    @IsNotEmpty()
    date: string; // ISO string

    @IsString()
    @IsOptional()
    venueId?: string;

    @IsString()
    @IsOptional()
    location?: string;

    @IsBoolean()
    @IsOptional()
    reminder?: boolean;
}
