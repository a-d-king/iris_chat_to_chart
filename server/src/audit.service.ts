import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';

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
}

/**
 * Interface for dashboard audit data formatted for PostgreSQL
 */
export interface DashboardAuditData {
    request_id: string;
    timestamp: Date;
    user_prompt: string;
    request_type: string;
    chart_schemas: any[]; // JSONB data
    total_charts: number;
    response_time_ms: number;
    metadata: any; // JSONB data
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

            await this.appendToDailySummary(auditEntry);

            return requestId;
        } catch (error) {
            console.error('Error saving audit log:', error);
            throw new Error('Failed to save audit log');
        }
    }

    /**
     * Append entry to daily summary log
     */
    private async appendToDailySummary(entry: AuditLogEntry): Promise<void> {
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const summaryFile = path.join(this.auditDir, `daily-summary-${today}.json`);

        try {
            let dailySummary: any[] = [];

            try {
                const existingData = await fs.readFile(summaryFile, 'utf-8');
                dailySummary = JSON.parse(existingData);
            } catch (error) {
                dailySummary = [];
            }

            // Add summary entry (without full data to keep file size manageable)
            dailySummary.push({
                timestamp: entry.timestamp,
                requestId: entry.requestId,
                userPrompt: entry.userPrompt,
                chartType: entry.chartSpec.chartType,
                metric: entry.chartSpec.metric,
                dataSource: entry.metadata.dataSource,
                responseTimeMs: entry.metadata.responseTimeMs
            });

            await fs.writeFile(summaryFile, JSON.stringify(dailySummary, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error updating daily summary:', error);
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
 * Prepare dashboard audit data for PostgreSQL insertion
 * Call this after dashboard generation to get formatted data for your existing DB
 */
    async prepareDashboardAuditForPostgres(
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