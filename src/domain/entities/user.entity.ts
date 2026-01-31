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

    @Column({ nullable: true })
    email: string;

    @Column({ nullable: true })
    city: string;

    @Column({ type: 'date', nullable: true })
    birthDate: Date;

    @Column({ nullable: true })
    avatarUrl: string;

    @Column({ type: 'int', default: 0 })
    karma: number;

    @Column({ type: 'float', default: 100.0 })
    reliabilityScore: number;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.USER,
    })
    role: UserRole;

    @Column({ type: 'float', nullable: true })
    latitude: number;

    @Column({ type: 'float', nullable: true })
    longitude: number;

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
