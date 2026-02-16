import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatThread } from '../../domain/entities/chat-thread.entity';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';
import { ChatMessage } from '../../domain/entities/chat-message.entity';
import { ChatAttachment } from '../../domain/entities/chat-attachment.entity';
import { ChatReport } from '../../domain/entities/chat-report.entity';
import { SendMessageDto } from './dto/send-message.dto';
import { CreateThreadDto } from './dto/create-thread.dto';
import { User } from '../../domain/entities/user.entity';

type ThreadListItem = {
  id: string;
  name: string;
  subtitle: string;
  avatarUrl: string;
  statusKey: string;
  timestamp: string;
  badgeCount: number | null;
  accent: string | null;
  highlight: boolean;
  buttonKey: string | null;
};

type ChatMessageOutput = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  isMine: boolean;
  createdAt: string;
  attachments: {
    type: string;
    name: string;
    path: string;
  }[];
};

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
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getThreads(userId: string) {
    const participants = await this.participantRepository.find({
      where: { userId },
      relations: ['thread'],
    });

    const actionRequired: ThreadListItem[] = [];
    const upcoming: ThreadListItem[] = [];

    for (const participant of participants) {
      const thread = participant.thread;
      if (!thread) continue;

      const item = this.mapThreadParticipantToListItem(participant);

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
        qb.andWhere('message.createdAt < :before', {
          before: beforeDate.toISOString(),
        });
      }
    }

    const messages = await qb.getMany();

    return messages.map((message) => this.mapMessage(message, userId));
  }

  async sendMessage(
    userId: string,
    threadId: string,
    dto: SendMessageDto,
  ): Promise<ChatMessageOutput> {
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

    return this.mapMessage(saved, userId);
  }

  async createOrGetDirectThread(
    userId: string,
    dto: CreateThreadDto,
  ): Promise<ThreadListItem> {
    const partnerUserId = (dto.partnerUserId ?? '').trim();

    if (!partnerUserId) {
      throw new BadRequestException('partnerUserId is required');
    }

    if (partnerUserId === userId) {
      throw new BadRequestException('Cannot start chat with yourself');
    }

    const [currentUser, partnerUser] = await Promise.all([
      this.userRepository.findOne({ where: { id: userId } }),
      this.userRepository.findOne({ where: { id: partnerUserId } }),
    ]);

    if (!currentUser || !partnerUser) {
      throw new NotFoundException('User not found');
    }

    const existingThread = await this.findDirectThread(userId, partnerUserId);
    if (existingThread) {
      return this.mapThreadParticipantToListItem(existingThread);
    }

    const createdThread = await this.threadRepository.save(
      this.threadRepository.create({
        bucket: 'upcoming',
        statusKey: 'status_matched',
        accent: null,
        highlight: false,
        buttonKey: null,
        subtitle: '',
      }),
    );

    await this.participantRepository.save([
      this.participantRepository.create({
        threadId: createdThread.id,
        userId,
        partnerName: partnerUser.name,
        partnerAvatarUrl: partnerUser.avatarUrl || '',
      }),
      this.participantRepository.create({
        threadId: createdThread.id,
        userId: partnerUser.id,
        partnerName: currentUser.name,
        partnerAvatarUrl: currentUser.avatarUrl || '',
      }),
    ]);

    const ownParticipant = await this.participantRepository.findOne({
      where: { threadId: createdThread.id, userId },
      relations: ['thread'],
    });

    if (!ownParticipant || !ownParticipant.thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.mapThreadParticipantToListItem(ownParticipant);
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

  private async findDirectThread(
    userId: string,
    partnerUserId: string,
  ): Promise<ChatParticipant | null> {
    const existingThread = await this.threadRepository
      .createQueryBuilder('thread')
      .innerJoin('thread.participants', 'participant')
      .where('participant.userId IN (:...userIds)', {
        userIds: [userId, partnerUserId],
      })
      .groupBy('thread.id')
      .having('COUNT(DISTINCT participant.userId) = 2')
      .andHaving(
        '(SELECT COUNT(1) FROM chat_participants cp WHERE cp."threadId" = thread.id) = 2',
      )
      .orderBy('thread.updatedAt', 'DESC')
      .getOne();

    if (!existingThread) {
      return null;
    }

    return this.participantRepository.findOne({
      where: { threadId: existingThread.id, userId },
      relations: ['thread'],
    });
  }

  private formatTimestamp(thread: ChatThread) {
    if (thread.timestampLabel) return thread.timestampLabel;
    if (thread.lastMessageAt) return this.formatTime(thread.lastMessageAt);
    return '';
  }

  private formatTime(value: Date) {
    const hh = value.getHours().toString().padStart(2, '0');
    const mm = value.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private mapMessage(
    message: ChatMessage,
    viewerUserId: string,
  ): ChatMessageOutput {
    return {
      id: message.id,
      threadId: message.threadId,
      senderId: message.senderId,
      text: message.text || '',
      isMine: message.senderId === viewerUserId,
      createdAt: message.createdAt.toISOString(),
      attachments: (message.attachments || []).map((att) => ({
        type: att.type,
        name: att.name,
        path: att.path,
      })),
    };
  }

  private mapThreadParticipantToListItem(
    participant: ChatParticipant,
  ): ThreadListItem {
    const thread = participant.thread;

    return {
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
  }
}
