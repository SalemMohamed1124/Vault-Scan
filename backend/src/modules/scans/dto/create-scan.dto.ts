import { IsUUID, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ScanType } from '../../../common/enums/index.js';

export class CreateScanDto {
  @IsUUID()
  assetId!: string;

  @IsEnum(ScanType)
  type!: ScanType;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  cookies?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customHeaders?: string;
}
