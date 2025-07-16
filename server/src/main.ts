import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { DataAnalysisService } from './data-analysis.service';
import { AuditService } from './audit.service';

/**
 * Main application module
 * Configures the NestJS application with all controllers and services
 */
@Module({
    controllers: [AppController],
    providers: [OpenAiService, MetricsService, DataAnalysisService, AuditService]
})
class AppModule { }
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: true
    });

    console.log('🚀 Chat-to-Chart server starting...');
    console.log('📁 Using metrics.json file in the server root directory');
    console.log('🤖 Using OpenAI GPT-4 for chart generation');

    await app.listen(4000);
    console.log('✅ Server is running on http://localhost:4000');
}

bootstrap(); 