import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chat_reports')
export class ChatReport {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    threadId: string;

    @Column()
    userId: string;

    @Column({ type: 'text', nullable: true })
    reason: string;

    @CreateDateColumn()
    createdAt: Date;
}
