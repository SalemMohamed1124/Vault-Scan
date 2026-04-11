import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiInsightsService } from './ai-insights.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
}

@Controller('ai')
@UseGuards(RolesGuard)
export class AiInsightsController {
  constructor(private readonly aiInsightsService: AiInsightsService) {}

  @Get('insights')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getDashboardInsights(@Req() req: RequestWithOrgContext) {
    const orgId = req.orgContext!.orgId;
    return this.aiInsightsService.getDashboardInsights(orgId);
  }

  @Post('findings/:findingId/remediation')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getRemediationGuide(
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.aiInsightsService.getRemediationGuide(findingId, orgId);
  }
}
