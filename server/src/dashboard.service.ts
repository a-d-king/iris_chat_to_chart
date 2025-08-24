import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';
import { MetricsService } from './data/metrics.service';
import { MetricInfo } from './data/data-analysis.service';
import { ReasoningService } from './reasoning.service';
import { DashboardDto, DashboardChartDto } from './dto/chat.dto';
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
 * Primary dashboard generation service with built-in deduplication
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
        // Filter out scalar metrics for dashboards - need system to handle in future
        const visualizableMetrics = dataAnalysis.availableMetrics.filter((m: MetricInfo) =>
            m.type !== 'scalar'
        );

        // Step 1: Algorithmic pre-filtering and ranking (existing robust logic)
        const algorithmicAnalysis = this.reasoningService.analyzeAndRankMetrics(
            prompt,
            visualizableMetrics,
            maxCharts * 2 // Get more candidates for AI refinement
        );

        // Log quality issues if any
        if (algorithmicAnalysis.qualityIssues.length > 0) {
            console.log('=== METRIC QUALITY ISSUES ===');
            algorithmicAnalysis.qualityIssues.forEach(issue => {
                console.log(`Metric: ${issue.metric.name}`);
                console.log(`Issues: ${issue.issues.join(', ')} (${issue.severity} severity)`);
            });
            console.log('=== END QUALITY ISSUES ===');
        }

        // Step 2: AI-powered refinement and final selection
        try {
            const aiSelectedMetrics = await this.openAiService.selectOptimalMetrics(
                prompt,
                algorithmicAnalysis.rankedMetrics.slice(0, Math.min(10, maxCharts * 3)), // Top candidates only
                dataAnalysis,
                maxCharts
            );

            // Deduplicate by name (safety check)
            const uniqueMetrics = aiSelectedMetrics.filter((metric, index) =>
                aiSelectedMetrics.findIndex(m => m.name === metric.name) === index
            );

            return uniqueMetrics;

        } catch (error) {
            console.warn('AI metric selection failed, using algorithmic fallback:', error);

            // Fallback to original algorithmic selection
            const metrics = algorithmicAnalysis.rankedMetrics.map(ranked => ranked.metric);
            const uniqueMetrics = metrics.filter((metric, index) =>
                metrics.findIndex(m => m.name === metric.name) === index
            );

            return uniqueMetrics;
        }
    }

    public async generateChartSpecs(request: DashboardDto, metrics: MetricInfo[], dataAnalysis: any): Promise<any[]> {
        const specs = [];

        // Leverage existing intent analysis from reasoning service
        const intentAnalysis = this.reasoningService['intentAnalyzer']?.performIntentAnalysis(request.prompt);

        for (const metric of metrics) {
            // Create context-aware prompt using existing intent analysis
            const metricPrompt = this.buildContextAwarePrompt(request.prompt, metric, intentAnalysis);

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

    /**
 * Build context-aware prompts leveraging existing intent analysis and confidence evidence
 */
    private buildContextAwarePrompt(originalPrompt: string, metric: MetricInfo, intentAnalysis: any): string {
        const metricDisplayName = metric.businessName || metric.displayName || metric.name;
        const promptLower = originalPrompt.toLowerCase();

        // Base prompt with user context
        let prompt = `Based on the user's request: "${originalPrompt}"\n\nCreate a chart for "${metricDisplayName}" that helps answer their question.\n\n`;

        // Add intent-based guidance using existing analysis
        if (intentAnalysis?.primaryIntent?.type === 'temporal_trend') {
            prompt += 'Focus on trends, patterns, and changes over time. Prioritize time-based visualizations. ';
        } else if (intentAnalysis?.primaryIntent?.type === 'categorical_comparison') {
            prompt += 'Focus on comparisons and identifying top performers. Emphasize clear categorical distinctions. ';
        } else if (intentAnalysis?.primaryIntent?.type === 'performance_overview') {
            prompt += 'Focus on key performance indicators and overview metrics. Highlight actionable insights. ';
        } else if (intentAnalysis?.primaryIntent?.type === 'compositional_breakdown') {
            prompt += 'Focus on composition and part-to-whole relationships. Show how components contribute. ';
        }

        // Add confidence-based guidance
        if (intentAnalysis?.confidence > 0.8) {
            prompt += 'User intent is very clear - align closely with their specific analytical goals. ';
        } else if (intentAnalysis?.confidence < 0.5) {
            prompt += 'User intent is somewhat ambiguous - choose the most generally useful visualization. ';
        }

        // Add metric-specific context
        if (promptLower.includes(metric.name.toLowerCase()) ||
            promptLower.includes(metricDisplayName.toLowerCase())) {
            prompt += 'This metric was specifically mentioned - make it central to addressing their request. ';
        }

        prompt += 'Choose the chart type that best serves the user\'s analytical intent and enables actionable decisions, not just the data structure.';

        return prompt;
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

            // 2. Generate AI-powered contextual insights
            const aiInsights = await this.generateAIContextualInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...aiInsights);

            // 3. Add domain-specific financial insights
            const domainInsights = this.generateFinancialDomainInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...domainInsights);

            // 4. Add chart composition insights that reference the original intent
            const compositionInsights = this.generateSmartCompositionInsights(charts, originalPrompt, intentAnalysis);
            insights.push(...compositionInsights);

        } catch (error) {
            console.warn('Enhanced insights generation failed:', error);
        }

        // Prioritize and limit to top 3 insights
        return this.prioritizeInsights(insights, originalPrompt).slice(0, 3);
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