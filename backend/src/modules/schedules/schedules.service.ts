import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScanSchedule } from './scan-schedule.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { ScanFrequency, ScanType } from '../../common/enums/index.js';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(ScanSchedule)
    private readonly scheduleRepo: Repository<ScanSchedule>,
    @InjectRepository(Asset)
    private readonly assetRepo: Repository<Asset>,
  ) {}

  async findAll(orgId: string): Promise<ScanSchedule[]> {
    return this.scheduleRepo.find({
      where: { orgId },
      relations: ['asset'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(
    orgId: string,
    userId: string,
    dto: { assetId: string; frequency: ScanFrequency; scanType?: string; scheduledTime?: string },
  ): Promise<ScanSchedule> {
    // Verify asset belongs to org
    const asset = await this.assetRepo.findOne({
      where: { id: dto.assetId, orgId },
    });

    if (!asset) {
      throw new NotFoundException('Asset not found in this organization');
    }

    const nextRunAt = this.calculateNextRun(dto.frequency);

    // Default to QUICK if not provided or invalid
    const validScanType = dto.scanType === 'DEEP' ? ScanType.DEEP : ScanType.QUICK;

    const schedule = this.scheduleRepo.create({
      assetId: dto.assetId,
      orgId,
      createdBy: userId,
      frequency: dto.frequency,
      scanType: validScanType,
      timeOfDay: dto.scheduledTime || '02:00',
      nextRunAt,
      isActive: true,
    });

    return this.scheduleRepo.save(schedule);
  }

  async update(
    id: string,
    orgId: string,
    dto: { isActive?: boolean; frequency?: ScanFrequency },
  ): Promise<ScanSchedule> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, orgId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (dto.isActive !== undefined) {
      schedule.isActive = dto.isActive;
    }

    if (dto.frequency) {
      schedule.frequency = dto.frequency;
      schedule.nextRunAt = this.calculateNextRun(dto.frequency);
    }

    return this.scheduleRepo.save(schedule);
  }

  async remove(id: string, orgId: string): Promise<{ success: boolean }> {
    const schedule = await this.scheduleRepo.findOne({
      where: { id, orgId },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    await this.scheduleRepo.remove(schedule);
    return { success: true };
  }

  private calculateNextRun(frequency: ScanFrequency): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(2, 0, 0, 0); // Default 2 AM

    switch (frequency) {
      case ScanFrequency.DAILY:
        if (now.getHours() >= 2) {
          next.setDate(next.getDate() + 1);
        }
        break;
      case ScanFrequency.WEEKLY:
        next.setDate(next.getDate() + (7 - now.getDay() + 1) % 7 || 7);
        break;
      case ScanFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1, 1);
        break;
    }

    return next;
  }
}
