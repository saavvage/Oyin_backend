import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { SwipeAction } from '../../../domain/entities/enums';

export class SwipeDto {
    @IsString()
    @IsNotEmpty()
    targetId: string;

    @IsEnum(SwipeAction)
    @IsNotEmpty()
    action: SwipeAction;
}
