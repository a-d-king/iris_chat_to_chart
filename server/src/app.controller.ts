import { Body, Controller, Post, Get, ValidationPipe, Version } from '@nestjs/common';
import { ChatDto, DashboardDto, FeedbackDto, ChatResponseDto, DashboardResponseDto } from './dto/chat.dto';
import { ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { OpenAiService } from './openai.service';
import { MetricsService } from './data/metrics.service';
import { AuditService } from './audit/audit.service';
import { DashboardService } from './dashboard.service';
import { ReasoningService } from './reasoning.service';
import { startTrace } from './observability/langfuse';

/**
 * Main application controller
 * Handles the chat endpoint that coordinates between OpenAI and metrics data
 */
@ApiTags('v1')
@Controller({ version: '1' })
export class AppController {
    constructor(
        private ai: OpenAiService,
        private metrics: MetricsService,
        private audit: AuditService,
        private dashboard: DashboardService,
        private reasoning: ReasoningService
    ) { }

    /**
     * POST /chat endpoint
     * Takes a natural language prompt, converts it to a chart spec via OpenAI,
     * fetches the relevant data, and returns the complete chart configuration
     * @param body - Chat request containing the user's prompt
     * @returns Promise<object> - Chart specification with data
     */
    @Post('chat')
    @Version('1')
    @ApiBody({ type: ChatDto })
    @ApiOkResponse({ type: ChatResponseDto })
    async chat(@Body(new ValidationPipe()) body: ChatDto): Promise<ChatResponseDto> {
        const trace = startTrace('endpoint.chat', { body });
        const startTime = Date.now();

        try {
            // Step 1: Get data analysis for context (use provided dateRange or default)
            const effectiveDateRange = body.dateRange || undefined;
            const dataAnalysis = await this.metrics.getDataAnalysis(effectiveDateRange);

            // Step 2: Convert natural language prompt to structured chart spec with context
            const spec = await this.ai.prompt(body.prompt, dataAnalysis);

            // Step 3: Fetch the relevant data based on the chart spec
            // Use the provided dateRange from frontend if available, otherwise use spec.dateRange
            const finalDateRange = body.dateRange || spec.dateRange;
            const data = await this.metrics.slice(
                spec.metric,
                finalDateRange,
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

            // Log the data used for this chart (after requestId is available)
            try {
                const seriesLabels = Array.isArray((data as any)?.values)
                    ? (data as any).values.map((s: any) => s.label)
                    : [];
                console.log('=== CHART DATA USED ===');
                console.log({
                    requestId,
                    chartType: spec.chartType,
                    metric: spec.metric,
                    dateRange: finalDateRange,
                    groupBy: spec.groupBy,
                    points: (data as any)?.dates?.length || 0,
                    series: seriesLabels,
                    sample: {
                        dates: (data as any)?.dates?.slice(0, 3),
                        firstSeriesSample: (data as any)?.values?.[0]?.values?.slice(0, 3)
                    }
                });
                console.log('=== END CHART DATA ===');
            } catch (_) { }

            // Step 5: Return combined spec and data for the frontend from live Iris Finance API
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
            const result = {
                chartType: spec.chartType,
                metric: spec.metric,
                groupBy: spec.groupBy,
                dateRange: spec.dateRange,
                data,
                requestId,
                originalPrompt: body.prompt,
                dataAnalysis: {
                    totalMetrics: dataAnalysis.availableMetrics.length,
                    suggestedChartTypes: dataAnalysis.suggestedChartTypes.map((s: any) => s.chartType)
                }
            };
            try { (trace as any)?.end({ output: { chartType: result.chartType, metric: result.metric } }); } catch { }
            return result as any;
        } catch (error) {
            try { (trace as any)?.end({ level: 'ERROR', statusMessage: String(error) }); } catch { }
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
    @Version('1')
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
    @Version('1')
    @ApiBody({ type: DashboardDto })
    @ApiOkResponse({ type: DashboardResponseDto })
    async generateDashboard(@Body(new ValidationPipe()) body: DashboardDto): Promise<DashboardResponseDto> {
        const trace = startTrace('endpoint.dashboard', { body });
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

            const response = {
                ...result,
                requestId,
                originalPrompt: body.prompt
            };
            try { (trace as any)?.end({ output: { charts: result.charts?.length ?? 0 } }); } catch { }
            return response as any;
        } catch (error) {
            try { (trace as any)?.end({ level: 'ERROR', statusMessage: String(error) }); } catch { }
            console.error('Error generating dashboard:', error);
            throw new Error('Failed to generate dashboard');
        }
    }

    /**
     * POST /feedback endpoint
     * Accepts user feedback for generated charts
     * @param body - Feedback data containing requestId, rating, and optional comment
     * @returns Promise<object> - Success response
     */
    @Post('feedback')
    @Version('1')
    async submitFeedback(@Body(new ValidationPipe()) body: FeedbackDto) {
        try {
            await this.audit.addFeedback(
                body.requestId,
                body.rating,
                body.comment,
                body.chartId
            );

            return {
                success: true,
                message: 'Feedback submitted successfully'
            };
        } catch (error) {
            console.error('Error submitting feedback:', error);
            throw new Error('Failed to submit feedback');
        }
    }

    /**
     * GET /feedback/stats endpoint
     * Returns aggregated feedback statistics for analytics
     * @returns Promise<object> - Feedback statistics
     */
    @Get('feedback/stats')
    @Version('1')
    async getFeedbackStats() {
        try {
            return await this.audit.getFeedbackStats();
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            throw new Error('Failed to get feedback statistics');
        }
    }

    /**
     * GET /reasoning/status endpoint
     * Returns the current status of reasoning functionality
     * @returns object - Reasoning configuration status
     */
    @Get('reasoning/status')
    @Version('1')
    async getReasoningStatus() {
        try {
            return this.reasoning.getReasoningStatus();
        } catch (error) {
            console.error('Error getting reasoning status:', error);
            throw new Error('Failed to get reasoning status');
        }
    }
} 