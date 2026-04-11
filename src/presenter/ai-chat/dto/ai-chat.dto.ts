import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  IsObject,
} from 'class-validator';

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
}

export class AiChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  user_id?: string; // ignored — we use the JWT user, but frontend still sends it

  @IsOptional()
  user_context?: AiUserContextDto;
}
