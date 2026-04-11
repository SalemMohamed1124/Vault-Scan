import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationMember } from './organization-member.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { Scan } from '../scans/scan.entity.js';

@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => OrganizationMember, (member) => member.organization)
  members!: OrganizationMember[];

  @OneToMany(() => Asset, (asset) => asset.organization)
  assets!: Asset[];

  @OneToMany(() => Scan, (scan) => scan.organization)
  scans!: Scan[];
}
