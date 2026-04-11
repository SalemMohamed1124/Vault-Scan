import { ConfigModule, ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface GeminiConfig {
  apiKey: string;
  model: string;
}

export const geminiConfigFactory = {
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): GeminiConfig => ({
    apiKey: configService.get<string>('GEMINI_API_KEY', ''),
    model: configService.get<string>('GEMINI_MODEL', 'gemini-2.0-flash-exp'),
  }),
};

export const GEMINI_CLIENT = 'GEMINI_CLIENT';

export const geminiClientProvider = {
  provide: GEMINI_CLIENT,
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService): GoogleGenerativeAI => {
    const apiKey = configService.get<string>('GEMINI_API_KEY', '');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    return new GoogleGenerativeAI(apiKey);
  },
};
