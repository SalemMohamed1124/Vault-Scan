import { ConfigModule, ConfigService } from '@nestjs/config';
import { SharedBullAsyncConfiguration } from '@nestjs/bull';

export const redisConfig: SharedBullAsyncConfiguration = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    redis: {
      host: configService.get<string>('REDIS_HOST', 'localhost'),
      port: configService.get<number>('REDIS_PORT', 6379),
    },
  }),
};
