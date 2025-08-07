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
        const relationships = dataAnalysis.metricRelationships || [];

        // Filter out scalar metrics for dashboards - they don't visualize well as charts
        const visualizableMetrics = allMetrics.filter((m: MetricInfo) =>
            m.type !== 'scalar'
        );

        // Find primary metric mentioned in prompt
        const primaryMetric = this.dataAnalysisService.findBestMetricMatch(prompt, visualizableMetrics);
        const relatedMetrics = [primaryMetric].filter(Boolean);

        console.log(`🔍 Dashboard Debug - Primary metric for "${prompt}":`, primaryMetric?.name || 'None found');

        // Use metric relationships to find intelligently related metrics
        if (primaryMetric) {
            const relationship = relationships.find((r: any) => r.primaryMetric === primaryMetric.name);
            if (relationship) {
                // Add related metrics based on business relationships, prioritizing by strength
                const sortedRelated = relationship.relatedMetrics
                    .sort((a: any, b: any) => b.strength - a.strength)
                    .slice(0, maxCharts - 1);

                for (const related of sortedRelated) {
                    const relatedMetricInfo = visualizableMetrics.find((m: MetricInfo) =>
                        m.name === related.metric);
                    if (relatedMetricInfo) {
                        relatedMetrics.push(relatedMetricInfo);
                    }
                }
            }
        }

        // Enhanced business context analysis with relationship awareness
        if (promptLower.includes('performance') || promptLower.includes('overview') || promptLower.includes('dashboard')) {
            // Find performance-related metric clusters
            const performanceMetrics = this.findMetricClusters(visualizableMetrics, relationships, 'performance');
            relatedMetrics.push(...performanceMetrics.slice(0, Math.max(1, maxCharts - relatedMetrics.length)));
        }

        if (promptLower.includes('sales') || promptLower.includes('revenue')) {
            const salesMetrics = this.findMetricClusters(visualizableMetrics, relationships, 'sales');
            console.log(`🔍 Dashboard Debug - Sales metrics found:`, salesMetrics.map(m => m.name));
            relatedMetrics.push(...salesMetrics.slice(0, Math.max(1, maxCharts - relatedMetrics.length)));
        }

        if (promptLower.includes('financial') || promptLower.includes('cash')) {
            const financialMetrics = this.findMetricClusters(visualizableMetrics, relationships, 'financial');
            relatedMetrics.push(...financialMetrics.slice(0, Math.max(1, maxCharts - relatedMetrics.length)));
        }

        // If we still don't have enough metrics, add high-quality metrics with business relevance
        if (relatedMetrics.length < maxCharts) {
            const qualityMetrics = this.selectHighQualityMetrics(visualizableMetrics, dataAnalysis.dataQuality, prompt);
            console.log(`🔍 Dashboard Debug - Quality metrics selected:`, qualityMetrics.slice(0, maxCharts - relatedMetrics.length).map(m => m.name));
            console.log(`🔍 Dashboard Debug - Quality metrics with scores:`, qualityMetrics.slice(0, 5).map(m => ({
                name: m.name,
                businessScore: this.calculateBusinessRelevance(m, prompt),
                techScore: (m.hasTimeData ? 2 : 0) + (m.valueType === 'currency' ? 1 : 0)
            })));
            relatedMetrics.push(...qualityMetrics.slice(0, maxCharts - relatedMetrics.length));
        }

        // Remove duplicates and limit to maxCharts
        const uniqueMetrics = relatedMetrics.filter((metric, index, self) =>
            metric && self.findIndex((m: MetricInfo | null) => m?.name === metric.name) === index
        );

        console.log(`🔍 Dashboard Debug - Final selected metrics:`, uniqueMetrics.map(m => m.name));
        return uniqueMetrics.slice(0, maxCharts);
    }

    /**
 * Find clusters of related metrics based on business context
 */
    private findMetricClusters(metrics: MetricInfo[], relationships: any[], context: string): MetricInfo[] {
        const clusters: MetricInfo[] = [];

        // Context-specific metric selection
        const contextKeywords = {
            'performance': ['sales', 'revenue', 'profit', 'growth', 'performance'],
            'sales': ['sales', 'revenue', 'gross', 'net', 'orders', 'customer'],
            'financial': ['cash', 'profit', 'margin', 'balance', 'expense', 'cost']
        };

        const keywords = contextKeywords[context as keyof typeof contextKeywords] || [];

        // Find metrics that match context keywords
        const contextMetrics = metrics.filter((m: MetricInfo) =>
            keywords.some(keyword => m.name.toLowerCase().includes(keyword))
        );

        // For each context metric, find its strongest relationships
        for (const metric of contextMetrics) {
            const relationship = relationships.find((r: any) => r.primaryMetric === metric.name);
            if (relationship) {
                // Add the primary metric
                clusters.push(metric);

                // Add strongly related metrics (strength > 0.7)
                const strongRelations = relationship.relatedMetrics
                    .filter((r: any) => r.strength > 0.7)
                    .slice(0, 2);

                for (const related of strongRelations) {
                    const relatedMetric = metrics.find((m: MetricInfo) => m.name === related.metric);
                    if (relatedMetric && !clusters.find(c => c.name === relatedMetric.name)) {
                        clusters.push(relatedMetric);
                    }
                }
            } else {
                clusters.push(metric);
            }
        }

        return clusters;
    }

    /**
 * Select high-quality metrics based on data quality assessment with business relevance priority
 */
    private selectHighQualityMetrics(metrics: MetricInfo[], dataQuality: any, prompt?: string): MetricInfo[] {
        return metrics
            .filter((m: MetricInfo) => {
                // Filter out metrics with known data quality issues
                const hasIssues = dataQuality.issues.some((issue: string) =>
                    issue.includes(m.name));
                const hasOutliers = dataQuality.outliers.some((outlier: any) =>
                    outlier.metric === m.name);

                return !hasIssues && !hasOutliers;
            })
            .sort((a: MetricInfo, b: MetricInfo) => {
                // Calculate business relevance score
                const aBusinessScore = this.calculateBusinessRelevance(a, prompt);
                const bBusinessScore = this.calculateBusinessRelevance(b, prompt);

                // Calculate technical quality score
                const aTechScore = (a.hasTimeData ? 2 : 0) + (a.valueType === 'currency' ? 1 : 0);
                const bTechScore = (b.hasTimeData ? 2 : 0) + (b.valueType === 'currency' ? 1 : 0);

                // Prioritize business relevance heavily, then technical quality
                const aTotal = (aBusinessScore * 10) + aTechScore;
                const bTotal = (bBusinessScore * 10) + bTechScore;

                return bTotal - aTotal;
            });
    }

    /**
 * Calculate business relevance score for a metric based on prompt context
 */
    private calculateBusinessRelevance(metric: MetricInfo, prompt?: string): number {
        if (!prompt) return 0;

        const promptLower = prompt.toLowerCase();
        const metricNameLower = metric.name.toLowerCase();
        let score = 0;

        // Enhanced business domain mapping with context awareness
        const businessDomains = {
            'sales': {
                keywords: ['sales', 'revenue', 'gross', 'net', 'income'],
                related: ['orders', 'customer', 'growth'],
                score: 5
            },
            'orders': {
                keywords: ['orders', 'order', 'count', 'volume', 'quantity'],
                related: ['sales', 'customer', 'fulfillment'],
                score: 5
            },
            'customer': {
                keywords: ['customer', 'user', 'client', 'acquisition'],
                related: ['sales', 'orders', 'retention'],
                score: 4
            },
            'financial': {
                keywords: ['profit', 'margin', 'income', 'expense', 'cost'],
                related: ['sales', 'cash', 'balance'],
                score: 4
            },
            'cash': {
                keywords: ['cash', 'balance', 'flow', 'liquidity'],
                related: ['financial', 'profit', 'expense'],
                score: 3
            },
            'performance': {
                keywords: ['growth', 'rate', 'performance', 'kpi', 'trend'],
                related: ['sales', 'orders', 'customer'],
                score: 4
            },
            'inventory': {
                keywords: ['inventory', 'stock', 'product', 'supply'],
                related: ['orders', 'sales', 'fulfillment'],
                score: 3
            }
        };

        // Calculate domain relevance scores
        const domainScores: { [domain: string]: number } = {};

        for (const [domain, config] of Object.entries(businessDomains)) {
            let domainScore = 0;

            // Check if prompt mentions this domain
            const promptHasDomain = config.keywords.some(keyword => promptLower.includes(keyword));
            const promptHasRelated = config.related.some(related => promptLower.includes(related));

            // Check if metric belongs to this domain
            const metricHasDomain = config.keywords.some(keyword => metricNameLower.includes(keyword));
            const metricHasRelated = config.related.some(related => metricNameLower.includes(related));

            if (promptHasDomain && metricHasDomain) {
                // Direct domain match - highest score
                domainScore = config.score;
            } else if (promptHasDomain && metricHasRelated) {
                // Related domain match - good score
                domainScore = config.score * 0.7;
            } else if (promptHasRelated && metricHasDomain) {
                // Cross-domain relationship - moderate score
                domainScore = config.score * 0.5;
            } else if (metricHasDomain && !promptHasDomain && !promptHasRelated) {
                // Metric in domain but not mentioned in prompt - lower score
                domainScore = config.score * 0.2;
            }

            domainScores[domain] = domainScore;
        }

        // Take the highest domain score
        score = Math.max(...Object.values(domainScores));

        // Context-specific adjustments
        if (promptLower.includes('trend') || promptLower.includes('analysis') || promptLower.includes('over time')) {
            // Boost time series metrics for trend analysis
            if (metric.hasTimeData) {
                score += 1;
            }
        }

        if (promptLower.includes('comparison') || promptLower.includes('vs') || promptLower.includes('versus')) {
            // Boost categorical metrics for comparisons
            if (metric.hasGrouping) {
                score += 1;
            }
        }

        // Debug logging for troubleshooting
        if (score > 0 || metricNameLower.includes('cash')) {
            console.log(`🔍 Business Relevance Debug - Metric: ${metric.name}, Prompt: "${prompt}", Score: ${score}, Domains:`,
                Object.entries(domainScores).filter(([_, s]) => s > 0).map(([d, s]) => `${d}:${s}`).join(', '));
        }

        return Math.max(0, score);
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