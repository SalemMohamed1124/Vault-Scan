import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { AssetType } from '../../../common/enums/index.js';
import { IsValidAssetValue } from '../../../common/validators/is-valid-asset-value.validator.js';

export class CreateAssetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsEnum(AssetType)
  type!: AssetType;

  @IsString()
  @MaxLength(255)
  @IsValidAssetValue()
  value!: string;
}
