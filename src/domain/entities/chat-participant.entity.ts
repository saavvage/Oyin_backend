import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatThread } from './chat-thread.entity';

@Entity('chat_participants')
export class ChatParticipant {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    threadId: string;

    @Column()
    userId: string;

    @Column()
    partnerName: string;

    @Column()
    partnerAvatarUrl: string;

    @Column({ type: 'int', default: 0 })
    unreadCount: number;

    @Column({ type: 'boolean', default: false })
    isBlocked: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => ChatThread, (thread) => thread.participants, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'threadId' })
    thread: ChatThread;
}
