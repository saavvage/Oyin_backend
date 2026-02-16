import { Type } from 'class-transformer';
import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { CreateDisputeEvidenceItemDto } from './create-dispute-evidence-item.dto';

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

    @IsString()
    @IsOptional()
    subject?: string;

    @IsString()
    @IsOptional()
    sport?: string;

    @IsString()
    @IsOptional()
    locationLabel?: string;

    @IsString()
    @IsOptional()
    plaintiffStatement?: string;

    @IsString()
    @IsOptional()
    defendantStatement?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateDisputeEvidenceItemDto)
    @IsOptional()
    evidenceItems?: CreateDisputeEvidenceItemDto[];
}
