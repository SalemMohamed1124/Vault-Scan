import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModuleAsyncOptions } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export const typeOrmConfig: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres' as const,
    url: configService.get<string>('DATABASE_URL'),
    autoLoadEntities: true,
    synchronize: true,
    logging: configService.get<string>('NODE_ENV') === 'development',
    migrations: ['dist/migrations/*.js'],
  }),
};

const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  synchronize: true,
  logging: process.env.NODE_ENV === 'development',
};

export default new DataSource(dataSourceOptions);
