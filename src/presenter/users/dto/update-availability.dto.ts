import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAvailabilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsObject()
  schedule?: Record<string, any>;
}
