import { IsBoolean, IsInt, Max, Min } from 'class-validator';

export class UpdatePushSettingsDto {
  @IsBoolean()
  enabled: boolean;

  @IsInt()
  @Min(15)
  @Max(1440)
  intervalMinutes: number;
}
