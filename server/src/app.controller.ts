import { Body, Controller, Post, Get, ValidationPipe } from '@nestjs/common';
import { DashboardDto, FeedbackDto } from './chat.dto';
import { MetricsService } from './metrics.service';
import { AuditService } from './audit.service';
import { DashboardService } from './dashboard.service';
import { startTrace } from './observability/langfuse';

/**
 * Main application controller
 * Handles the chat endpoint that coordinates between OpenAI and metrics data
 */
@Controller()
export class AppController {
    constructor(
        private metrics: MetricsService,
        private audit: AuditService,
        private dashboard: DashboardService,
    ) { }

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
            return response;
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
    async getFeedbackStats() {
        try {
            return await this.audit.getFeedbackStats();
        } catch (error) {
            console.error('Error getting feedback stats:', error);
            throw new Error('Failed to get feedback statistics');
        }
    }

    // removed reasoning status endpoint
} 