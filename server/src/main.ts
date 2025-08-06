import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { DataAnalysisService } from './data-analysis.service';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';
import { IrisApiService } from './iris-api.service';
import { ReasoningService } from './reasoning.service';

@Module({
    imports: [HttpModule],
    controllers: [AppController],
    providers: [OpenAiService, MetricsService, DataAnalysisService, AuditService, DashboardService, IrisApiService, ReasoningService]
})
class AppModule { }
async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        cors: true
    });

    await app.listen(4000);
    console.log('✅ Server is running on http://localhost:4000');
}

bootstrap(); 