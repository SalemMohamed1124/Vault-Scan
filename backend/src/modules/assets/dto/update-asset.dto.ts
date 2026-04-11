import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AssetType } from '../../../common/enums/index.js';
import { IsValidAssetValue } from '../../../common/validators/is-valid-asset-value.validator.js';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEnum(AssetType)
  type?: AssetType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @IsValidAssetValue()
  value?: string;
}
