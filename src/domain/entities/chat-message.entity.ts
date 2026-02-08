import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatThread } from './chat-thread.entity';
import { ChatAttachment } from './chat-attachment.entity';

@Entity('chat_messages')
export class ChatMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    threadId: string;

    @Column()
    senderId: string;

    @Column({ type: 'text', nullable: true })
    text: string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => ChatThread, (thread) => thread.messages, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'threadId' })
    thread: ChatThread;

    @OneToMany(() => ChatAttachment, (attachment) => attachment.message, {
        cascade: true,
    })
    attachments: ChatAttachment[];
}
