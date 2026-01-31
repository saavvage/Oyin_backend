import {
    IsString,
    IsNotEmpty,
    IsEnum,
    IsArray,
    IsOptional,
} from 'class-validator';
import { SportType, SkillLevel } from '../../../domain/entities/enums';

export class CreateSportProfileDto {
    @IsEnum(SportType)
    @IsNotEmpty()
    sportType: SportType;

    @IsEnum(SkillLevel)
    @IsNotEmpty()
    level: SkillLevel;

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    skills?: string[];

    @IsOptional()
    schedule?: Record<string, any>;

    @IsOptional()
    achievements?: any[];
}
