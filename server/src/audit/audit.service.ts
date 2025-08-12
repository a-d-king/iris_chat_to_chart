import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

/**
 * Interface for chart feedback data
 */
export interface ChartFeedback {
    rating: 1 | 2 | 3 | 4 | 5;
    timestamp: string;
    comment?: string;
    chartId?: string;
}

/**
 * Interface for audit log entries
 */
export interface AuditLogEntry {
    timestamp: string;
    requestId: string;
    userPrompt: string;
    chartSpec: any;
    dataUsed: any;
    dataAnalysis: any;
    metadata: {
        dataSource: string;
        responseTimeMs: number;
        metricsCount: number;
    };
    feedback?: ChartFeedback;
}

/**
 * Interface for dashboard audit data formatted for PostgreSQL
 */
export interface DashboardAuditData {
    request_id: string;
    timestamp: Date;
    user_prompt: string;
    request_type: string;
    chart_schemas: any[]; // JSONB
    total_charts: number;
    response_time_ms: number;
    metadata: any; // JSONB
}

/**
 * Service for auditing chart generation requests
 * Saves data used in chart generation for compliance/debugging and extension to saving to a database
 */
@Injectable()
export class AuditService {
    private auditDir = path.join(__dirname, '..', 'audit-logs');

    constructor() {
        this.ensureAuditDirectoryExists();
    }

    private async ensureAuditDirectoryExists(): Promise<void> {
        try {
            await fs.access(this.auditDir);
        } catch (error) {
            await fs.mkdir(this.auditDir, { recursive: true });
            console.log(`Created audit directory: ${this.auditDir}`);
        }
    }

    /**
     * Generate a unique request ID
     */
    private generateRequestId(): string {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `${timestamp}-${random}`;
    }

    /**
     * Log a chart generation request
     */
    async logChartGeneration(
        userPrompt: string,
        chartSpec: any,
        dataUsed: any,
        dataAnalysis: any,
        metadata: {
            dataSource: string;
            responseTimeMs: number;
            metricsCount: number;
        }
    ): Promise<string> {
        const requestId = this.generateRequestId();
        const timestamp = new Date().toISOString();

        const auditEntry: AuditLogEntry = {
            timestamp,
            requestId,
            userPrompt,
            chartSpec,
            dataUsed,
            dataAnalysis,
            metadata
        };

        const filename = `chart-${requestId}.json`;
        const filepath = path.join(this.auditDir, filename);

        try {
            await fs.writeFile(filepath, JSON.stringify(auditEntry, null, 2), 'utf-8');
            console.log(`Audit log saved: ${filename}`);

            return requestId;
        } catch (error) {
            console.error('Error saving audit log:', error);
            throw new Error('Failed to save audit log');
        }
    }

    /**
     * Add feedback to an existing audit log entry
     */
    async addFeedback(
        requestId: string,
        rating: 1 | 2 | 3 | 4 | 5,
        comment?: string,
        chartId?: string
    ): Promise<void> {
        const feedback: ChartFeedback = {
            rating,
            timestamp: new Date().toISOString(),
            comment,
            chartId
        };

        // Update the audit log file
        const filename = `chart-${requestId}.json`;
        const filepath = path.join(this.auditDir, filename);

        try {
            const existingData = await fs.readFile(filepath, 'utf-8');
            const auditEntry: AuditLogEntry = JSON.parse(existingData);

            auditEntry.feedback = feedback;

            await fs.writeFile(filepath, JSON.stringify(auditEntry, null, 2), 'utf-8');
            console.log(`Feedback added to audit log: ${filename}`);
        } catch (error) {
            console.error('Error adding feedback to audit log:', error);
            throw new Error('Failed to save feedback');
        }
    }

    /**
     * Get feedback statistics across all audit logs
     */
    async getFeedbackStats(): Promise<{
        totalFeedback: number;
        averageRating: number;
        ratingDistribution: Record<number, number>;
    }> {
        try {
            const files = await fs.readdir(this.auditDir);
            const auditFiles = files.filter(f => f.startsWith('chart-') && f.endsWith('.json'));

            let totalFeedback = 0;
            let ratingSum = 0;
            const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

            for (const file of auditFiles) {
                try {
                    const data = await fs.readFile(path.join(this.auditDir, file), 'utf-8');
                    const entry: AuditLogEntry = JSON.parse(data);

                    if (entry.feedback) {
                        totalFeedback++;
                        ratingSum += entry.feedback.rating;
                        ratingDistribution[entry.feedback.rating]++;
                    }
                } catch (error) {
                    // Skip invalid files
                    continue;
                }
            }

            return {
                totalFeedback,
                averageRating: totalFeedback > 0 ? ratingSum / totalFeedback : 0,
                ratingDistribution
            };
        } catch (error) {
            console.error('Error calculating feedback stats:', error);
            return { totalFeedback: 0, averageRating: 0, ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
        }
    }

    /**
     * Get audit statistics
     */
    async getAuditStats(): Promise<{
        totalRequests: number;
        todayRequests: number;
        chartTypeBreakdown: Record<string, number>;
        averageResponseTime: number;
    }> {
        try {
            await this.ensureAuditDirectoryExists();

            const files = await fs.readdir(this.auditDir);
            const chartFiles = files.filter(f => f.startsWith('chart-') && f.endsWith('.json'));

            const today = new Date().toISOString().split('T')[0];
            const todayFiles = chartFiles.filter(f => f.includes(today));

            const sampleSize = Math.min(100, chartFiles.length);
            const sampleFiles = chartFiles.slice(-sampleSize);

            const chartTypeBreakdown: Record<string, number> = {};
            let totalResponseTime = 0;

            for (const file of sampleFiles) {
                try {
                    const filePath = path.join(this.auditDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const entry: AuditLogEntry = JSON.parse(content);
                    const chartType = entry.chartSpec.chartType;

                    chartTypeBreakdown[chartType] = (chartTypeBreakdown[chartType] || 0) + 1;

                    totalResponseTime += entry.metadata.responseTimeMs;
                } catch (error) {
                    console.error(`Error reading audit file ${file}:`, error);
                }
            }

            return {
                totalRequests: chartFiles.length,
                todayRequests: todayFiles.length,
                chartTypeBreakdown,
                averageResponseTime: sampleFiles.length > 0 ? totalResponseTime / sampleFiles.length : 0
            };
        } catch (error) {
            console.error('Error getting audit stats:', error);
            return {
                totalRequests: 0,
                todayRequests: 0,
                chartTypeBreakdown: {},
                averageResponseTime: 0
            };
        }
    }

    /**
     * Prepare dashboard audit data for database insertion
     * Call this after dashboard generation to get formatted data for your existing DB
     */
    async prepareForDatabase(
        userPrompt: string,
        dashboardResult: any,
        dashboardType: 'standard' | 'enhanced',
        metadata: {
            dataSource: string;
            responseTimeMs: number;
            metricsCount: number;
            analysisType?: string;
            context?: any;
        },
        requirements?: any
    ): Promise<DashboardAuditData> {
        const requestId = this.generateRequestId();

        // Extract chart schemas for JSONB storage
        const chartSchemas = dashboardResult.charts.map((chart: any) => ({
            id: chart.id,
            chartType: chart.chartType,
            metric: chart.metric,
            dateRange: chart.dateRange,
            title: chart.title,
            groupBy: chart.groupBy,
            row: chart.row,
            col: chart.col,
            span: chart.span,
            analysisType: chart.analysisType,
            context: chart.context
        }));

        return {
            request_id: requestId,
            timestamp: new Date(),
            user_prompt: userPrompt,
            request_type: dashboardType === 'enhanced' ? 'enhanced-dashboard' : 'dashboard',
            chart_schemas: chartSchemas,
            total_charts: chartSchemas.length,
            response_time_ms: metadata.responseTimeMs,
            metadata: {
                dataSource: metadata.dataSource,
                metricsCount: metadata.metricsCount,
                analysisType: metadata.analysisType,
                context: metadata.context,
                requirements
            }
        };
    }
} 