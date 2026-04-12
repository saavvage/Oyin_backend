import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AiRecentMatchDto {
  @IsOptional()
  @IsString()
  sport?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  opponent?: string;
}

export class AiUserContextDto {
  @IsOptional()
  @IsArray()
  preferred_sports?: string[];

  @IsOptional()
  @IsObject()
  skill_levels?: Record<string, string>;

  @IsOptional()
  @IsArray()
  injuries?: string[];

  @IsOptional()
  @IsNumber()
  matches_played?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AiRecentMatchDto)
  recent_matches?: AiRecentMatchDto[];
}

export class AiChatDto {
  @IsString()
  message: string;

  @IsString()
  user_id: string;

  @IsOptional()
  user_context?: AiUserContextDto;
}
