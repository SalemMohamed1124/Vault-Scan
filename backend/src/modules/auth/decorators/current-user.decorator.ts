import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface JwtUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest() as { user: JwtUser };
    return request.user;
  },
);
