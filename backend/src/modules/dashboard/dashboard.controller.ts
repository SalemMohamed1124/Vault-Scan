import { Controller, Get, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  async getStats(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getStats(orgId);
  }

  @Get('vulnerabilities-by-severity')
  async getVulnerabilitiesBySeverity(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getVulnerabilitiesBySeverity(orgId);
  }

  @Get('vulnerability-trends')
  async getVulnerabilityTrends(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getVulnerabilityTrends(orgId);
  }

  @Get('scan-activity')
  async getScanActivity(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getScanActivity(orgId);
  }

  @Get('recent-activity')
  async getRecentActivity(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getRecentActivity(orgId);
  }

  @Get('top-vulnerabilities')
  async getTopVulnerabilities(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getTopVulnerabilities(orgId);
  }

  @Get('security-score')
  async getSecurityScore(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.dashboardService.getSecurityScore(orgId);
  }
}
