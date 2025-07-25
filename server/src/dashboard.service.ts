import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { DashboardDto, DashboardChartDto } from './chat.dto';

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
        private dataAnalysisService: DataAnalysisService
    ) { }

    async generateDashboard(request: DashboardDto): Promise<DashboardResponse> {
        const startTime = Date.now();
        const dashboardId = this.generateDashboardId();

        // Get data analysis for context
        const dataAnalysis = await this.metricsService.getDataAnalysis();

        // Identify related metrics from the prompt
        const relatedMetrics = await this.identifyRelatedMetrics(request.prompt, dataAnalysis, request.maxCharts);

        // Generate chart specifications
        const chartSpecs = await this.generateChartSpecs(request, relatedMetrics, dataAnalysis);

        // Fetch data for each chart
        const charts = await Promise.all(
            chartSpecs.map(async (spec, index) => {
                const data = await this.metricsService.slice(
                    spec.metric,
                    spec.dateRange,
                    spec.groupBy
                );

                return {
                    ...spec,
                    id: `chart_${index + 1}`,
                    data,
                    row: Math.floor(index / 2) + 1,
                    col: (index % 2) + 1,
                    span: this.calculateChartSpan(spec.chartType, chartSpecs.length)
                };
            })
        );

        const responseTime = Date.now() - startTime;
        const insights = request.generateInsights ?
            await this.generateInsights(charts, request.prompt) : [];

        return {
            dashboardId,
            charts,
            metadata: {
                totalCharts: charts.length,
                responseTimeMs: responseTime,
                suggestedInsights: insights
            },
            requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
    }

    private async identifyRelatedMetrics(prompt: string, dataAnalysis: any, maxCharts: number = 5): Promise<MetricInfo[]> {
        const promptLower = prompt.toLowerCase();
        const allMetrics = dataAnalysis.availableMetrics;

        // TEMP FIX: Filter out scalar metrics for dashboards - they don't visualize well as charts
        // TODO: In the future, implement metric-card type for scalar values
        const visualizableMetrics = allMetrics.filter((m: MetricInfo) =>
            m.type !== 'scalar'
        );

        // Find primary metric mentioned in prompt
        const primaryMetric = this.dataAnalysisService.findBestMetricMatch(prompt, visualizableMetrics);
        const relatedMetrics = [primaryMetric].filter(Boolean);

        // Add related metrics based on keywords and patterns
        if (promptLower.includes('performance') || promptLower.includes('overview') || promptLower.includes('dashboard')) {
            // Add key business metrics
            relatedMetrics.push(
                ...visualizableMetrics.filter((m: MetricInfo) =>
                    m.name.toLowerCase().includes('sales') ||
                    m.name.toLowerCase().includes('orders') ||
                    m.name.toLowerCase().includes('revenue') ||
                    m.name.toLowerCase().includes('profit')
                ).slice(0, 3)
            );
        }

        if (promptLower.includes('sales') || promptLower.includes('revenue')) {
            relatedMetrics.push(
                ...visualizableMetrics.filter((m: MetricInfo) =>
                    m.name.toLowerCase().includes('gross') ||
                    m.name.toLowerCase().includes('net') ||
                    m.name.toLowerCase().includes('connector') ||
                    m.name.toLowerCase().includes('channel')
                ).slice(0, 2)
            );
        }

        if (promptLower.includes('financial') || promptLower.includes('cash')) {
            relatedMetrics.push(
                ...visualizableMetrics.filter((m: MetricInfo) =>
                    m.name.toLowerCase().includes('cash') ||
                    m.name.toLowerCase().includes('profit') ||
                    m.name.toLowerCase().includes('margin')
                ).slice(0, 2)
            );
        }

        // Remove duplicates and limit to maxCharts
        const uniqueMetrics = relatedMetrics.filter((metric, index, self) =>
            metric && self.findIndex((m: MetricInfo | null) => m?.name === metric.name) === index
        );

        return uniqueMetrics.slice(0, maxCharts);
    }

    private async generateChartSpecs(request: DashboardDto, metrics: MetricInfo[], dataAnalysis: any): Promise<any[]> {
        const specs = [];

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