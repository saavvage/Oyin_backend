import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { SportType, SkillLevel } from './enums';

@Entity('sport_profiles')
export class SportProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    userId: string;

    @Column({
        type: 'enum',
        enum: SportType,
    })
    sportType: SportType;

    @Column({
        type: 'enum',
        enum: SkillLevel,
    })
    level: SkillLevel;

    @Column({ type: 'int', default: 1000 })
    eloRating: number;

    @Column({ type: 'int', default: 0 })
    gamesPlayed: number;

    @Column({ type: 'jsonb', nullable: true })
    skills: string[]; // Array of skill tags

    @Column({ type: 'jsonb', nullable: true })
    achievements: any[]; // Array of achievement objects/images

    @Column({ type: 'jsonb', nullable: true })
    availability: Record<string, any>; // Schedule object

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, (user) => user.sportProfiles)
    @JoinColumn({ name: 'userId' })
    user: User;
}
