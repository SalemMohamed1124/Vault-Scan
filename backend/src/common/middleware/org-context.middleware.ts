import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { OrganizationMember } from '../../modules/organizations/organization-member.entity.js';
import { UserRole } from '../enums/index.js';

export interface OrgContext {
  orgId: string;
  role: UserRole;
}

interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string };
  orgContext?: OrgContext;
}

@Injectable()
export class OrgContextMiddleware implements NestMiddleware {
  constructor(
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
  ) {}

  async use(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
    // Skip if no authenticated user (JWT guard hasn't run yet for public routes)
    if (!req.user) {
      next();
      return;
    }

    const orgId = (req.headers['x-org-id'] as string) || (req.query['orgId'] as string);

    if (orgId) {
      // Verify user is member of specified org
      const member = await this.memberRepo.findOne({
        where: {
          userId: req.user.userId,
          orgId: orgId,
        },
      });

      if (!member) {
        throw new ForbiddenException('You are not a member of this organization');
      }

      req.orgContext = { orgId: member.orgId, role: member.role };
    } else {
      // Auto-select first org if none specified
      const firstMember = await this.memberRepo.findOne({
        where: { userId: req.user.userId },
        order: { joinedAt: 'ASC' },
      });

      if (firstMember) {
        req.orgContext = { orgId: firstMember.orgId, role: firstMember.role };
      }
    }

    next();
  }
}
