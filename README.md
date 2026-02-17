# Oyin Backend 
## 1) Что используется в проекте

- Backend: `NestJS` + `TypeORM` + `PostgreSQL`
- Realtime: `Socket.IO` (`/chats` namespace)
- Push: `firebase-admin` (FCM)
- SMS/OTP: Telegram Gateway + mock fallback
- Frontend: Flutter (в соседней папке `../oyin_front`)


## 3)(файлы)

### Точка входа и конфиг

- Запуск приложения: `src/main.ts`
- Подключение модулей: `src/app.module.ts`
- Общий `/api` endpoint: `src/app.controller.ts`

### Модули (feature modules)

- Auth: `src/presenter/auth/auth.module.ts`
- Users: `src/presenter/users/users.module.ts`
- Matchmaking: `src/presenter/matchmaking/matchmaking.module.ts`
- Arena: `src/presenter/arena/arena.module.ts`
- Games: `src/presenter/games/games.module.ts`
- Disputes: `src/presenter/disputes/disputes.module.ts`
- Chats: `src/presenter/chats/chats.module.ts`
- Push: `src/infrastructure/push/push.module.ts`

### Сервисы (бизнес-логика)

- `src/presenter/auth/auth.service.ts`
- `src/presenter/users/users.service.ts`
- `src/presenter/matchmaking/matchmaking.service.ts`
- `src/presenter/arena/arena.service.ts`
- `src/presenter/games/games.service.ts`
- `src/presenter/disputes/disputes.service.ts`
- `src/presenter/chats/chats.service.ts`
- `src/infrastructure/services/elo.service.ts`
- `src/infrastructure/services/telegram-gateway.service.ts`
- `src/infrastructure/push/fcm.service.ts`
- `src/infrastructure/push/push-reminder-scheduler.service.ts`

### Realtime Gateway

- `src/presenter/chats/chats.gateway.ts`

### Сущности БД (таблицы)

- `src/domain/entities/user.entity.ts` -> `users`
- `src/domain/entities/sport-profile.entity.ts` -> `sport_profiles`
- `src/domain/entities/swipe.entity.ts` -> `swipes`
- `src/domain/entities/game.entity.ts` -> `games`
- `src/domain/entities/dispute.entity.ts` -> `disputes`
- `src/domain/entities/dispute-evidence.entity.ts` -> `dispute_evidences`
- `src/domain/entities/jury-vote.entity.ts` -> `jury_votes`
- `src/domain/entities/chat-thread.entity.ts` -> `chat_threads`
- `src/domain/entities/chat-participant.entity.ts` -> `chat_participants`
- `src/domain/entities/chat-message.entity.ts` -> `chat_messages`
- `src/domain/entities/chat-attachment.entity.ts` -> `chat_attachments`
- `src/domain/entities/chat-report.entity.ts` -> `chat_reports`

### Enums (роли, статусы, спорт и т.д.)

- `src/domain/entities/enums.ts`

## 4) Что и куда сохраняется

- Профиль пользователя, роль, карма, надежность, push-настройки: `users`
- Спорт-профили (уровень, ELO, скиллы, опыт): `sport_profiles`
- Лайки/дизлайки: `swipes`
- Матчи/челленджи/результаты: `games`
- Споры: `disputes`
- Фото/видео доказательства спора: `dispute_evidences`
- Голоса жюри: `jury_votes`
- Чаты (тред): `chat_threads`
- Участники чата: `chat_participants`
- Сообщения: `chat_messages`
- Вложения сообщений (image/video/file path): `chat_attachments`
- Жалобы в чате: `chat_reports`

## 5) Как идут связи по ID

- `sport_profiles.userId -> users.id`
- `swipes.actorId/targetId -> users.id`
- `games.player1Id/player2Id/winnerId -> users.id`
- `disputes.gameId -> games.id`
- `disputes.plaintiffId/defendantId -> users.id`
- `dispute_evidences.disputeId -> disputes.id`
- `jury_votes.disputeId -> disputes.id`
- `jury_votes.jurorId -> users.id`
- `chat_participants.threadId -> chat_threads.id`
- `chat_participants.userId -> users.id`
- `chat_messages.threadId -> chat_threads.id`
- `chat_messages.senderId -> users.id`
- `chat_attachments.messageId -> chat_messages.id`

## 6) Как считается рейтинг (ELO)

Логика в `src/infrastructure/services/elo.service.ts`.

- База: стандартная формула ELO (`expected score` + `K-factor`).
- `K-factor`:
  - первые 5 игр: `40`
  - ranked challenge: `30`
  - обычная игра: `20`
- При проигрыше в споре включается двойной штраф проигравшему.
- Обновление рейтинга вызывается из:
  - `src/presenter/games/games.service.ts` (обычное завершение матча)
  - `src/presenter/disputes/disputes.service.ts` (резолв спора)

## 7) Запуск приложения

Все команды запускать из папки `Oyin_backend`.

### 7.1 Поднять инфраструктуру

```bash
docker compose up -d
docker compose ps
```

### 7.2 Проверить backend

```bash
curl http://localhost:3000/api/
```

### 7.3 Показать модули/сервисы/контроллеры

```bash
rg --files src | rg "\.module\.ts$"
rg --files src | rg "\.service\.ts$"
rg --files src | rg "\.controller\.ts$"
rg --files src | rg "\.gateway\.ts$"
```

### 7.4 Показать все REST endpoints

```bash
rg -n "@(Get|Post|Put|Delete|Patch)\(" src/app.controller.ts src/presenter/*/*.controller.ts
```

Только количество endpoint'ов:

```bash
rg -n "@(Get|Post|Put|Delete|Patch)\(" src/app.controller.ts src/presenter/*/*.controller.ts | wc -l
```

### 7.5 Показать таблицы БД (Postgres в Docker)

```bash
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\dt"
```

### 7.6 Показать структуру конкретной таблицы

```bash
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\d users"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\d sport_profiles"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\d games"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\d disputes"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "\d chat_messages"
```

### 7.7 Показать связи (foreign keys)

```bash
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;
"
```

### 7.8 Показать 5 строк данных из ключевых таблиц

```bash
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM users LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM sport_profiles LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM games LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM disputes LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM dispute_evidences LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM chat_threads LIMIT 5;"
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "SELECT * FROM chat_messages LIMIT 5;"
```

### 7.9 Показать "что куда сохраняется" SQL-проверкой

```bash
docker exec -it oyin-db psql -U postgres -d sportmatch_dev -c "
SELECT
  (SELECT COUNT(*) FROM users) AS users,
  (SELECT COUNT(*) FROM sport_profiles) AS sport_profiles,
  (SELECT COUNT(*) FROM swipes) AS swipes,
  (SELECT COUNT(*) FROM games) AS games,
  (SELECT COUNT(*) FROM disputes) AS disputes,
  (SELECT COUNT(*) FROM dispute_evidences) AS dispute_evidences,
  (SELECT COUNT(*) FROM jury_votes) AS jury_votes,
  (SELECT COUNT(*) FROM chat_threads) AS chat_threads,
  (SELECT COUNT(*) FROM chat_participants) AS chat_participants,
  (SELECT COUNT(*) FROM chat_messages) AS chat_messages,
  (SELECT COUNT(*) FROM chat_attachments) AS chat_attachments,
  (SELECT COUNT(*) FROM chat_reports) AS chat_reports;
"
```

## 8) Поток данных (пример для объяснения)

1. Пользователь кидает challenge -> создается `games.id`.
2. Оба игрока отправляют результат в этот `gameId`.
3. Если результаты совпали -> `games.status = PLAYED`, обновляется ELO.
4. Если не совпали -> `games.status = CONFLICT`.
5. Из conflict создается спор: `disputes.gameId = games.id`.
6. Доказательства сохраняются в `dispute_evidences.disputeId = disputes.id`.
7. Жюри голосует в `jury_votes.disputeId`.
8. После резолва спора матч переводится в `PLAYED`, фиксируются rating snapshot поля в `disputes`.

