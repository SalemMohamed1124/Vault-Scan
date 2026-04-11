import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AiChatService } from './ai-chat.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { UserRole } from '../../common/enums/index.js';
import type { OrgContext } from '../../common/middleware/org-context.middleware.js';

interface RequestWithOrgContext {
  orgContext?: OrgContext;
  user?: { sub: string };
}

interface ChatMessageDto {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequestDto {
  message: string;
  history?: ChatMessageDto[];
  scanId?: string;
}

@Controller('ai')
@UseGuards(RolesGuard)
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('chat')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER)
  @HttpCode(HttpStatus.OK)
  async chat(
    @Body() body: ChatRequestDto,
    @Req() req: RequestWithOrgContext,
  ) {
    const orgId = req.orgContext!.orgId;
    return this.aiChatService.chat(
      orgId,
      body.message,
      body.history ?? [],
      body.scanId,
    );
  }
}
