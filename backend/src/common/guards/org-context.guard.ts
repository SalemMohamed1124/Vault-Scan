import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationMember } from '../../modules/organizations/organization-member.entity.js';
import { UserRole } from '../enums/index.js';

export interface OrgContext {
  orgId: string;
  role: UserRole;
}

interface RequestWithUser {
  user?: { userId: string; email: string };
  orgContext?: OrgContext;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | undefined>;
}

@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest() as RequestWithUser;

    // Skip if no authenticated user (public routes)
    if (!request.user) {
      return true;
    }

    const orgId =
      (request.headers['x-org-id'] as string) ||
      (request.query['orgId'] as string);

    if (orgId) {
      const member = await this.memberRepo.findOne({
        where: {
          userId: request.user.userId,
          orgId: orgId,
        },
      });

      if (!member) {
        throw new ForbiddenException('You are not a member of this organization');
      }

      request.orgContext = { orgId: member.orgId, role: member.role };
    } else {
      // Auto-select first org if none specified
      const firstMember = await this.memberRepo.findOne({
        where: { userId: request.user.userId },
        order: { joinedAt: 'ASC' },
      });

      if (firstMember) {
        request.orgContext = { orgId: firstMember.orgId, role: firstMember.role };
      }
    }

    return true;
  }
}
