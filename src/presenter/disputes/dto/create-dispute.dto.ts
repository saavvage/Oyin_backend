import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateDisputeDto {
    @IsString()
    @IsNotEmpty()
    gameId: string;

    @IsString()
    @IsOptional()
    evidenceUrl?: string;

    @IsString()
    @IsNotEmpty()
    comment: string;
}
