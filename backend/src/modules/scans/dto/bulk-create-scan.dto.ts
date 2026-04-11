import { IsArray, IsEnum, IsUUID, ArrayMaxSize, ArrayMinSize } from 'class-validator';
import { ScanType } from '../../../common/enums/index.js';

export class BulkCreateScanDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  assetIds!: string[];

  @IsEnum(ScanType)
  type!: ScanType;
}
