import { IsString, IsNotEmpty } from 'class-validator';

export class ResultDto {
    @IsString()
    @IsNotEmpty()
    myScore: string;

    @IsString()
    @IsNotEmpty()
    opponentScore: string;
}
