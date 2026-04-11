import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';

interface JwtRefreshPayload {
  sub: string;
  iat: number;
  exp: number;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: ConfigService) {
    const secret = configService.get<string>('JWT_REFRESH_SECRET');
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not defined');
    }

    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtRefreshPayload): { userId: string; refreshToken: string } {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const body = req.body as { refreshToken?: string };
    const refreshToken = body?.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not provided');
    }

    return { userId: payload.sub, refreshToken };
  }
}
