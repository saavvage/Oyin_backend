import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { DisputeEvidenceType } from './enums';
import { Dispute } from './dispute.entity';

@Entity('dispute_evidences')
export class DisputeEvidence {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    disputeId: string;

    @Column({
        type: 'enum',
        enum: DisputeEvidenceType,
    })
    type: DisputeEvidenceType;

    @Column({ type: 'text' })
    url: string;

    @Column({ type: 'text', nullable: true })
    thumbnailUrl: string;

    @Column({ nullable: true })
    durationLabel: string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => Dispute, (dispute) => dispute.evidences, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'disputeId' })
    dispute: Dispute;
}
