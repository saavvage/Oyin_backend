import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { ChatParticipant } from '../../domain/entities/chat-participant.entity';

type RealtimeAttachment = {
  type: string;
  name: string;
  path: string;
};

type RealtimeMessagePayload = {
  id: string;
  threadId: string;
  senderId: string;
  text: string;
  createdAt: string;
  attachments: RealtimeAttachment[];
};

type JwtPayload = {
  sub: string;
  phone?: string;
};

@WebSocketGateway({
  namespace: '/chats',
  cors: {
    origin: '*',
  },
})
export class ChatsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatsGateway.name);

  constructor(
    @InjectRepository(ChatParticipant)
    private readonly participantRepository: Repository<ChatParticipant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(client: Socket) {
    const userId = await this.authenticateClient(client);

    if (!userId) {
      client.emit('chat:error', { message: 'Unauthorized socket connection' });
      client.disconnect(true);
      return;
    }

    client.data.userId = userId;
    await client.join(this.userRoom(userId));

    this.logger.debug(`Socket connected: ${client.id}, user=${userId}`);
  }

  handleDisconnect(client: Socket) {
    const userId = (client.data.userId ?? '').toString();
    if (userId) {
      this.logger.debug(`Socket disconnected: ${client.id}, user=${userId}`);
    }
  }

  @SubscribeMessage('thread:join')
  async joinThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { threadId?: string },
  ) {
    const userId = this.getUserIdOrThrow(client);
    const threadId = (body?.threadId ?? '').trim();

    if (!threadId) {
      throw new WsException('threadId is required');
    }

    const participant = await this.participantRepository.findOne({
      where: { userId, threadId },
    });

    if (!participant) {
      throw new WsException('Thread not found');
    }

    await client.join(this.threadRoom(threadId));
    client.emit('thread:joined', { threadId });
  }

  @SubscribeMessage('thread:leave')
  async leaveThread(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { threadId?: string },
  ) {
    const threadId = (body?.threadId ?? '').trim();
    if (!threadId) {
      throw new WsException('threadId is required');
    }

    await client.leave(this.threadRoom(threadId));
    client.emit('thread:left', { threadId });
  }

  async emitMessageToThreadParticipants(payload: RealtimeMessagePayload) {
    const participants = await this.participantRepository.find({
      where: { threadId: payload.threadId },
    });

    if (participants.length == 0) {
      return;
    }

    for (const participant of participants) {
      this.server.to(this.userRoom(participant.userId)).emit('message:new', {
        id: payload.id,
        threadId: payload.threadId,
        senderId: payload.senderId,
        text: payload.text,
        isMine: participant.userId === payload.senderId,
        createdAt: payload.createdAt,
        attachments: payload.attachments,
      });
    }

    this.server.to(this.threadRoom(payload.threadId)).emit('thread:activity', {
      threadId: payload.threadId,
      messageId: payload.id,
    });
  }

  private async authenticateClient(client: Socket): Promise<string | null> {
    const token = this.extractToken(client);
    if (!token) {
      return null;
    }

    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    if (!jwtSecret) {
      this.logger.error('JWT_SECRET is missing. Socket auth is unavailable.');
      return null;
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: jwtSecret,
      });

      return payload?.sub?.toString() ?? null;
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = (client.handshake.auth?.token ?? '').toString().trim();

    if (authToken) {
      return authToken.startsWith('Bearer ')
        ? authToken.substring(7)
        : authToken;
    }

    const header = (client.handshake.headers.authorization ?? '').toString();
    if (!header) {
      return null;
    }

    return header.startsWith('Bearer ') ? header.substring(7) : header;
  }

  private getUserIdOrThrow(client: Socket): string {
    const userId = (client.data.userId ?? '').toString();
    if (!userId) {
      throw new WsException('Unauthorized');
    }

    return userId;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private threadRoom(threadId: string) {
    return `thread:${threadId}`;
  }
}
