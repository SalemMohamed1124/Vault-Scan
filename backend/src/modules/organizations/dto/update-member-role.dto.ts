import { IsEnum } from 'class-validator';
import { UserRole } from '../../../common/enums/index.js';

export class UpdateMemberRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
