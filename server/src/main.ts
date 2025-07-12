// Load environment variables from .env file FIRST
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

/**
 * Bootstrap function to start the NestJS application
 * Configures CORS and starts the server on port 4000
 */
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: true // Enable CORS for frontend communication
    });

    console.log('🚀 Chat-to-Chart server starting...');
    console.log('📁 Using metrics.json file in the server root directory');

    if (process.env.OPENAI_API_KEY) {
        console.log('🤖 OpenAI API key found - using GPT-4 for chart generation');
    } else {
        console.log('🎭 OpenAI API key not found - using mock data for testing');
        console.log('💡 Set OPENAI_API_KEY environment variable to use real AI');
    }

    await app.listen(4000);
    console.log('✅ Server is running on http://localhost:4000');
}

bootstrap(); 