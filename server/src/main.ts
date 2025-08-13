import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { OpenAiService } from './openai.service';
import { MetricsService } from './data/metrics.service';
import { DataAnalysisService } from './data/data-analysis.service';
import { AuditService } from './audit/audit.service';
import { DashboardService } from './dashboard.service';
import { IrisApiService } from './api/iris-api.service';
import { ReasoningService } from './reasoning.service';
import { IntentAnalyzerService } from './reasoning/intent-analyzer.service';
import { ChartRankerService } from './reasoning/chart-ranker.service';
import { ErrorHandlerService } from './common/error-handler.service';
import { ChartDataSlicerService } from './data/chart-data-slicer.service';
import { EcommerceSemanticService } from './semantic/ecommerce-semantic.service';
import { MetricDefinitionRegistry } from './semantic/metric-definition.registry';
import { BusinessContextService } from './semantic/business-context.service';
import { VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

@Module({
    imports: [HttpModule],
    controllers: [AppController],
    providers: [
        OpenAiService,
        MetricsService,
        DataAnalysisService,
        AuditService,
        DashboardService,
        IrisApiService,
        ReasoningService,
        IntentAnalyzerService,
        ChartRankerService,
        ErrorHandlerService,
        ChartDataSlicerService,
        // Semantic layer services
        EcommerceSemanticService,
        MetricDefinitionRegistry,
        BusinessContextService
    ]
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