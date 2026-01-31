import { IsEnum, IsNotEmpty } from 'class-validator';
import { VoteChoice } from '../../../domain/entities/enums';

export class VoteDto {
    @IsEnum(VoteChoice)
    @IsNotEmpty()
    winner: VoteChoice;
}
