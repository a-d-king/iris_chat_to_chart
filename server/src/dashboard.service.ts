import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { DashboardDto, DashboardChartDto, EnhancedDashboardDto } from './chat.dto';

interface DashboardResponse {
    dashboardId: string;
    charts: DashboardChartDto[];
    metadata: {
        totalCharts: number;
        responseTimeMs: number;
        suggestedInsights: string[];
        context?: any;
        analysisType?: string;
    };
    requestId: string;
}

@Injectable()
export class DashboardService {
    private recentDashboards: Map<string, { timestamp: number; result: any }> = new Map();
    private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    private cleanupTimer: NodeJS.Timeout;

    constructor(
        private openAiService: OpenAiService,
        private metricsService: MetricsService,
        private dataAnalysisService: DataAnalysisService
    ) {
        // Setup periodic cleanup of old cache entries
        this.cleanupTimer = setInterval(() => this.cleanupCache(), 60000); // Every minute
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, value] of this.recentDashboards.entries()) {
            if (now - value.timestamp > this.CACHE_DURATION) {
                this.recentDashboards.delete(key);
            }
        }
    }

    async generateDashboard(request: DashboardDto): Promise<DashboardResponse> {
        // Generate cache key based on request parameters
        const cacheKey = this.generateCacheKey(request);

        // Check if we've generated this dashboard recently
        const cached = this.recentDashboards.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log('Returning cached dashboard to prevent duplicate generation');
            return {
                ...cached.result,
                requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // New request ID
            };
        }

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

        const result = {
            dashboardId,
            charts,
            metadata: {
                totalCharts: charts.length,
                responseTimeMs: responseTime,
                suggestedInsights: insights
            },
            requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        this.recentDashboards.set(cacheKey, { timestamp: Date.now(), result });
        return result;
    }

    async generateEnhancedDashboard(request: EnhancedDashboardDto): Promise<DashboardResponse> {
        // Generate cache key based on enhanced request parameters
        const cacheKey = this.generateEnhancedCacheKey(request);

        // Check if we've generated this dashboard recently
        const cached = this.recentDashboards.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            console.log('Returning cached enhanced dashboard to prevent duplicate generation');
            return {
                ...cached.result,
                requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` // New request ID
            };
        }

        const startTime = Date.now();
        const dashboardId = this.generateDashboardId();

        // Get data analysis for context
        const dataAnalysis = await this.metricsService.getDataAnalysis();

        // Use structured requirements to guide chart generation
        const chartSpecs = await this.generateChartsFromRequirements(request, dataAnalysis);

        // Fetch data for each chart with enhanced filtering
        const charts = await Promise.all(
            chartSpecs.map(async (spec, index) => {
                const data = await this.fetchChartDataWithContext(spec, request.requirements);

                return {
                    ...spec,
                    id: `chart_${index + 1}`,
                    data,
                    row: Math.floor(index / this.getGridColumns(request.requirements.visualization.layout)) + 1,
                    col: (index % this.getGridColumns(request.requirements.visualization.layout)) + 1,
                    span: this.calculateEnhancedChartSpan(spec, request.requirements)
                };
            })
        );

        const responseTime = Date.now() - startTime;
        const insights = request.generateInsights ?
            await this.generateContextualInsights(charts, request) : [];

        const result = {
            dashboardId,
            charts,
            metadata: {
                totalCharts: charts.length,
                responseTimeMs: responseTime,
                suggestedInsights: insights,
                context: request.requirements.context,
                analysisType: request.requirements.analysisType
            },
            requestId: `dash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        // Cache the result to prevent duplicate generation
        this.recentDashboards.set(cacheKey, { timestamp: Date.now(), result });
        return result;
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
        const specs: any[] = [];

        for (const metric of metrics) {
            // Create a focused prompt for this specific metric
            const metricPrompt = `Show ${metric.name} ${metric.hasTimeData ? 'trends over time' : 'breakdown'}`;

            try {
                const spec = await this.openAiService.prompt(metricPrompt, dataAnalysis);
                const newSpec = {
                    ...spec,
                    title: this.generateChartTitle(metric.name, spec.chartType),
                    dateRange: request.dateRange || spec.dateRange
                };

                // Check for duplicate chart specs
                const isDuplicate = specs.some(existingSpec =>
                    existingSpec.metric === newSpec.metric &&
                    existingSpec.chartType === newSpec.chartType
                );

                if (!isDuplicate) {
                    specs.push(newSpec);
                } else {
                    console.warn(`Skipping duplicate chart: ${newSpec.metric} (${newSpec.chartType})`);
                }
            } catch (error) {
                console.warn(`Failed to generate spec for ${metric.name}:`, error);
                // Fallback to default chart spec
                const fallbackSpec = {
                    chartType: metric.hasTimeData ? 'line' : 'bar',
                    metric: metric.name,
                    dateRange: request.dateRange || '2025-06',
                    title: this.generateChartTitle(metric.name, metric.hasTimeData ? 'line' : 'bar')
                };

                // Check for duplicates even in fallback specs
                const isDuplicate = specs.some(existingSpec =>
                    existingSpec.metric === fallbackSpec.metric &&
                    existingSpec.chartType === fallbackSpec.chartType
                );

                if (!isDuplicate) {
                    specs.push(fallbackSpec);
                }
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

    private async generateChartsFromRequirements(request: EnhancedDashboardDto, dataAnalysis: any): Promise<any[]> {
        const requirements = request.requirements;
        const specs: any[] = [];

        // Use specified metrics or fall back to AI identification
        let metrics: string[] = requirements.dataScope.metrics || [];
        if (metrics.length === 0) {
            const relatedMetrics = await this.identifyRelatedMetrics(
                request.prompt,
                dataAnalysis,
                requirements.visualization.maxCharts || 5
            );
            metrics = relatedMetrics.map(m => m.name);
        }

        // Remove duplicate metrics while preserving order
        const uniqueMetrics = [...new Set(metrics)];

        // Generate chart specs based on analysis type and context
        for (const metric of uniqueMetrics) {
            const spec = await this.generateContextualChartSpec(metric, requirements, dataAnalysis);

            // Check for duplicate chart specs (same metric + chartType combination)
            const isDuplicate = specs.some(existingSpec =>
                existingSpec.metric === spec.metric &&
                existingSpec.chartType === spec.chartType
            );

            if (!isDuplicate) {
                specs.push(spec);
            } else {
                console.warn(`Skipping duplicate chart: ${spec.metric} (${spec.chartType})`);
            }
        }

        return specs;
    }

    private async generateContextualChartSpec(metric: string, requirements: any, dataAnalysis: any): Promise<any> {
        // Build a contextual prompt based on requirements
        let prompt = `Show ${metric}`;

        switch (requirements.analysisType) {
            case 'trend':
                prompt += ' trends over time';
                break;
            case 'comparison':
                prompt += ' comparison between segments';
                break;
            case 'breakdown':
                prompt += ' breakdown by category';
                break;
            case 'performance':
                prompt += ' performance metrics';
                break;
            default:
                prompt += ' analysis';
        }

        // Add context based on audience
        if (requirements.context.audience === 'executive') {
            prompt += ' for executive summary';
        } else if (requirements.context.audience === 'analyst') {
            prompt += ' for detailed analysis';
        }

        try {
            const spec = await this.openAiService.prompt(prompt, dataAnalysis);
            return {
                ...spec,
                title: this.generateChartTitle(metric, spec.chartType),
                dateRange: this.getDateRangeFromRequirements(requirements),
                analysisType: requirements.analysisType,
                context: requirements.context
            };
        } catch (error) {
            console.warn(`Failed to generate contextual spec for ${metric}:`, error);
            return this.getFallbackChartSpec(metric, requirements);
        }
    }

    private getDateRangeFromRequirements(requirements: any): string {
        const timeRange = requirements.dataScope.timeRange;
        if (!timeRange) return '2025-06';

        if (timeRange.type === 'absolute' && timeRange.start && timeRange.end) {
            return `${timeRange.start}_${timeRange.end}`;
        }

        // Convert relative periods to date ranges
        switch (timeRange.period) {
            case 'last7days':
                return '2025-06'; // Simplified for now
            case 'last30days':
                return '2025-06';
            case 'lastQuarter':
                return '2025-06';
            case 'ytd':
                return '2025';
            default:
                return '2025-06';
        }
    }

    private getFallbackChartSpec(metric: string, requirements: any): any {
        const chartType = requirements.visualization.preferredChartTypes?.[0] ||
            (requirements.analysisType === 'trend' ? 'line' : 'bar');

        return {
            chartType,
            metric,
            dateRange: this.getDateRangeFromRequirements(requirements),
            title: this.generateChartTitle(metric, chartType),
            analysisType: requirements.analysisType,
            context: requirements.context
        };
    }

    private async fetchChartDataWithContext(spec: any, requirements: any): Promise<any> {
        // Apply filters from requirements
        const filters = requirements.dataScope.filters || {};

        // For now, use the existing slice method but in the future we can enhance it
        // to handle the rich filtering options
        const data = await this.metricsService.slice(
            spec.metric,
            spec.dateRange,
            spec.groupBy
        );

        // Apply additional filtering if needed
        return this.applyContextualFilters(data, filters, requirements);
    }

    private applyContextualFilters(data: any[], filters: any, requirements: any): any[] {
        let filteredData = data;

        // Apply channel filters
        if (filters.channels && filters.channels.length > 0) {
            filteredData = filteredData.filter((item: any) =>
                !item.channel || filters.channels.includes(item.channel)
            );
        }

        // Apply date range filters if needed
        // Additional filtering logic can be added here

        return filteredData;
    }

    private getGridColumns(layout?: string): number {
        switch (layout) {
            case 'stacked': return 1;
            case 'tabs': return 1;
            case 'grid':
            default: return 2;
        }
    }

    private calculateEnhancedChartSpan(spec: any, requirements: any): number {
        const layout = requirements.visualization.layout;

        if (layout === 'stacked') {
            return 4; // Full width
        }

        // For grid layout, adjust based on chart type and importance
        if (spec.chartType === 'heatmap' || spec.chartType === 'waterfall') {
            return 2; // Wider for complex charts
        }

        return 1; // Default span
    }

    private async generateContextualInsights(charts: any[], request: EnhancedDashboardDto): Promise<string[]> {
        const insights = [];
        const requirements = request.requirements;

        // Context-aware insights based on analysis type
        switch (requirements.analysisType) {
            case 'performance':
                insights.push('Performance metrics show key business indicators');
                break;
            case 'trend':
                insights.push('Trend analysis reveals patterns over time');
                break;
            case 'comparison':
                insights.push('Comparative analysis highlights differences between segments');
                break;
        }

        // Audience-specific insights
        if (requirements.context.audience === 'executive') {
            insights.push('Dashboard optimized for executive decision making');
        } else if (requirements.context.audience === 'analyst') {
            insights.push('Detailed metrics provided for analytical deep-dive');
        }

        // Add chart-specific insights
        const chartTypes = [...new Set(charts.map(c => c.chartType))];
        if (chartTypes.length > 2) {
            insights.push(`Multiple visualization types (${chartTypes.join(', ')}) provide comprehensive view`);
        }

        return insights.slice(0, 4); // Limit to 4 insights
    }

    private generateCacheKey(request: DashboardDto): string {
        return `${request.prompt}_${request.maxCharts}_${request.dateRange}`;
    }

    private generateEnhancedCacheKey(request: EnhancedDashboardDto): string {
        return `${request.prompt}_${request.requirements.visualization.maxCharts}_${JSON.stringify(request.requirements.dataScope.timeRange)}_${JSON.stringify(request.requirements.dataScope.metrics.sort())}`;
    }
} 