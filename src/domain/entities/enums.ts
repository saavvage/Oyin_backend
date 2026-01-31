export enum UserRole {
    USER = 'USER',
    ADMIN = 'ADMIN',
}

export enum SportType {
    TENNIS = 'TENNIS',
    BOXING = 'BOXING',
    BASKETBALL = 'BASKETBALL',
    FOOTBALL = 'FOOTBALL',
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
