import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn,
    CreateDateColumn,
    Index,
} from 'typeorm';
import { User } from './user.entity';
import { SwipeAction } from './enums';

@Entity('swipes')
@Index(['actorId', 'targetId'], { unique: true })
export class Swipe {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column('uuid')
    actorId: string;

    @Column('uuid')
    targetId: string;

    @Column({
        type: 'enum',
        enum: SwipeAction,
    })
    action: SwipeAction;

    @Column({ type: 'boolean', default: false })
    isMatch: boolean;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @ManyToOne(() => User, (user) => user.swipesActor)
    @JoinColumn({ name: 'actorId' })
    actor: User;

    @ManyToOne(() => User, (user) => user.swipesTarget)
    @JoinColumn({ name: 'targetId' })
    target: User;
}
