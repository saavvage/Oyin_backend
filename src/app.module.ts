import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './presenter/auth/auth.module';
import { UsersModule } from './presenter/users/users.module';
import { MatchmakingModule } from './presenter/matchmaking/matchmaking.module';
import { ArenaModule } from './presenter/arena/arena.module';
import { GamesModule } from './presenter/games/games.module';
import { DisputesModule } from './presenter/disputes/disputes.module';
import { ChatsModule } from './presenter/chats/chats.module';
import { WalletModule } from './presenter/wallet/wallet.module';
import { PushModule } from './infrastructure/push/push.module';
import { AiChatModule } from './presenter/ai-chat/ai-chat.module';
import { AdminModule } from './presenter/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const url = configService.get<string>('DATABASE_URL');
        const isProd = configService.get('NODE_ENV') === 'production';
        return {
          type: 'postgres',
          ...(url
            ? { url }
            : {
                host: configService.get<string>('DB_HOST'),
                port: Number(configService.get<string>('DB_PORT') ?? 5432),
                username: configService.get<string>('DB_USERNAME'),
                password: configService.get<string>('DB_PASSWORD'),
                database: configService.get<string>('DB_DATABASE'),
              }),
          entities: [__dirname + '/domain/entities/**/*.entity{.ts,.js}'],
          synchronize: configService.get('NODE_ENV') === 'development',
          logging: configService.get('NODE_ENV') === 'development',
          ...(isProd ? { ssl: { rejectUnauthorized: false } } : {}),
        };
      },
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    MatchmakingModule,
    ArenaModule,
    GamesModule,
    DisputesModule,
    ChatsModule,
    WalletModule,
    PushModule,
    AiChatModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
