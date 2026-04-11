import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { CreateReportDto } from './dto/create-report.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
}

@Controller('reports')
@UseGuards(RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async listReports(@Req() req: RequestWithOrgContext) {
    const orgId = req.orgContext!.orgId;
    return this.reportsService.listReports(orgId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  async generateReport(
    @Req() req: RequestWithOrgContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateReportDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.reportsService.generateReport(orgId, user.userId, dto);
  }

  @Get('download/:id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  async downloadReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
    @Res() res: Response,
  ) {
    const orgId = req.orgContext!.orgId;
    const { buffer, filename, contentType } =
      await this.reportsService.downloadReport(id, orgId);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  }
}
