import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { DisputeEvidenceType } from '../../../domain/entities/enums';

export class CreateDisputeEvidenceItemDto {
    @IsEnum(DisputeEvidenceType)
    type: DisputeEvidenceType;

    @IsString()
    @IsNotEmpty()
    url: string;

    @IsString()
    @IsOptional()
    thumbnailUrl?: string;

    @IsString()
    @IsOptional()
    durationLabel?: string;
}
