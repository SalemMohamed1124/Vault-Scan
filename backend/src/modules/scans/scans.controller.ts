import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ScansService } from './scans.service.js';
import { CreateScanDto } from './dto/create-scan.dto.js';
import { BulkCreateScanDto } from './dto/bulk-create-scan.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole, ScanStatus, ScanType } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
}

@Controller('scans')
@UseGuards(RolesGuard)
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async listScans(
    @Req() req: RequestWithOrgContext,
    @Query('status') status?: ScanStatus,
    @Query('type') type?: ScanType,
    @Query('assetId') assetId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.listScans(orgId, {
      status,
      type,
      assetId,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  async createScan(
    @Req() req: RequestWithOrgContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateScanDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.createScan(orgId, user.userId, dto);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  async bulkCreateScans(
    @Req() req: RequestWithOrgContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkCreateScanDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.bulkCreateScans(orgId, user.userId, dto);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getScan(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.getScan(id, orgId);
  }

  @Delete(':id/cancel')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  async cancelScan(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.cancelScan(id, orgId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteScan(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    await this.scansService.deleteScan(id, orgId);
  }

  @Get(':id/findings')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getFindings(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.getFindings(id, orgId);
  }

  @Get(':id/raw-output')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getRawOutput(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.scansService.getRawOutput(id, orgId);
  }
}
