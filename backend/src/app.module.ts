import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD } from '@nestjs/core';
import { typeOrmConfig } from './config/typeorm.config.js';
import { redisConfig } from './config/redis.config.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { ScansModule } from './modules/scans/scans.module.js';
import { FindingsModule } from './modules/findings/findings.module.js';
import { AiAnalysisModule } from './modules/ai-analysis/ai-analysis.module.js';
import { SchedulesModule } from './modules/schedules/schedules.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ScanEngineModule } from './modules/scan-engine/scan-engine.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { OrganizationMember } from './modules/organizations/organization-member.entity.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { OrgContextGuard } from './common/guards/org-context.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync(typeOrmConfig),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync(redisConfig),
    TypeOrmModule.forFeature([OrganizationMember]),
    AuthModule,
    UsersModule,
    OrganizationsModule,
    AssetsModule,
    ScansModule,
    FindingsModule,
    AiAnalysisModule,
    SchedulesModule,
    ReportsModule,
    NotificationsModule,
    ScanEngineModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OrgContextGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
