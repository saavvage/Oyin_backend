import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    Index,
} from 'typeorm';

export type AiChatRole = 'user' | 'assistant';

@Entity('ai_chat_messages')
@Index(['userId', 'createdAt'])
export class AiChatMessage {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    userId: string;

    @Column({ type: 'varchar', length: 16 })
    role: AiChatRole;

    @Column({ type: 'text' })
    content: string;

    @Column({ type: 'boolean', default: false })
    usedRag: boolean;

    @Column({ type: 'jsonb', nullable: true })
    sources: string[] | null;

    @CreateDateColumn()
    createdAt: Date;
}
