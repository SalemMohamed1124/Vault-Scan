import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIAnalysis } from './ai-analysis.entity.js';
import { Scan } from '../scans/scan.entity.js';
import { ScanFinding } from '../findings/scan-finding.entity.js';
import { Asset } from '../assets/asset.entity.js';
import { AiAnalysisService } from './ai-analysis.service.js';
import { AiAnalysisController } from './ai-analysis.controller.js';
import { AiChatController } from './ai-chat.controller.js';
import { AiChatService } from './ai-chat.service.js';
import { AiInsightsController } from './ai-insights.controller.js';
import { AiInsightsService } from './ai-insights.service.js';
import { PromptBuilderService } from './prompt-builder.service.js';
import { GEMINI_CLIENT } from '../../config/gemini.config.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([AIAnalysis, Scan, ScanFinding, Asset]),
    ConfigModule,
  ],
  controllers: [AiAnalysisController, AiChatController, AiInsightsController],
  providers: [
    AiAnalysisService,
    AiChatService,
    AiInsightsService,
    PromptBuilderService,
    {
      provide: GEMINI_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): GoogleGenerativeAI => {
        const apiKey = configService.get<string>('GEMINI_API_KEY', '');
        if (!apiKey) {
          return new GoogleGenerativeAI('placeholder-key');
        }
        return new GoogleGenerativeAI(apiKey);
      },
    },
  ],
  exports: [AiAnalysisService, AiChatService, AiInsightsService],
})
export class AiAnalysisModule {}
