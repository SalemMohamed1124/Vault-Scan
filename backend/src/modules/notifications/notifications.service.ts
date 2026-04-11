import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async findAll(userId: string, limit = 20): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async markAsRead(id: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: string): Promise<{ success: boolean }> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { success: true };
  }
}
