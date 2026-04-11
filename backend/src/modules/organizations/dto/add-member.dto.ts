import { IsEmail, IsEnum } from 'class-validator';
import { UserRole } from '../../../common/enums/index.js';

export class AddMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
