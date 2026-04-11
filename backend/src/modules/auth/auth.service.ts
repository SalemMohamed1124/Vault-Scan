import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity.js';
import { Organization } from '../organizations/organization.entity.js';
import { OrganizationMember } from '../organizations/organization-member.entity.js';
import { UserRole } from '../../common/enums/index.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface SanitizedUser {
  id: string;
  name: string;
  email: string;
}

export interface OrgWithRole {
  id: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: SanitizedUser;
  organizations: OrgWithRole[];
}

@Injectable()
export class AuthService {
  private readonly jwtRefreshSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(OrganizationMember)
    private readonly memberRepo: Repository<OrganizationMember>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }
    this.jwtRefreshSecret = refreshSecret;
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    const savedUser = await this.userRepo.save(user);

    const org = this.orgRepo.create({
      name: `${dto.name}'s Workspace`,
    });
    const savedOrg = await this.orgRepo.save(org);

    const member = this.memberRepo.create({
      userId: savedUser.id,
      orgId: savedOrg.id,
      role: UserRole.ADMIN,
    });
    await this.memberRepo.save(member);

    const tokens = this.generateTokens(savedUser);
    const organizations: OrgWithRole[] = [
      { id: savedOrg.id, name: savedOrg.name, role: UserRole.ADMIN, createdAt: savedOrg.createdAt },
    ];

    return {
      ...tokens,
      user: this.sanitizeUser(savedUser),
      organizations,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const members = await this.memberRepo.find({
      where: { userId: user.id },
      relations: ['organization'],
    });

    const organizations: OrgWithRole[] = members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      createdAt: m.organization.createdAt,
    }));

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
      organizations,
    };
  }

  async refreshTokens(userId: string): Promise<TokenPair> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return this.generateTokens(user);
  }

  logout(): { success: boolean } {
    return { success: true };
  }

  async getMe(userId: string): Promise<{ user: SanitizedUser; organizations: OrgWithRole[] }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const members = await this.memberRepo.find({
      where: { userId: user.id },
      relations: ['organization'],
    });

    const organizations: OrgWithRole[] = members.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      role: m.role,
      createdAt: m.organization.createdAt,
    }));

    return {
      user: this.sanitizeUser(user),
      organizations,
    };
  }

  async updateProfile(userId: string, name: string): Promise<SanitizedUser> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    user.name = name;
    const saved = await this.userRepo.save(user);
    return this.sanitizeUser(saved);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ success: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await this.userRepo.save(user);

    return { success: true };
  }

  private generateTokens(user: User): TokenPair {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        secret: this.jwtRefreshSecret,
        expiresIn: '7d',
      },
    );

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: User): SanitizedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }
}
