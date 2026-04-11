import { IsUUID, IsEnum } from 'class-validator';
import { ReportFormat } from '../../../common/enums/index.js';

export class CreateReportDto {
  @IsUUID()
  scanId!: string;

  @IsEnum(ReportFormat)
  format!: ReportFormat;
}
