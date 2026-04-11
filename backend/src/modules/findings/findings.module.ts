import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vulnerability } from './vulnerability.entity.js';
import { ScanFinding } from './scan-finding.entity.js';
import { FindingsController } from './findings.controller.js';
import { FindingsService } from './findings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vulnerability, ScanFinding])],
  controllers: [FindingsController],
  providers: [FindingsService],
  exports: [TypeOrmModule, FindingsService],
})
export class FindingsModule {}
