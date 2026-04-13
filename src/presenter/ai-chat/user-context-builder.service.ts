import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../domain/entities/user.entity';
import { SportProfile } from '../../domain/entities/sport-profile.entity';
import { Game } from '../../domain/entities/game.entity';
import { Swipe } from '../../domain/entities/swipe.entity';
import { GameStatus, SwipeAction } from '../../domain/entities/enums';

const RECENT_GAMES_LIMIT = 5;
const LIKED_PLAYERS_LIMIT = 10;

type RecentGame = {
  sport: string | null;
  result: 'win' | 'loss' | 'draw';
  opponent: string | null;
  date: string | null;
  score: string | null;
};

export type AiUserContext = {
  preferred_sports: string[];
  skill_levels: Record<string, string>;
  elo_by_sport: Record<string, number>;
  tags: string[];
  matches_played: number;
  recent_games: RecentGame[];
  liked_player_ids: string[];
  reliability_score: number;
};

@Injectable()
export class UserContextBuilderService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    @InjectRepository(SportProfile)
    private readonly sportProfiles: Repository<SportProfile>,
    @InjectRepository(Game)
    private readonly games: Repository<Game>,
    @InjectRepository(Swipe)
    private readonly swipes: Repository<Swipe>,
  ) {}

  async build(userId: string): Promise<AiUserContext | null> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) return null;

    const [profiles, recentGames, likedSwipes] = await Promise.all([
      this.sportProfiles.find({ where: { userId } }),
      this.loadRecentGames(userId),
      this.swipes.find({
        where: { actorId: userId, action: SwipeAction.LIKE },
        order: { createdAt: 'DESC' },
        take: LIKED_PLAYERS_LIMIT,
      }),
    ]);

    const preferred_sports = profiles.map((p) => p.sportType);
    const skill_levels: Record<string, string> = {};
    const elo_by_sport: Record<string, number> = {};
    const tagSet = new Set<string>();
    let matches_played = 0;

    for (const p of profiles) {
      skill_levels[p.sportType] = p.level;
      elo_by_sport[p.sportType] = p.eloRating;
      matches_played += p.gamesPlayed ?? 0;
      if (Array.isArray(p.skills)) {
        for (const tag of p.skills) {
          if (tag) tagSet.add(tag);
        }
      }
    }

    return {
      preferred_sports,
      skill_levels,
      elo_by_sport,
      tags: Array.from(tagSet),
      matches_played,
      recent_games: recentGames,
      liked_player_ids: likedSwipes.map((s) => s.targetId),
      reliability_score: user.reliabilityScore,
    };
  }

  private async loadRecentGames(userId: string): Promise<RecentGame[]> {
    const rows = await this.games.find({
      where: [
        { player1Id: userId, status: GameStatus.PLAYED },
        { player2Id: userId, status: GameStatus.PLAYED },
      ],
      order: { updatedAt: 'DESC' },
      take: RECENT_GAMES_LIMIT,
    });

    return rows.map((g) => {
      const isPlayer1 = g.player1Id === userId;
      const opponent = isPlayer1 ? g.player2Id : g.player1Id;
      let result: 'win' | 'loss' | 'draw';
      if (!g.winnerId) {
        result = 'draw';
      } else if (g.winnerId === userId) {
        result = 'win';
      } else {
        result = 'loss';
      }
      const score =
        g.scorePlayer1 && g.scorePlayer2
          ? `${g.scorePlayer1}-${g.scorePlayer2}`
          : null;
      return {
        sport: g.type,
        result,
        opponent,
        date: g.updatedAt ? g.updatedAt.toISOString().slice(0, 10) : null,
        score,
      };
    });
  }
}
