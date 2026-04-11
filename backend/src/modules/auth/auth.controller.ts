import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { AuthResponse } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { JwtUser } from './decorators/current-user.decorator.js';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: { userId: string; refreshToken: string },
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return this.authService.refreshTokens(user.userId);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(): { success: boolean } {
    return this.authService.logout();
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser() user: JwtUser) {
    return this.authService.getMe(user.userId);
  }

  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(
    @CurrentUser() user: JwtUser,
    @Body() body: { name: string },
  ) {
    return this.authService.updateProfile(user.userId, body.name);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(
      user.userId,
      body.currentPassword,
      body.newPassword,
    );
  }
}
