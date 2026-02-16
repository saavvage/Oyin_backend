import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsArray,
  IsOptional,
  Max,
  Min,
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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(90)
  experienceYears?: number;
}
