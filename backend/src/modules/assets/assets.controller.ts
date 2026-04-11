import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssetsService } from './assets.service.js';
import { CreateAssetDto } from './dto/create-asset.dto.js';
import { UpdateAssetDto } from './dto/update-asset.dto.js';
import { BulkCreateAssetDto } from './dto/bulk-create-asset.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole, AssetType } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
}

@Controller('assets')
@UseGuards(RolesGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Req() req: RequestWithOrgContext,
    @Query('search') search?: string,
    @Query('type') type?: AssetType,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.findAll(orgId, {
      search,
      type,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async getStats(@Req() req: RequestWithOrgContext) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.getAssetStats(orgId);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.findOne(id, orgId);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: RequestWithOrgContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateAssetDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.create(orgId, user.userId, dto);
  }

  @Post('bulk')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.CREATED)
  async bulkCreate(
    @Req() req: RequestWithOrgContext,
    @CurrentUser() user: JwtUser,
    @Body() dto: BulkCreateAssetDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.bulkCreate(orgId, user.userId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
    @Body() dto: UpdateAssetDto,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.update(id, orgId, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.assetsService.remove(id, orgId);
  }
}
