import {
  Controller,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { FindingsService } from './findings.service.js';

@Controller('scan-findings')
export class FindingsController {
  constructor(private readonly findingsService: FindingsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  async findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('severity') severity?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('assetId') assetId?: string,
    @Query('scanId') scanId?: string,
  ) {
    const orgId: string = req.orgContext!.orgId;
    return this.findingsService.findAll(orgId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      severity,
      search,
      category,
      assetId,
      scanId,
    });
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: any,
  ) {
    const orgId: string = req.orgContext!.orgId;
    await this.findingsService.deleteOne(id, orgId);
  }

  @Delete()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteMany(
    @Body() body: { ids: string[] },
    @Req() req: any,
  ) {
    const orgId: string = req.orgContext!.orgId;
    await this.findingsService.deleteMany(body.ids, orgId);
  }
}
