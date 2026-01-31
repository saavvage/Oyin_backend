import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';
import { Dispute } from './dispute.entity';
import { VoteChoice } from './enums';

@Entity('jury_votes')
@Index(['disputeId', 'jurorId'], { unique: true })
export class JuryVote {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    disputeId: string;

    @Column('uuid')
    jurorId: string;

    @Column({
        type: 'enum',
        enum: VoteChoice,
    })
    voteFor: VoteChoice;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => Dispute, (dispute) => dispute.votes)
    @JoinColumn({ name: 'disputeId' })
    dispute: Dispute;

    @ManyToOne(() => User, (user) => user.juryVotes)
    @JoinColumn({ name: 'jurorId' })
    juror: User;
}
