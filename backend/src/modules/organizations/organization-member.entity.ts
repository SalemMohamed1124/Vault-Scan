import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { UserRole } from '../../common/enums/index.js';
import { User } from '../users/user.entity.js';
import { Organization } from './organization.entity.js';

@Entity('organization_members')
@Unique(['user', 'organization'])
export class OrganizationMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: UserRole })
  role!: UserRole;

  @CreateDateColumn({ type: 'timestamptz', name: 'joined_at' })
  joinedAt!: Date;

  @ManyToOne(() => User, (user) => user.organizationMembers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => Organization, (org) => org.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'org_id' })
  organization!: Organization;

  @Column({ name: 'org_id' })
  orgId!: string;
}
