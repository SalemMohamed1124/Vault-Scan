import { Controller, Get, Post, Patch, Delete, Param, Body, Req } from '@nestjs/common';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UserRole } from '../../common/enums/index.js';
import { SchedulesService } from './schedules.service.js';

@Controller('scan-schedules')
@Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  async findAll(@Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    const data = await this.schedulesService.findAll(orgId);
    return { data };
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  async create(@Req() req: any, @Body() dto: { assetId: string; frequency: string; scanType?: string }) {
    const orgId: string = req.orgContext!.orgId;
    const userId: string = req.user.userId;
    return this.schedulesService.create(orgId, userId, dto as any);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  async update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: { isActive?: boolean; frequency?: string },
  ) {
    const orgId: string = req.orgContext!.orgId;
    return this.schedulesService.update(id, orgId, dto as any);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  async remove(@Param('id') id: string, @Req() req: any) {
    const orgId: string = req.orgContext!.orgId;
    return this.schedulesService.remove(id, orgId);
  }
}
