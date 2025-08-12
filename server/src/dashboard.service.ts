import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { MetricInfo } from './data-analysis.service';
import { ReasoningService } from './reasoning.service';
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

/**
 * Primary Dashboard generation service with built-in deduplication to prevent duplicate charts
 */
@Injectable()
export class DashboardService {
    constructor(
        private openAiService: OpenAiService,
        private metricsService: MetricsService,
        private reasoningService: ReasoningService
    ) { }

    async generateDashboard(request: DashboardDto): Promise<DashboardResponse> {
        // Use LangGraph-based orchestration for dashboard generation
        const result = await runDashboardGraph(request, {
            metricsService: this.metricsService,
            identifyRelatedMetrics: this.identifyRelatedMetrics.bind(this),
            generateChartSpecs: this.generateChartSpecs.bind(this),
            formatTitle: this.generateChartTitle.bind(this),
            calcSpan: this.calculateChartSpan.bind(this),
            generateInsights: this.generateInsights.bind(this),
            generateDashboardId: this.generateDashboardId.bind(this),
        });

        return result as DashboardResponse;
    }

    public async identifyRelatedMetrics(prompt: string, dataAnalysis: any, maxCharts: number = 5): Promise<MetricInfo[]> {
        // Filter out scalar metrics for dashboards - they don't visualize well as charts
        const visualizableMetrics = dataAnalysis.availableMetrics.filter((m: MetricInfo) =>
            m.type !== 'scalar'
        );

        // Use centralized reasoning service for comprehensive analysis
        const analysis = this.reasoningService.analyzeAndRankMetrics(prompt, visualizableMetrics, maxCharts);

        // Log quality issues if any
        if (analysis.qualityIssues.length > 0) {
            console.log('=== METRIC QUALITY ISSUES ===');
            analysis.qualityIssues.forEach(issue => {
                console.log(`Metric: ${issue.metric.name}`);
                console.log(`Issues: ${issue.issues.join(', ')} (${issue.severity} severity)`);
            });
            console.log('=== END QUALITY ISSUES ===');
        }

        // Deduplicate metrics by name (in case reasoning service returns duplicates)
        const metrics = analysis.rankedMetrics.map(ranked => ranked.metric);
        const uniqueMetrics = metrics.filter((metric, index) =>
            metrics.findIndex(m => m.name === metric.name) === index
        );

        return uniqueMetrics;
    }

    public async generateChartSpecs(request: DashboardDto, metrics: MetricInfo[], dataAnalysis: any): Promise<any[]> {
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

        // Remove duplicates based on metric + chart type + date range combination
        return this.deduplicateChartSpecs(specs);
    }

    public generateChartTitle(metricName: string, chartType: string): string {
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

    public calculateChartSpan(chartType: string, totalCharts: number): number {
        // All charts take full width in single column layout
        return 4;
    }

    public async generateInsights(charts: any[], originalPrompt: string): Promise<string[]> {
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

    public generateDashboardId(): string {
        return `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a unique key for chart deduplication based on metric, chart type, and date range
     * @param spec - Chart specification object
     * @returns Unique string key for the chart
     */
    private createChartKey(spec: any): string {
        // Handle cases where spec properties might be undefined
        const metric = spec?.metric || 'unknown';
        const chartType = spec?.chartType || 'unknown';
        const dateRange = spec?.dateRange || 'default';
        return `${metric}|${chartType}|${dateRange}`;
    }

    /**
 * Remove duplicate charts based on metric, chart type, and date range combination
 * @param specs - Array of chart specifications
 * @returns Deduplicated array of chart specifications
 */
    private deduplicateChartSpecs(specs: any[]): any[] {
        const seenKeys = new Set<string>();
        const deduplicated: any[] = [];

        for (const spec of specs) {
            const key = this.createChartKey(spec);

            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                deduplicated.push(spec);
            }
        }

        return deduplicated;
    }
} 