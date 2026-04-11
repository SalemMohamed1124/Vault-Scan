import { Controller, Get, Patch, Param, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async findAll(
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const userId: string = req.user.userId;
    return this.notificationsService.findAll(userId, limit ? parseInt(limit, 10) : 20);
  }

  @Patch('read-all')
  async markAllAsRead(@Req() req: any) {
    const userId: string = req.user.userId;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: string, @Req() req: any) {
    const userId: string = req.user.userId;
    return this.notificationsService.markAsRead(id, userId);
  }
}
