import {
  Controller,
  Get,
  Post,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiAnalysisService } from './ai-analysis.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
}

@Controller('scans')
@UseGuards(RolesGuard)
export class AiAnalysisController {
  constructor(private readonly aiAnalysisService: AiAnalysisService) {}

  @Get(':scanId/ai-analysis')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getAnalysis(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.aiAnalysisService.getAnalysis(scanId, orgId);
  }

  @Post(':scanId/ai-analysis/retry')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  async retryAnalysis(
    @Param('scanId', ParseUUIDPipe) scanId: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.aiAnalysisService.retryAnalysis(scanId, orgId);
  }
}
