import {
    Column,
    CreateDateColumn,
    Entity,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatMessage } from './chat-message.entity';

@Entity('chat_attachments')
export class ChatAttachment {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    messageId: string;

    @Column()
    type: string;

    @Column()
    name: string;

    @Column()
    path: string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => ChatMessage, (message) => message.attachments, {
        onDelete: 'CASCADE',
    })
    @JoinColumn({ name: 'messageId' })
    message: ChatMessage;
}
