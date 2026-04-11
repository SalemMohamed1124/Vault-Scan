import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Organization } from './organization.entity.js';
import { OrganizationMember } from './organization-member.entity.js';
import { User } from '../users/user.entity.js';
import { UserRole } from '../../common/enums/index.js';
import { CreateOrgDto } from './dto/create-org.dto.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';

const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  [UserRole.ADMIN]: ['READ', 'WRITE', 'DELETE', 'MANAGE_USERS', 'MANAGE_SCANS'],
  [UserRole.EDITOR]: ['READ', 'WRITE', 'MANAGE_SCANS'],
  [UserRole.VIEWER]: ['READ'],
};

export interface OrgWithRole {
  id: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface MemberInfo {
  id: string;
  role: UserRole;
  joinedAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface SwitchOrgResponse {
  organization: {
    id: string;
    name: string;
  };
  role: UserRole;
  permissions: string[];
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async createOrganization(userId: string, dto: CreateOrgDto): Promise<Organization> {
    const org = this.orgRepo.create({ name: dto.name });
    const savedOrg = await this.orgRepo.save(org);

    const member = this.memberRepo.create({
      userId,
      orgId: savedOrg.id,
      role: UserRole.ADMIN,
    });
    await this.memberRepo.save(member);

    return savedOrg;
  }

  async getUserOrganizations(userId: string): Promise<OrgWithRole[]> {
    const members = await this.memberRepo.find({
      where: { userId },
      relations: ['organization'],
      order: { joinedAt: 'ASC' },
    });

    return members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      createdAt: m.organization.createdAt,
    }));
  }

  async switchOrganization(userId: string, orgId: string): Promise<SwitchOrgResponse> {
    const member = await this.memberRepo.findOne({
      where: { userId, orgId },
      relations: ['organization'],
    });

    if (!member) {
      throw new ForbiddenException('You are not a member of this organization');
    }

    return {
      organization: {
        id: member.organization.id,
        name: member.organization.name,
      },
      role: member.role,
      permissions: ROLE_PERMISSIONS[member.role],
    };
  }

  async updateOrganization(orgId: string, name: string): Promise<Organization> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    org.name = name;
    return this.orgRepo.save(org);
  }

  async deleteOrganization(orgId: string, userId: string): Promise<void> {
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Verify user is admin
    const member = await this.memberRepo.findOne({
      where: { userId, orgId, role: UserRole.ADMIN },
    });
    if (!member) {
      throw new ForbiddenException('Only admins can delete organizations');
    }

    // CASCADE will clean up members, assets, scans, etc.
    await this.orgRepo.remove(org);
  }

  async getMembers(orgId: string): Promise<MemberInfo[]> {
    const members = await this.memberRepo.find({
      where: { orgId },
      relations: ['user'],
      order: { joinedAt: 'ASC' },
    });

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
      },
    }));
  }

  async addMember(orgId: string, dto: AddMemberDto): Promise<MemberInfo> {
    // Check if org exists
    const org = await this.orgRepo.findOne({ where: { id: orgId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // Find or create user
    let user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user) {
      // Create stub user with temp password
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      const nameFromEmail = dto.email.split('@')[0] ?? dto.email;

      user = this.userRepo.create({
        name: nameFromEmail,
        email: dto.email,
        passwordHash,
      });
      user = await this.userRepo.save(user);
    }

    // Check if already a member
    const existingMember = await this.memberRepo.findOne({
      where: { userId: user.id, orgId },
    });

    if (existingMember) {
      throw new ConflictException('User is already a member of this organization');
    }

    const member = this.memberRepo.create({
      userId: user.id,
      orgId,
      role: dto.role,
    });
    const savedMember = await this.memberRepo.save(member);

    return {
      id: savedMember.id,
      role: savedMember.role,
      joinedAt: savedMember.joinedAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async updateMemberRole(
    orgId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ): Promise<MemberInfo> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, orgId },
      relations: ['user'],
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Cannot demote the last admin
    if (member.role === UserRole.ADMIN && dto.role !== UserRole.ADMIN) {
      const adminCount = await this.memberRepo.count({
        where: { orgId, role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot demote the last admin of the organization');
      }
    }

    member.role = dto.role;
    const updatedMember = await this.memberRepo.save(member);

    return {
      id: updatedMember.id,
      role: updatedMember.role,
      joinedAt: updatedMember.joinedAt,
      user: {
        id: member.user.id,
        name: member.user.name,
        email: member.user.email,
      },
    };
  }

  async removeMember(orgId: string, memberId: string): Promise<{ success: boolean }> {
    const member = await this.memberRepo.findOne({
      where: { id: memberId, orgId },
    });

    if (!member) {
      throw new NotFoundException('Member not found in this organization');
    }

    // Cannot remove the last admin
    if (member.role === UserRole.ADMIN) {
      const adminCount = await this.memberRepo.count({
        where: { orgId, role: UserRole.ADMIN },
      });

      if (adminCount <= 1) {
        throw new BadRequestException('Cannot remove the last admin of the organization');
      }
    }

    await this.memberRepo.remove(member);
    return { success: true };
  }
}
