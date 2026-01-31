import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    OneToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Dispute } from './dispute.entity';
import { GameType, GameStatus } from './enums';

@Entity('games')
export class Game {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: GameType,
    })
    type: GameType;

    @Column({
        type: 'enum',
        enum: GameStatus,
        default: GameStatus.PENDING,
    })
    status: GameStatus;

    @Column('uuid')
    player1Id: string;

    @Column('uuid')
    player2Id: string;

    @Column({ type: 'uuid', nullable: true })
    winnerId: string;

    @Column({ type: 'jsonb', nullable: true })
    contractData: {
        date?: string;
        venueId?: string;
        reminder?: boolean;
        location?: string;
    };

    @Column({ nullable: true })
    scorePlayer1: string;

    @Column({ nullable: true })
    scorePlayer2: string;

    @Column({ type: 'boolean', default: false })
    player1Submitted: boolean;

    @Column({ type: 'boolean', default: false })
    player2Submitted: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // Relations
    @ManyToOne(() => User, (user) => user.gamesAsPlayer1)
    @JoinColumn({ name: 'player1Id' })
    player1: User;

    @ManyToOne(() => User, (user) => user.gamesAsPlayer2)
    @JoinColumn({ name: 'player2Id' })
    player2: User;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'winnerId' })
    winner: User;

    @OneToOne(() => Dispute, (dispute) => dispute.game, { nullable: true })
    dispute: Dispute;
}
