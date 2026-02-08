import {
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
} from 'typeorm';
import { ChatParticipant } from './chat-participant.entity';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_threads')
export class ChatThread {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'varchar', length: 32, default: 'upcoming' })
    bucket: string;

    @Column({ nullable: true })
    statusKey: string;

    @Column({ nullable: true })
    accent: string;

    @Column({ type: 'boolean', default: false })
    highlight: boolean;

    @Column({ nullable: true })
    buttonKey: string;

    @Column({ nullable: true })
    subtitle: string;

    @Column({ nullable: true })
    timestampLabel: string;

    @Column({ type: 'timestamp', nullable: true })
    lastMessageAt: Date;

    @Column({ nullable: true })
    lastMessageText: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @OneToMany(() => ChatParticipant, (participant) => participant.thread)
    participants: ChatParticipant[];

    @OneToMany(() => ChatMessage, (message) => message.thread)
    messages: ChatMessage[];
}
