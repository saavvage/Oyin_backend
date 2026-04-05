export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum SportType {
  TENNIS = 'TENNIS',
  BOXING = 'BOXING',
  BASKETBALL = 'BASKETBALL',
  FOOTBALL = 'FOOTBALL',
  SWIMMING = 'SWIMMING',
  RUNNING = 'RUNNING',
  MUAY_THAI = 'MUAY_THAI',
  BJJ = 'BJJ',
  PADEL = 'PADEL',
  WRESTLING = 'WRESTLING',
  MMA = 'MMA',
  KICKBOXING = 'KICKBOXING',
  VOLLEYBALL = 'VOLLEYBALL',
  TABLE_TENNIS = 'TABLE_TENNIS',
}

export enum SkillLevel {
  AMATEUR = 'AMATEUR',
  SEMI_PRO = 'SEMI_PRO',
  PRO = 'PRO',
}

export enum GameType {
  CASUAL_SWIPE = 'CASUAL_SWIPE',
  RANKED_CHALLENGE = 'RANKED_CHALLENGE',
}

export enum GameStatus {
  PENDING = 'PENDING',
  SCHEDULED = 'SCHEDULED',
  PLAYED = 'PLAYED',
  DISPUTED = 'DISPUTED',
  CANCELLED = 'CANCELLED',
  CONFLICT = 'CONFLICT',
}

export enum SwipeAction {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

export enum DisputeStatus {
  VOTING = 'VOTING',
  RESOLVED = 'RESOLVED',
}

export enum VoteChoice {
  PLAYER1 = 'PLAYER1',
  PLAYER2 = 'PLAYER2',
  DRAW = 'DRAW',
}

export enum DisputeEvidenceType {
  VIDEO = 'VIDEO',
  IMAGE = 'IMAGE',
}

export enum TransactionType {
  DAILY_REWARD = 'DAILY_REWARD',
  TRANSFER_IN = 'TRANSFER_IN',
  TRANSFER_OUT = 'TRANSFER_OUT',
  PURCHASE = 'PURCHASE',
  KARMA_BONUS = 'KARMA_BONUS',
  GAME_WIN = 'GAME_WIN',
  GAME_LOSS = 'GAME_LOSS',
  GAME_DRAW = 'GAME_DRAW',
}
