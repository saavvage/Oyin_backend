

# 📄 SportMatch Backend Specification

## 1. Обзор проекта и Технический стек

### Описание
Приложение для поиска спортивных партнеров (настольный теннис, бокс и др.). Сочетает механику дейтинг-приложений (свайпы для поиска) и соревновательную механику (рейтинговая таблица, вызовы). Включает систему контрактов на игру, чаты и "Народный суд" для решения споров.

### Технический стек
*   **Framework:** NestJS (Node.js)
*   **Language:** TypeScript
*   **Database:** PostgreSQL
*   **ORM:** Prisma (предпочтительно) или TypeORM.
*   **Auth:** JWT (Access/Refresh tokens) + SMS Verification (Firebase Auth или SMS-шлюз).
*   **Real-time:** WebSockets (Socket.io) для чатов и уведомлений.
*   **Storage:** S3-compatible (MinIO/AWS) для фото и видео доказательств.

---

## 2. Сущности базы данных (ER-Model Draft)

### User (Пользователь)
*   `id`: UUID
*   `phone`: String (Unique)
*   `name`: String
*   `avatarUrl`: String
*   `karma`: Int (Валюта за судейство)
*   `reliabilityScore`: Float (Рейтинг надежности, 0-100%)
*   `role`: Enum (USER, ADMIN)

### SportProfile (Спортивный профиль пользователя)
*   *Один пользователь может иметь несколько профилей (Теннис, Бокс)*
*   `userId`: FK
*   `sportType`: Enum (TENNIS, BOXING, etc.)
*   `level`: Enum (AMATEUR, PRO)
*   `eloRating`: Int (Default: 1000)
*   `skills`: JSON (Tags: "Spin", "Attack")
*   `achievements`: JSON (Images of certificates)
*   `availability`: JSON (Schedule: Mon-Sun slots)

### Game / Match (Игра)
*   `id`: UUID
*   `type`: Enum (CASUAL_SWIPE, RANKED_CHALLENGE)
*   `status`: Enum (PENDING, SCHEDULED, PLAYED, DISPUTED, CANCELLED)
*   `player1Id`: FK
*   `player2Id`: FK
*   `winnerId`: FK (Nullable)
*   `contractData`: JSON (Date, Time, VenueID, ReminderSettings)
*   `scorePlayer1`: String
*   `scorePlayer2`: String

### Swipe (Свайпы)
*   `actorId`: FK
*   `targetId`: FK
*   `action`: Enum (LIKE, DISLIKE)
*   `isMatch`: Boolean

### Dispute (Спор/Суд)
*   `gameId`: FK
*   `plaintiffId`: FK (Истец)
*   `defendantId`: FK (Ответчик)
*   `evidenceVideoUrl`: String
*   `description`: String
*   `status`: Enum (VOTING, RESOLVED)
*   `winningSide`: Enum (PLAYER1, PLAYER2, NULL)

### JuryVote (Голос присяжного)
*   `disputeId`: FK
*   `jurorId`: FK (Судья)
*   `voteFor`: Enum (PLAYER1, PLAYER2, DRAW)

---

## 3. User Flow и Клиентская логика

### A. Auth & Onboarding
1.  **Вход:** Ввод телефона -> SMS код.
2.  **Анкета:** Заполнение имени, выбор спорта, заполнение навыков (теги) или загрузка сертификатов.

### B. Matching (Tab 1)
1.  **Лента:** Пользователь видит карточки других игроков.
2.  **Фильтры:** Гео (радиус), Время (пересечение слотов), Уровень.
3.  **Действие:** Свайп влево/вправо. Если Mutual Like -> Создается чат.

### C. Arena / Ranking (Tab 2)
1.  **Лидерборд:** Список игроков рядом с похожим ELO.
2.  **Вызов:** Кнопка "Challenge". Создается Game со статусом `PENDING`.

### D. Chat & Contract (Tab 3)
1.  **Чат:** Обычный мессенджер.
2.  **Контракт:** Форма внутри чата (Время, Место). Оба должны нажать "Confirm". Статус Game -> `SCHEDULED`.
3.  **Результат:** После времени игры появляется кнопка "Внести результат".

### E. Dispute (Суд)
1.  Если результаты не совпали -> Создание Dispute.
2.  Независимые юзеры (Jury) получают уведомление, смотрят видео, голосуют.

---

## 4. API Endpoints (Draft)

Все защищенные методы требуют Header: `Authorization: Bearer <token>`

### 🔐 Authentication Module

*   `POST /auth/login`
    *   Body: `{ phone: string }`
    *   Response: `{ status: "sms_sent" }`
*   `POST /auth/verify`
    *   Body: `{ phone: string, code: string }`
    *   Response: `{ accessToken: string, user: UserDTO, isNewUser: boolean }`

### 👤 User & Profile Module

*   `GET /users/me` — Получить свой профиль.
*   `POST /users/onboarding` — Создать SportProfile (навыки, расписание).
    *   Body: `{ sportType: "TENNIS", level: "AMATEUR", skills: [...], schedule: {...} }`
*   `PUT /users/me/location` — Обновить координаты (для поиска).
    *   Body: `{ lat: number, lng: number }`

### ❤️ Matchmaking Module (Swipe System)

*   `GET /matchmaking/feed?sport=TENNIS`
    *   Logic: Возвращает список юзеров, которые:
        1.  В радиусе X км.
        2.  Имеют пересечение по расписанию (хотя бы 1 слот).
        3.  Еще не были свайпнуты.
    *   Response: `[ { id, name, rating, tags, ... } ]`
*   `POST /matchmaking/swipe`
    *   Body: `{ targetId: string, action: "LIKE" | "DISLIKE" }`
    *   Logic: Если action LIKE и есть обратный лайк -> Создать Chat, вернуть `isMatch: true`.

### 🏆 Arena Module (Ranking)

*   `GET /arena/leaderboard?sport=TENNIS`
    *   Logic: Пагинация. Сортировка по ELO. Фильтр range +/- 200 очков.
*   `POST /arena/challenge`
    *   Body: `{ targetId: string }`
    *   Logic: Создает игру с типом `RANKED_CHALLENGE`, статус `PENDING`. Отправляет Push.

### 🎮 Game & Contract Module

*   `POST /games/:gameId/contract` — Предложить условия (время/место).
    *   Body: `{ date: ISOString, venueId: string, reminder: boolean }`
*   `POST /games/:gameId/accept` — Второй игрок принимает условия.
    *   Logic: Статус меняется на `SCHEDULED`.
*   `POST /games/:gameId/result` — Внести счет.
    *   Body: `{ myScore: 3, opponentScore: 1 }`
    *   Logic:
        *   Если второй игрок уже внес и счета совпадают -> Финиш. Расчет ELO.
        *   Если не совпадают -> Статус `CONFLICT`.

### ⚖️ Dispute Module (Суд)

*   `POST /disputes` — Создать спор (если статус игры CONFLICT).
    *   Body: `{ gameId: string, evidenceUrl: string, comment: string }`
*   `GET /disputes/jury-duty` — Получить список споров для голосования (для судей).
    *   Logic: Возвращает споры, где юзер не является участником и имеет высокую карму.
*   `POST /disputes/:id/vote` — Проголосовать.
    *   Body: `{ winner: "PLAYER1" | "PLAYER2" | "DRAW" }`
    *   Logic: Если набрано 3/5 голосов -> Закрыть спор, обновить рейтинги, начислить карму судье.

### 📍 Venues Module

*   `GET /venues` — Поиск площадок.
    *   Query: `?lat=...&lng=...`

---

## 5. Важные алгоритмы (Business Logic Notes)

1.  **ELO Rating Calculation:**
    *   Использовать стандартную формулу ELO.
    *   **K-factor:**
        *   Первые 5 игр: K = 40 (Калибровка).
        *   Обычная игра: K = 20.
        *   Ranked Challenge (рискованная): K = 30.
    *   При победе в споре (Dispute): Проигравший получает двойной вычет очков (как штраф).

2.  **Scheduling Logic:**
    *   Расписание хранится как битовая маска или массив слотов (например, `Monday_Morning`, `Monday_Evening`).
    *   Мэтчинг проверяет пересечение массивов: `UserA.slots & UserB.slots`.

3.  **Reliability Score:**
    *   Старт: 100%.
    *   Отмена игры за < 24 часа: -10%.
    *   Неявка (No-show): -30%.
    *   Успешная игра: +2%.