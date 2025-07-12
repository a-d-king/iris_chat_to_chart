import { Body, Controller, Post, Get, ValidationPipe } from '@nestjs/common';
import { ChatDto } from './chat.dto';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { AuditService } from './audit.service';
import { config } from './config';

/**
 * Main application controller
 * Handles the chat endpoint that coordinates between OpenAI and metrics data
 */
@Controller()
export class AppController {
    constructor(
        private ai: OpenAiService,
        private metrics: MetricsService,
        private audit: AuditService
    ) { }

    /**
     * POST /chat endpoint
     * Takes a natural language prompt, converts it to a chart spec via OpenAI,
     * fetches the relevant data, and returns the complete chart configuration
     * @param body - Chat request containing the user's prompt
     * @returns Promise<object> - Chart specification with data
     */
    @Post('chat')
    async chat(@Body(new ValidationPipe()) body: ChatDto) {
        const startTime = Date.now();

        try {
            // Step 1: Get data analysis for context
            const dataAnalysis = await this.metrics.getDataAnalysis();

            // Step 2: Convert natural language prompt to structured chart spec with context
            const spec = await this.ai.prompt(body.prompt, dataAnalysis);

            // Step 3: Fetch the relevant data based on the chart spec
            const data = await this.metrics.slice(
                spec.metric,
                spec.dateRange,
                spec.groupBy
            );

            const responseTime = Date.now() - startTime;

            // Step 4: Audit the chart generation
            const requestId = await this.audit.logChartGeneration(
                body.prompt,
                spec,
                data,
                dataAnalysis,
                {
                    dataSourceFile: config.dataSource.primaryFile,
                    responseTimeMs: responseTime,
                    metricsCount: dataAnalysis.availableMetrics.length
                }
            );

            // Step 5: Return combined spec and data for the frontend
            return {
                ...spec,
                data,
                requestId,
                dataAnalysis: {
                    totalMetrics: dataAnalysis.availableMetrics.length,
                    suggestedChartTypes: dataAnalysis.suggestedChartTypes.map((s: any) => s.chartType)
                }
            };
        } catch (error) {
            console.error('Error processing chat request:', error);
            throw new Error('Failed to process chat request');
        }
    }

    /**
     * GET /audit/stats endpoint
     * Returns audit statistics for monitoring and analysis
     */
    @Get('audit/stats')
    async getAuditStats() {
        try {
            const stats = await this.audit.getAuditStats();
            return {
                success: true,
                stats
            };
        } catch (error) {
            console.error('Error getting audit stats:', error);
            return {
                success: false,
                error: 'Failed to get audit statistics'
            };
        }
    }
} 