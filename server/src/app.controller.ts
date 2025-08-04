import { Body, Controller, Post, Get, ValidationPipe } from '@nestjs/common';
import { ChatDto, DashboardDto } from './chat.dto';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';

/**
 * Main application controller
 * Handles the chat endpoint that coordinates between OpenAI and metrics data
 */
@Controller()
export class AppController {
    constructor(
        private ai: OpenAiService,
        private metrics: MetricsService,
        private audit: AuditService,
        private dashboard: DashboardService
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
                    dataSource: 'Iris Finance API',
                    responseTimeMs: responseTime,
                    metricsCount: dataAnalysis.availableMetrics.length
                }
            );

            // Step 5: Return combined spec and data for the frontend
            // Data is now sourced from live Iris Finance API instead of mock JSON
            // 
            // DATA SHAPE SPECIFICATION:
            // {
            //   // Chart specification (from OpenAI service)
            //   chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall',
            //   metric: string,                    // e.g., "sales", "totalGrossSales"
            //   dateRange: string,                 // YYYY or YYYY-MM format, e.g., "2025" or "2025-06"
            //   groupBy?: string,                  // Optional grouping dimension, e.g., "connector"
            //   
            //   // Processed chart data (from metrics service)
            //   data: Array<{
            //     [key: string]: any               // Chart-ready data points
            //   }>,
            //   
            //   // Audit and tracking information
            //   requestId: string,                 // Unique ID like "1703123456789-abc123def"
            //   originalPrompt: string,            // User's original input
            //   
            //   // Data analysis summary
            //   dataAnalysis: {
            //     totalMetrics: number,            // Total number of discovered metrics
            //     suggestedChartTypes: string[]    // Array of suggested chart types
            //   }
            // }
            return {
                ...spec,
                data,
                requestId,
                originalPrompt: body.prompt,
                dataAnalysis: {
                    totalMetrics: dataAnalysis.availableMetrics.length,
                    suggestedChartTypes: dataAnalysis.suggestedChartTypes.map((s: any) => s.chartType)
                }
            };
        } catch (error) {
            const responseTime = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : String(error);

            console.error('Chat endpoint error:', {
                prompt: body.prompt,
                error: errorMessage,
                responseTime
            });

            if (errorMessage.includes('not found in dataset')) {
                throw new Error(
                    `I couldn't find the requested metric in the data. ${errorMessage.split('Available metrics:')[1] ?
                        'Available metrics: ' + errorMessage.split('Available metrics:')[1] : ''}`
                );
            } else if (errorMessage.includes('Date range')) {
                throw new Error(
                    'Invalid date range format. Please use YYYY or YYYY-MM format (e.g., "2025" or "2025-06").'
                );
            } else if (errorMessage.includes('OpenAI') || errorMessage.includes('tool call')) {
                throw new Error(
                    'I had trouble understanding your request. Please try rephrasing it more clearly.'
                );
            } else if (errorMessage.includes('Unsupported metric type')) {
                throw new Error(
                    'This metric type is not yet supported for visualization. Please try a different metric.'
                );
            } else {
                throw new Error(
                    'Something went wrong while generating your chart. Please try again or contact support.'
                );
            }
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

    /**
     * POST /dashboard endpoint
     * Takes a natural language prompt and generates multiple related charts
     * @param body - Dashboard request containing the user's prompt and preferences
     * @returns Promise<object> - Dashboard with multiple charts and metadata
     */
    @Post('dashboard')
    async generateDashboard(@Body(new ValidationPipe()) body: DashboardDto) {
        const startTime = Date.now();

        try {
            const result = await this.dashboard.generateDashboard(body);

            // Audit the dashboard generation
            const requestId = await this.audit.logChartGeneration(
                body.prompt,
                { chartType: 'dashboard', metric: 'multiple', dateRange: body.dateRange || '2025-06' },
                result.charts,
                await this.metrics.getDataAnalysis(),
                {
                    dataSource: 'Iris Finance API',
                    responseTimeMs: Date.now() - startTime,
                    metricsCount: result.charts.length
                }
            );

            return {
                ...result,
                requestId,
                originalPrompt: body.prompt
            };
        } catch (error) {
            console.error('Error generating dashboard:', error);
            throw new Error('Failed to generate dashboard');
        }
    }
} 