import { IsString, IsInt, Min } from 'class-validator';

export class TransferDto {
    @IsString()
    phone: string;

    @IsInt()
    @Min(1)
    amount: number;
}
