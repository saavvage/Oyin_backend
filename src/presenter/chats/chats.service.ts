import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { ChatAttachment } from '../../domain/entities/chat-attachment.entity';
import { ChatReport } from '../../domain/entities/chat-report.entity';
import { SendMessageDto } from './dto/send-message.dto';

type ThreadBucket = 'actionRequired' | 'upcoming';

@Injectable()
export class ChatsService {
    constructor(
        @InjectRepository(ChatThread)
        private readonly threadRepository: Repository<ChatThread>,
        @InjectRepository(ChatParticipant)
        private readonly participantRepository: Repository<ChatParticipant>,
        @InjectRepository(ChatMessage)
        private readonly messageRepository: Repository<ChatMessage>,
        @InjectRepository(ChatAttachment)
        private readonly attachmentRepository: Repository<ChatAttachment>,
        @InjectRepository(ChatReport)
        private readonly reportRepository: Repository<ChatReport>,
    ) { }

    async getThreads(userId: string) {
        await this.ensureSeed(userId);

        const participants = await this.participantRepository.find({
            where: { userId },
            relations: ['thread'],
        });

        const actionRequired = [];
        const upcoming = [];

        for (const participant of participants) {
            const thread = participant.thread;
            if (!thread) continue;

            const item = {
                id: thread.id,
                name: participant.partnerName,
                subtitle: thread.lastMessageText || thread.subtitle || '',
                avatarUrl: participant.partnerAvatarUrl,
                statusKey: thread.statusKey || '',
                timestamp: this.formatTimestamp(thread),
                badgeCount: participant.unreadCount > 0 ? participant.unreadCount : null,
                accent: thread.accent || null,
                highlight: thread.highlight || false,
                buttonKey: thread.buttonKey || null,
            };

            if (thread.bucket === 'actionRequired') {
                actionRequired.push(item);
            } else {
                upcoming.push(item);
            }
        }

        return { actionRequired, upcoming };
    }

    async getMessages(userId: string, threadId: string, before?: string) {
        await this.ensureParticipant(userId, threadId);

        const qb = this.messageRepository
            .createQueryBuilder('message')
            .leftJoinAndSelect('message.attachments', 'attachments')
            .where('message.threadId = :threadId', { threadId })
            .orderBy('message.createdAt', 'DESC')
            .take(20);

        if (before) {
            const beforeDate = new Date(before);
            if (!Number.isNaN(beforeDate.getTime())) {
                qb.andWhere('message.createdAt < :before', { before: beforeDate.toISOString() });
            }
        }

        const messages = await qb.getMany();

        return messages.map((message) => ({
            id: message.id,
            text: message.text || '',
            isMine: message.senderId === userId,
            createdAt: message.createdAt.toISOString(),
            attachments: (message.attachments || []).map((att) => ({
                type: att.type,
                name: att.name,
                path: att.path,
            })),
        }));
    }

    async sendMessage(userId: string, threadId: string, dto: SendMessageDto) {
        await this.ensureParticipant(userId, threadId);

        const text = (dto.text ?? '').trim();
        const attachments = dto.attachments ?? [];

        if (!text && attachments.length === 0) {
            throw new BadRequestException('Message is empty');
        }

        const message = this.messageRepository.create({
            threadId,
            senderId: userId,
            text: text || null,
            attachments: attachments.map((item) =>
                this.attachmentRepository.create({
                    type: item.type,
                    name: item.name,
                    path: item.path,
                }),
            ),
        });

        const saved = await this.messageRepository.save(message);
        const lastText = text || 'Вложение';

        await this.threadRepository.update(threadId, {
            lastMessageAt: saved.createdAt,
            lastMessageText: lastText,
            timestampLabel: this.formatTime(saved.createdAt),
        });

        return {
            id: saved.id,
            text: saved.text || '',
            isMine: true,
            createdAt: saved.createdAt.toISOString(),
            attachments: (saved.attachments || []).map((att) => ({
                type: att.type,
                name: att.name,
                path: att.path,
            })),
        };
    }

    async deleteThread(userId: string, threadId: string) {
        const participant = await this.participantRepository.findOne({
            where: { userId, threadId },
        });

        if (!participant) {
            throw new NotFoundException('Thread not found');
        }

        await this.participantRepository.remove(participant);

        const remaining = await this.participantRepository.count({
            where: { threadId },
        });

        if (remaining === 0) {
            const thread = await this.threadRepository.findOne({
                where: { id: threadId },
            });
            if (thread) {
                await this.threadRepository.remove(thread);
            }
        }

        return { success: true };
    }

    async blockThread(userId: string, threadId: string) {
        const participant = await this.participantRepository.findOne({
            where: { userId, threadId },
        });

        if (!participant) {
            throw new NotFoundException('Thread not found');
        }

        participant.isBlocked = true;
        await this.participantRepository.save(participant);

        return { isBlocked: true };
    }

    async reportThread(userId: string, threadId: string, reason?: string) {
        await this.ensureParticipant(userId, threadId);

        const report = this.reportRepository.create({
            threadId,
            userId,
            reason: reason || null,
        });

        await this.reportRepository.save(report);
        return { success: true };
    }

    private async ensureParticipant(userId: string, threadId: string) {
        const participant = await this.participantRepository.findOne({
            where: { userId, threadId },
        });
        if (!participant) {
            throw new NotFoundException('Thread not found');
        }
        return participant;
    }

    private async ensureSeed(userId: string) {
        const existing = await this.participantRepository.count({
            where: { userId },
        });

        if (existing > 0) return;

        const thread1 = await this.threadRepository.save(
            this.threadRepository.create({
                bucket: 'actionRequired',
                statusKey: 'status_dispute_open',
                accent: 'red',
                highlight: true,
                buttonKey: 'resolve',
                subtitle: 'Dispute started regarding the final set score. Please upload…',
                timestampLabel: 'Mon',
            }),
        );

        await this.participantRepository.save(
            this.participantRepository.create({
                threadId: thread1.id,
                userId,
                partnerName: 'Sarah L.',
                partnerAvatarUrl:
                    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=80',
            }),
        );

        await this.messageRepository.save([
            this.messageRepository.create({
                threadId: thread1.id,
                senderId: 'partner_seed_1',
                text: 'Привет! Уточним счет по последнему сету?',
            }),
            this.messageRepository.create({
                threadId: thread1.id,
                senderId: userId,
                text: 'Да, согласен. Прикреплю скрин позже.',
            }),
        ]);

        const thread2 = await this.threadRepository.save(
            this.threadRepository.create({
                bucket: 'upcoming',
                statusKey: 'status_contract_signed',
                accent: 'green',
                highlight: false,
                buttonKey: null,
                subtitle: "See you at the court at 5? I'll bring th…",
                timestampLabel: '10:30 AM',
            }),
        );

        await this.participantRepository.save(
            this.participantRepository.create({
                threadId: thread2.id,
                userId,
                partnerName: 'Alex P.',
                partnerAvatarUrl:
                    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
            }),
        );

        await this.messageRepository.save([
            this.messageRepository.create({
                threadId: thread2.id,
                senderId: 'partner_seed_2',
                text: 'Встречаемся у корта в 17:00?',
            }),
            this.messageRepository.create({
                threadId: thread2.id,
                senderId: userId,
                text: 'Отлично, я буду вовремя.',
            }),
        ]);

        await this.refreshThreadMeta(thread1.id);
        await this.refreshThreadMeta(thread2.id);
    }

    private async refreshThreadMeta(threadId: string) {
        const last = await this.messageRepository.findOne({
            where: { threadId },
            order: { createdAt: 'DESC' },
        });

        if (!last) return;

        await this.threadRepository.update(threadId, {
            lastMessageAt: last.createdAt,
            lastMessageText: last.text || 'Вложение',
            timestampLabel: this.formatTime(last.createdAt),
        });
    }

    private formatTimestamp(thread: ChatThread) {
        if (thread.timestampLabel) return thread.timestampLabel;
        if (thread.lastMessageAt) return this.formatTime(thread.lastMessageAt);
        return '';
    }

    private formatTime(value: Date) {
        const hh = value.getHours().toString().padLeft(2, '0');
        const mm = value.getMinutes().toString().padLeft(2, '0');
        return `${hh}:${mm}`;
    }
}
