import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { MetricInfo } from './data-analysis.service';
import { DashboardDto, DashboardChartDto } from './chat.dto';
import { runDashboardGraph } from './dashboard.graph';

interface DashboardResponse {
    dashboardId: string;
    charts: DashboardChartDto[];
    metadata: {
        totalCharts: number;
        responseTimeMs: number;
        suggestedInsights: string[];
    };
    requestId: string;
}

@Injectable()
export class DashboardService {
    constructor(
        private openAiService: OpenAiService,
        private metricsService: MetricsService,
    ) { }

    async generateDashboard(request: DashboardDto): Promise<DashboardResponse> {
        // Use LangGraph-based orchestration for dashboard generation
        const result = await runDashboardGraph(request, {
            openAiService: this.openAiService,
            metricsService: this.metricsService,
        });

        return result as DashboardResponse;
    }

    private async identifyRelatedMetrics(prompt: string, dataAnalysis: any, maxCharts: number = 5): Promise<MetricInfo[]> {
        // Filter out scalar metrics for dashboards - they don't visualize well as charts
        const visualizableMetrics = (dataAnalysis.availableMetrics as MetricInfo[]).filter((m: MetricInfo) =>
            m.type !== 'scalar'
        );

        // Use centralized reasoning service for comprehensive analysis
        // Fallback simple selection if reasoning service is removed
        const analysis = {
            rankedMetrics: visualizableMetrics.slice(0, maxCharts).map((m) => ({ metric: m }))
        } as any;

        // Log quality issues if any
        if (analysis.qualityIssues.length > 0) {
            console.log('=== METRIC QUALITY ISSUES ===');
            analysis.qualityIssues.forEach((issue: { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }) => {
                console.log(`Metric: ${issue.metric.name}`);
                console.log(`Issues: ${issue.issues.join(', ')} (${issue.severity} severity)`);
            });
            console.log('=== END QUALITY ISSUES ===');
        }

        return analysis.rankedMetrics.map((ranked: { metric: MetricInfo }) => ranked.metric);
    }

    private async generateChartSpecs(request: DashboardDto, metrics: MetricInfo[], dataAnalysis: any): Promise<any[]> {
        const specs = [] as any[];

        for (const metric of metrics) {
            // Create a focused prompt for this specific metric
            const metricPrompt = `Show ${metric.name} ${metric.hasTimeData ? 'trends over time' : 'breakdown'}`;

            try {
                const spec = await this.openAiService.prompt(metricPrompt, dataAnalysis);
                specs.push({
                    ...spec,
                    title: this.generateChartTitle(metric.name, spec.chartType),
                    dateRange: request.dateRange || spec.dateRange
                });
            } catch (error) {
                console.warn(`Failed to generate spec for ${metric.name}:`, error);
                // Fallback to default chart spec
                specs.push({
                    chartType: metric.hasTimeData ? 'line' : 'bar',
                    metric: metric.name,
                    dateRange: request.dateRange || '2025-06',
                    title: this.generateChartTitle(metric.name, metric.hasTimeData ? 'line' : 'bar')
                });
            }
        }

        return specs;
    }

    private generateChartTitle(metricName: string, chartType: string): string {
        const cleanName = metricName.split('.').pop() || metricName;
        const formattedName = cleanName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();

        const typeMap = {
            'line': 'Trends',
            'bar': 'Comparison',
            'stacked-bar': 'Breakdown',
            'heatmap': 'Pattern Analysis',
            'waterfall': 'Impact Analysis'
        };

        return `${formattedName} ${typeMap[chartType as keyof typeof typeMap] || 'Analysis'}`;
    }

    private calculateChartSpan(chartType: string, totalCharts: number): number {
        // All charts take full width in single column layout
        return 4;
    }

    private async generateInsights(charts: any[], originalPrompt: string): Promise<string[]> {
        const insights = [];

        // Basic insights based on chart count and types
        if (charts.length > 3) {
            insights.push(`Generated ${charts.length} related charts for comprehensive analysis`);
        }

        const chartTypes = [...new Set(charts.map(c => c.chartType))];
        if (chartTypes.length > 2) {
            insights.push(`Multiple visualization types used for different data perspectives`);
        }

        // Add domain-specific insights
        const hasTimeSeries = charts.some(c => c.chartType === 'line');
        const hasComparison = charts.some(c => c.chartType === 'bar' || c.chartType === 'stacked-bar');

        if (hasTimeSeries && hasComparison) {
            insights.push('Dashboard includes both trend analysis and comparative metrics');
        }

        return insights.slice(0, 3); // Limit to 3 insights
    }

    private generateDashboardId(): string {
        return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
} 