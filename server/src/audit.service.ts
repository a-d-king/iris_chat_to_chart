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
        dataSourceFile: string;
        responseTimeMs: number;
        metricsCount: number;
    };
}

/**
 * Service for auditing chart generation requests
 * Saves data used in chart generation for compliance and debugging
 */
@Injectable()
export class AuditService {
    private auditDir = path.join(__dirname, '..', 'audit-logs');

    constructor() {
        this.ensureAuditDirectoryExists();
    }

    /**
     * Ensure the audit directory exists
     */
    private async ensureAuditDirectoryExists(): Promise<void> {
        try {
            await fs.access(this.auditDir);
        } catch (error) {
            // Directory doesn't exist, create it
            await fs.mkdir(this.auditDir, { recursive: true });
            console.log(`📋 Created audit directory: ${this.auditDir}`);
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
            dataSourceFile: string;
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

        // Save to individual file
        const filename = `chart-${requestId}.json`;
        const filepath = path.join(this.auditDir, filename);

        try {
            await fs.writeFile(filepath, JSON.stringify(auditEntry, null, 2), 'utf-8');
            console.log(`📋 Audit log saved: ${filename}`);

            // Also append to daily summary log
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

            // Try to load existing summary
            try {
                const existingData = await fs.readFile(summaryFile, 'utf-8');
                dailySummary = JSON.parse(existingData);
            } catch (error) {
                // File doesn't exist yet, start with empty array
                dailySummary = [];
            }

            // Add summary entry (without full data to keep file size manageable)
            dailySummary.push({
                timestamp: entry.timestamp,
                requestId: entry.requestId,
                userPrompt: entry.userPrompt,
                chartType: entry.chartSpec.chartType,
                metric: entry.chartSpec.metric,
                dataSourceFile: entry.metadata.dataSourceFile,
                responseTimeMs: entry.metadata.responseTimeMs
            });

            await fs.writeFile(summaryFile, JSON.stringify(dailySummary, null, 2), 'utf-8');
        } catch (error) {
            console.error('Error updating daily summary:', error);
            // Don't throw here, as the main audit log was already saved
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

            // Read a sample of files to get stats (limit to avoid performance issues)
            const sampleSize = Math.min(100, chartFiles.length);
            const sampleFiles = chartFiles.slice(-sampleSize);

            const chartTypeBreakdown: Record<string, number> = {};
            let totalResponseTime = 0;

            for (const file of sampleFiles) {
                try {
                    const filePath = path.join(this.auditDir, file);
                    const content = await fs.readFile(filePath, 'utf-8');
                    const entry: AuditLogEntry = JSON.parse(content);

                    // Chart type breakdown
                    const chartType = entry.chartSpec.chartType;
                    chartTypeBreakdown[chartType] = (chartTypeBreakdown[chartType] || 0) + 1;

                    // Response time
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
     * Clean up old audit logs (keep last 30 days)
     */
    async cleanupOldLogs(): Promise<void> {
        try {
            await this.ensureAuditDirectoryExists();

            const files = await fs.readdir(this.auditDir);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            let deletedCount = 0;

            for (const file of files) {
                const filePath = path.join(this.auditDir, file);
                const stats = await fs.stat(filePath);

                if (stats.mtime < thirtyDaysAgo) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }

            if (deletedCount > 0) {
                console.log(`📋 Cleaned up ${deletedCount} old audit log files`);
            }
        } catch (error) {
            console.error('Error cleaning up audit logs:', error);
        }
    }
} 