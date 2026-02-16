import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    OneToOne,
    OneToMany,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Game } from './game.entity';
import { JuryVote } from './jury-vote.entity';
import { DisputeStatus, VoteChoice } from './enums';
import { DisputeEvidence } from './dispute-evidence.entity';

@Entity('disputes')
export class Dispute {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    gameId: string;

    @Column('uuid')
    plaintiffId: string;

    @Column('uuid')
    defendantId: string;

    @Column({ nullable: true })
    evidenceVideoUrl: string;

    @Column({ type: 'text' })
    description: string;

    @Column({ type: 'text', nullable: true })
    subject: string;

    @Column({ nullable: true })
    sport: string;

    @Column({ nullable: true })
    locationLabel: string;

    @Column({ type: 'text', nullable: true })
    plaintiffStatement: string;

    @Column({ type: 'text', nullable: true })
    defendantStatement: string;

    @Column({
        type: 'enum',
        enum: DisputeStatus,
        default: DisputeStatus.VOTING,
    })
    status: DisputeStatus;

    @Column({
        type: 'enum',
        enum: VoteChoice,
        nullable: true,
    })
    winningSide: VoteChoice;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ type: 'timestamp', nullable: true })
    resolvedAt: Date;

    @Column({ type: 'int', nullable: true })
    player1RatingBefore: number;

    @Column({ type: 'int', nullable: true })
    player1RatingAfter: number;

    @Column({ type: 'int', nullable: true })
    player2RatingBefore: number;

    @Column({ type: 'int', nullable: true })
    player2RatingAfter: number;

    // Relations
    @OneToOne(() => Game, (game) => game.dispute)
    @JoinColumn({ name: 'gameId' })
    game: Game;

    @ManyToOne(() => User, (user) => user.disputesAsPlaintiff)
    @JoinColumn({ name: 'plaintiffId' })
    plaintiff: User;

    @ManyToOne(() => User, (user) => user.disputesAsDefendant)
    @JoinColumn({ name: 'defendantId' })
    defendant: User;

    @OneToMany(() => JuryVote, (vote) => vote.dispute)
    votes: JuryVote[];

    @OneToMany(() => DisputeEvidence, (evidence) => evidence.dispute)
    evidences: DisputeEvidence[];
}
