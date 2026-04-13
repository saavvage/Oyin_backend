import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from './enums';
import { SportProfile } from './sport-profile.entity';
import { Game } from './game.entity';
import { Swipe } from './swipe.entity';
import { Dispute } from './dispute.entity';
import { JuryVote } from './jury-vote.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ type: 'boolean', default: false })
  phoneVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'int', default: 0 })
  karma: number;

  @Column({ type: 'int', default: 0 })
  balance: number;

  @Column({ type: 'date', nullable: true })
  lastDailyRewardAt: Date | null;

  @Column({ type: 'int', default: 0 })
  dailyRewardStreak: number;

  @Column({ type: 'float', default: 100.0 })
  reliabilityScore: number;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({ type: 'float', nullable: true })
  latitude: number | null;

  @Column({ type: 'float', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', nullable: true, length: 1024 })
  fcmToken: string | null;

  @Column({ type: 'varchar', nullable: true, length: 16 })
  pushPlatform: string | null;

  @Column({ type: 'boolean', default: false })
  pushNotificationsEnabled: boolean;

  @Column({ type: 'int', default: 60 })
  pushReminderIntervalMinutes: number;

  @Column({ type: 'timestamp', nullable: true })
  pushTokenUpdatedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  pushReminderLastSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => SportProfile, (profile) => profile.user)
  sportProfiles: SportProfile[];

  @OneToMany(() => Game, (game) => game.player1)
  gamesAsPlayer1: Game[];

  @OneToMany(() => Game, (game) => game.player2)
  gamesAsPlayer2: Game[];

  @OneToMany(() => Swipe, (swipe) => swipe.actor)
  swipesActor: Swipe[];

  @OneToMany(() => Swipe, (swipe) => swipe.target)
  swipesTarget: Swipe[];

  @OneToMany(() => Dispute, (dispute) => dispute.plaintiff)
  disputesAsPlaintiff: Dispute[];

  @OneToMany(() => Dispute, (dispute) => dispute.defendant)
  disputesAsDefendant: Dispute[];

  @OneToMany(() => JuryVote, (vote) => vote.juror)
  juryVotes: JuryVote[];
}
