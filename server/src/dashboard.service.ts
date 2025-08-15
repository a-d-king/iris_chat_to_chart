import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './data/metrics.service';
import { MetricInfo } from './data/data-analysis.service';
import { ReasoningService } from './reasoning.service';
import { DashboardDto, DashboardChartDto } from './dto/chat.dto';
import { runDashboardGraph } from './dashboard.graph';
import { EcommerceSemanticService } from './semantic/ecommerce-semantic.service';

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
 * Primary dashboard generation service with built-in deduplication
 */
@Injectable()
export class DashboardService {
    constructor(
        private openAiService: OpenAiService,
        private metricsService: MetricsService,
        private reasoningService: ReasoningService,
        private ecommerceSemantic: EcommerceSemanticService
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
        // Filter out scalar metrics for dashboards - need system to handle in future
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

            const spec = await this.openAiService.prompt(metricPrompt, dataAnalysis);
            specs.push({
                ...spec,
                title: this.generateChartTitle(metric.name, spec.chartType),
                dateRange: request.dateRange || spec.dateRange
            });
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

        try {
            // 1. Analyze the original prompt for user intent
            const intentAnalysis = this.reasoningService['intentAnalyzer']?.performIntentAnalysis(originalPrompt);

            // 2. Generate semantic business insights using ecommerce domain knowledge
            const semanticInsights = await this.generateSemanticBusinessInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...semanticInsights);

            // 3. Generate AI-powered contextual insights
            const aiInsights = await this.generateAIContextualInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...aiInsights);

            // 4. Add domain-specific financial insights
            const domainInsights = this.generateFinancialDomainInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...domainInsights);

            // 5. Add chart composition insights that reference the original intent
            const compositionInsights = this.generateSmartCompositionInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...compositionInsights);

        } catch (error) {
            console.warn('Enhanced insights generation failed:', error);
        }

        // Prioritize and limit to top 3 insights
        return this.prioritizeInsights(insights, originalPrompt).slice(0, 3);
    }

    /**
     * Generate semantic business insights using ecommerce domain knowledge
     */
    private async generateSemanticBusinessInsights(charts: any[], originalPrompt: string, intentAnalysis?: any): Promise<string[]> {
        const insights: string[] = [];

        try {
            // Extract metrics from charts
            const chartMetrics: MetricInfo[] = charts.map(chart => ({
                name: chart.metric,
                type: chart.type || 'unknown',
                description: chart.title || chart.metric,
                hasTimeData: chart.chartType === 'line',
                hasGrouping: chart.chartType === 'bar' || chart.chartType === 'stacked-bar',
                valueType: 'generic',
                chartRecommendations: [],
                semanticCategory: this.inferSemanticCategory(chart.metric),
                isBusinessKPI: this.isBusinessKPI(chart.metric)
            }));

            // Get semantic context for the dashboard
            const mockDataAnalysis = { availableMetrics: chartMetrics, suggestedChartTypes: [], dataContext: '' };
            const semanticContext = this.ecommerceSemantic.getSemanticContextForQuery(originalPrompt, mockDataAnalysis);

            // Generate domain-specific insights
            if (semanticContext.enrichment && semanticContext.enrichment.businessInsights) {
                insights.push(...semanticContext.enrichment.businessInsights.slice(0, 2));
            }

            // Generate metric-specific business insights
            const categoryInsights = this.generateCategorySpecificInsights(chartMetrics, originalPrompt);
            insights.push(...categoryInsights);

            // Generate strategic insights based on metric combinations
            const strategicInsights = this.generateStrategicDashboardInsights(chartMetrics, originalPrompt);
            insights.push(...strategicInsights);

        } catch (error) {
            console.warn('Semantic insights generation failed:', error);
        }

        return insights;
    }

    /**
     * Generate category-specific business insights
     */
    private generateCategorySpecificInsights(metrics: MetricInfo[], prompt: string): string[] {
        const insights: string[] = [];
        const promptLower = prompt.toLowerCase();

        // Group metrics by semantic category
        const categoryGroups = metrics.reduce((acc, metric) => {
            const category = metric.semanticCategory || 'Operational';
            if (!acc[category]) acc[category] = [];
            acc[category].push(metric);
            return acc;
        }, {} as Record<string, MetricInfo[]>);

        // Generate insights for each category
        Object.entries(categoryGroups).forEach(([category, categoryMetrics]) => {
            switch (category) {
                case 'Sales':
                    if (categoryMetrics.length > 0) {
                        insights.push('Revenue metrics reveal growth patterns and market performance - track velocity and seasonal trends for forecasting');
                    }
                    break;
                case 'Profitability':
                    if (categoryMetrics.length > 0) {
                        insights.push('Profitability analysis identifies margin optimization opportunities and cost efficiency improvements');
                    }
                    break;
                case 'Marketing':
                    if (categoryMetrics.length > 0) {
                        insights.push('Marketing performance metrics guide budget allocation and channel optimization for maximum ROI');
                    }
                    break;
                case 'Unit Economics':
                    if (categoryMetrics.length > 0) {
                        insights.push('Unit economics dashboard tracks customer acquisition efficiency and lifetime value optimization');
                    }
                    break;
                case 'Cash Flow':
                    if (categoryMetrics.length > 0) {
                        insights.push('Cash flow monitoring ensures operational sustainability and identifies liquidity patterns');
                    }
                    break;
            }
        });

        return insights;
    }

    /**
     * Generate strategic insights based on metric combinations
     */
    private generateStrategicDashboardInsights(metrics: MetricInfo[], prompt: string): string[] {
        const insights: string[] = [];
        const promptLower = prompt.toLowerCase();

        const categories = new Set(metrics.map(m => m.semanticCategory).filter(Boolean));
        const kpiCount = metrics.filter(m => m.isBusinessKPI).length;
        const timeSeriesCount = metrics.filter(m => m.hasTimeData).length;

        // Multi-category analysis insights
        if (categories.has('Sales') && categories.has('Marketing')) {
            insights.push('Sales and marketing alignment analysis reveals customer acquisition effectiveness and revenue attribution');
        }

        if (categories.has('Sales') && categories.has('Profitability')) {
            insights.push('Revenue-to-profit analysis identifies pricing strategy effectiveness and operational efficiency opportunities');
        }

        if (categories.has('Unit Economics') && categories.has('Marketing')) {
            insights.push('Customer economics combined with marketing data optimizes acquisition spend and channel performance');
        }

        // Executive vs operational insights
        if (promptLower.includes('executive') || promptLower.includes('overview')) {
            if (kpiCount >= 2) {
                insights.push(`Executive dashboard focuses on ${kpiCount} critical KPIs for strategic decision-making and business performance monitoring`);
            }
        }

        // Time-based analysis insights
        if (timeSeriesCount >= 2) {
            insights.push('Time-series analysis reveals business momentum, seasonal patterns, and trend correlations across key metrics');
        }

        // Comprehensive business health insight
        if (categories.size >= 3) {
            insights.push('Multi-dimensional business analysis provides 360-degree view of operational performance and growth drivers');
        }

        return insights;
    }

    /**
     * Infer semantic category from metric name
     */
    private inferSemanticCategory(metricName: string): string {
        const name = metricName.toLowerCase();
        
        if (name.includes('sales') || name.includes('revenue')) return 'Sales';
        if (name.includes('profit') || name.includes('margin')) return 'Profitability';
        if (name.includes('cost') || name.includes('cogs')) return 'COGS';
        if (name.includes('marketing') || name.includes('ad')) return 'Marketing';
        if (name.includes('cash') || name.includes('balance')) return 'Cash Flow';
        if (name.includes('customer') || name.includes('aov') || name.includes('cac')) return 'Unit Economics';
        
        return 'Operational';
    }

    /**
     * Determine if metric is a business KPI
     */
    private isBusinessKPI(metricName: string): boolean {
        const name = metricName.toLowerCase();
        const kpiTerms = ['revenue', 'profit', 'margin', 'cac', 'ltv', 'aov', 'roas', 'cash', 'runway'];
        return kpiTerms.some(term => name.includes(term));
    }

    private async generateAIContextualInsights(charts: any[], originalPrompt: string, intentAnalysis?: any): Promise<string[]> {
        try {
            const chartSummary = charts.map(c => `${c.title || c.metric} (${c.chartType})`).join(', ');

            // Create a focused prompt for business insight generation
            const systemPrompt = `You are a business intelligence analyst. Given a user's question and the charts generated, provide 1-2 brief, actionable business insights that would help a finance manager make decisions.

User asked: "${originalPrompt}"
Charts generated: ${chartSummary}

Focus on what these charts reveal together and what actions the user should consider. Keep insights concise (under 15 words each) and business-focused.

Respond in this format:
- [Insight 1]
- [Insight 2]`;

            const response = await this.openAiService.prompt(systemPrompt, await this.metricsService.getDataAnalysis());

            // Extract insights from AI response - look for bullet points or numbered lists
            if (response.aiReasoning) {
                const insightMatches = response.aiReasoning.match(/[-•]\s*(.+)/g);
                if (insightMatches) {
                    return insightMatches.map((match: string) => match.replace(/^[-•]\s*/, '').trim()).slice(0, 2);
                }
            }
        } catch (error) {
            console.warn('AI contextual insights failed:', error);
        }
        return [];
    }

    private generateFinancialDomainInsights(charts: any[], originalPrompt: string, intentAnalysis?: any): string[] {
        const insights = [];
        const metrics = charts.map(c => c.metric || '');
        const promptLower = originalPrompt.toLowerCase();

        // Sales channel insights
        const salesChannelCharts = charts.filter(c =>
            c.metric?.includes('salesChannels') || c.metric?.includes('connector') || c.metric?.includes('Channels')
        );
        if (salesChannelCharts.length > 1) {
            insights.push('Cross-channel performance comparison enables optimization opportunities');
        }

        // Revenue and performance insights
        const hasRevenue = metrics.some(m => m.includes('sales') || m.includes('revenue') || m.includes('Sales'));
        const hasProfit = metrics.some(m => m.includes('profit') || m.includes('margin') || m.includes('Profit'));
        if (hasRevenue && hasProfit) {
            insights.push('Revenue and profitability analysis provides complete financial health picture');
        }

        // DTC vs Wholesale business model insights
        const hasDTC = metrics.some(m => m.includes('DTC'));
        const hasWholesale = metrics.some(m => m.includes('Wholesale'));
        if (hasDTC && hasWholesale) {
            insights.push('Direct-to-consumer vs wholesale mix analysis reveals channel strategy effectiveness');
        }

        // Time-based insights for financial planning
        if (intentAnalysis?.primaryIntent?.type === 'temporal_trend' || promptLower.includes('trend') || promptLower.includes('over time')) {
            const timeSeriesCharts = charts.filter(c => c.chartType === 'line');
            if (timeSeriesCharts.length > 0) {
                insights.push('Temporal patterns support forecasting and seasonal planning decisions');
            }
        }

        // Performance comparison insights
        if (intentAnalysis?.primaryIntent?.type === 'performance_overview' || promptLower.includes('performance') || promptLower.includes('overview')) {
            insights.push('Performance overview enables identification of underperforming segments');
        }

        return insights;
    }

    private generateSmartCompositionInsights(charts: any[], originalPrompt: string, intentAnalysis?: any): string[] {
        const insights = [];
        const chartTypes = [...new Set(charts.map(c => c.chartType))];
        const promptLower = originalPrompt.toLowerCase();

        // Smart chart type combination insights
        const hasTimeSeries = charts.some(c => c.chartType === 'line');
        const hasComparison = charts.some(c => c.chartType === 'bar' || c.chartType === 'stacked-bar');
        const hasBreakdown = charts.some(c => c.chartType === 'stacked-bar');

        if (hasTimeSeries && hasComparison) {
            if (promptLower.includes('trend') || promptLower.includes('compare')) {
                insights.push('Trend and comparison charts together reveal both patterns and relative performance');
            } else {
                insights.push('Combined temporal and categorical analysis provides comprehensive insights');
            }
        }

        if (hasBreakdown && charts.length > 2) {
            insights.push('Multi-dimensional breakdown enables drill-down analysis for targeted decisions');
        }

        // Chart count insights with context
        if (charts.length > 4) {
            insights.push(`Comprehensive ${charts.length}-chart analysis covers multiple business dimensions`);
        } else if (charts.length === 2 && promptLower.includes('compare')) {
            insights.push('Focused comparison analysis enables clear decision-making');
        }

        return insights;
    }



    private prioritizeInsights(insights: string[], originalPrompt: string): string[] {
        const promptLower = originalPrompt.toLowerCase();

        // Score insights based on relevance to original prompt
        const scoredInsights = insights.map(insight => ({
            insight,
            score: this.scoreInsightRelevance(insight, promptLower)
        }));

        // Sort by score and return just the insights
        return scoredInsights
            .sort((a, b) => b.score - a.score)
            .map(item => item.insight);
    }

    private scoreInsightRelevance(insight: string, promptLower: string): number {
        let score = 1; // Base score

        // Boost insights that are business-focused
        if (insight.includes('optimization') || insight.includes('decisions') || insight.includes('opportunities')) {
            score += 2;
        }

        // Boost insights that relate to prompt keywords
        if (promptLower.includes('trend') && insight.includes('trend')) score += 1.5;
        if (promptLower.includes('compare') && insight.includes('comparison')) score += 1.5;
        if (promptLower.includes('performance') && insight.includes('performance')) score += 1.5;
        if (promptLower.includes('channel') && insight.includes('channel')) score += 1.5;

        // Penalize generic insights
        if (insight.startsWith('Generated') || insight.includes('Multiple visualization')) {
            score -= 1;
        }

        // Boost financial domain insights
        if (insight.includes('revenue') || insight.includes('profitability') || insight.includes('financial')) {
            score += 1;
        }

        return score;
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