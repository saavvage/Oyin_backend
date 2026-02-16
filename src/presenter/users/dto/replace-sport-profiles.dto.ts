import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSportProfileDto } from './create-sport-profile.dto';

export class ReplaceSportProfilesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => CreateSportProfileDto)
  profiles: CreateSportProfileDto[];
}
