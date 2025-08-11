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
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

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

    // Enable URI-based API versioning: /v1/*
    app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
    });

    // Swagger/OpenAPI setup
    const config = new DocumentBuilder()
        .setTitle('Iris Chat-to-Chart API')
        .setDescription('Natural language to chart spec and data API')
        .setVersion('1.0.0')
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    await app.listen(4000);
    console.log('✅ Server is running on http://localhost:4000');
    console.log('📘 API Docs available at http://localhost:4000/docs');
}

bootstrap(); 