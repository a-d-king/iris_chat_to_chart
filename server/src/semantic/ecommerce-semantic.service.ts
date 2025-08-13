import { Injectable, Logger } from '@nestjs/common';
import { MetricDefinition, SemanticContext, MetricRelationship } from './interfaces/metric-definition.interface';
import { EnhancedSemanticContext, SuggestedMetric, DomainContext, AnalysisEnrichment, MetricCombination } from './interfaces/semantic-context.interface';
import { DataAnalysis, MetricInfo } from '../data/data-analysis.service';
import { MetricDefinitionRegistry } from './metric-definition.registry';
import { BusinessContextService } from './business-context.service';

/**
 * Core service for ecommerce semantic layer functionality
 * Provides business domain knowledge and metric understanding
 */
@Injectable()
export class EcommerceSemanticService {
    private readonly logger = new Logger(EcommerceSemanticService.name);

    constructor(
        private metricRegistry: MetricDefinitionRegistry,
        private businessContext: BusinessContextService
    ) {
        this.logger.log('EcommerceSemanticService initialized with full registry and business context');
    }

    /**
     * Get semantic context for a natural language query
     * @param prompt User's natural language prompt
     * @param dataAnalysis Existing data analysis results
     * @returns Enhanced semantic context
     */
    getSemanticContextForQuery(prompt: string, dataAnalysis: DataAnalysis): EnhancedSemanticContext {
        this.logger.debug(`Generating semantic context for query: "${prompt}"`);

        const suggestedMetrics = this.suggestRelevantMetrics(prompt, dataAnalysis);
        const domainContext = this.analyzeDomainContext(prompt);
        const enrichment = this.enrichDataAnalysis(dataAnalysis, prompt);

        return {
            suggestedMetrics,
            domainContext,
            enrichment
        };
    }

    /**
     * Get business context for a specific metric
     * @param metricName Name or path of the metric
     * @returns Metric definition with business context
     */
    getMetricDefinition(metricName: string): MetricDefinition | null {
        this.logger.debug(`Looking up metric definition for: ${metricName}`);
        return this.metricRegistry.getMetricDefinition(metricName);
    }

    /**
     * Get related metrics for a given metric
     * @param metricName Name of the source metric
     * @returns Array of related metric IDs
     */
    getRelatedMetrics(metricName: string): string[] {
        this.logger.debug(`Finding related metrics for: ${metricName}`);
        const definition = this.metricRegistry.getMetricDefinition(metricName);
        if (!definition) {
            return [];
        }
        return this.metricRegistry.getRelatedMetrics(definition.id);
    }

    /**
     * Check if a term is a known ecommerce metric or business term
     * @param term Term to check
     * @returns Whether the term has semantic meaning
     */
    isBusinessTerm(term: string): boolean {
        // First check if it's a defined metric
        const definition = this.metricRegistry.getMetricDefinition(term);
        if (definition) {
            return true;
        }

        // Search for partial matches in metric names and aliases
        const searchResults = this.metricRegistry.searchMetrics(term, 1);
        if (searchResults.length > 0) {
            return true;
        }

        // Check against domain terminology
        const semanticContext = this.metricRegistry.getSemanticContext();
        const terminology = semanticContext.domainKnowledge.terminology;
        
        return Object.keys(terminology).some(knownTerm => 
            term.toLowerCase().includes(knownTerm.toLowerCase()) ||
            knownTerm.toLowerCase().includes(term.toLowerCase())
        );
    }

    /**
     * Suggest metrics based on natural language query using full semantic registry
     */
    private suggestRelevantMetrics(prompt: string, dataAnalysis: DataAnalysis): SuggestedMetric[] {
        const promptLower = prompt.toLowerCase();
        const suggestions: SuggestedMetric[] = [];

        // Get all defined metrics from registry
        const allMetrics = this.metricRegistry.getAllMetrics();
        
        // Score each metric based on relevance to the prompt
        for (const metricDef of allMetrics) {
            let relevanceScore = 0;
            const reasoning: string[] = [];

            // Check for exact name match
            if (promptLower.includes(metricDef.name.toLowerCase())) {
                relevanceScore += 1.0;
                reasoning.push('Direct metric name match');
            }

            // Check for alias matches
            for (const alias of metricDef.aliases) {
                if (promptLower.includes(alias.toLowerCase())) {
                    relevanceScore += 0.9;
                    reasoning.push(`Matches alias: ${alias}`);
                }
            }

            // Check for category relevance
            if (promptLower.includes(metricDef.category)) {
                relevanceScore += 0.5;
                reasoning.push(`Relates to ${metricDef.category} category`);
            }

            // Check for subcategory relevance
            if (metricDef.subcategory && promptLower.includes(metricDef.subcategory)) {
                relevanceScore += 0.4;
                reasoning.push(`Matches subcategory: ${metricDef.subcategory}`);
            }

            // Check for use case relevance
            for (const useCase of metricDef.businessContext.useCase) {
                if (promptLower.includes(useCase.toLowerCase())) {
                    relevanceScore += 0.3;
                    reasoning.push(`Relevant for: ${useCase}`);
                }
            }

            // Check for business context keywords
            for (const insight of metricDef.businessContext.keyInsights) {
                const insightWords = insight.toLowerCase().split(' ');
                if (insightWords.some(word => promptLower.includes(word) && word.length > 3)) {
                    relevanceScore += 0.2;
                    reasoning.push(`Provides insight: ${insight}`);
                }
            }

            // Check if metric exists in available data
            const dataMetric = dataAnalysis.availableMetrics.find(m => 
                m.name.toLowerCase().includes(metricDef.name.toLowerCase()) ||
                metricDef.aliases.some(alias => m.name.toLowerCase().includes(alias.toLowerCase()))
            );

            if (dataMetric) {
                relevanceScore += 0.8;
                reasoning.push('Available in current dataset');
            } else {
                relevanceScore *= 0.3; // Significantly reduce score if not available
                reasoning.push('Not available in current dataset');
            }

            if (relevanceScore > 0.3) {
                // Get related metrics for additional context
                const relatedMetrics = this.metricRegistry.getRelatedMetrics(metricDef.id);
                
                suggestions.push({
                    metric: metricDef,
                    relevanceScore,
                    reasoning,
                    confidence: Math.min(relevanceScore, 0.95),
                    relatedSuggestions: relatedMetrics.slice(0, 3) // Top 3 related metrics
                });
            }
        }

        return suggestions
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 8); // Return top 8 suggestions
    }

    /**
     * Analyze domain context from the query
     */
    private analyzeDomainContext(prompt: string): DomainContext {
        const promptLower = prompt.toLowerCase();
        let primaryDomain = 'general';
        const secondaryDomains: string[] = [];
        const businessQuestions: string[] = [];
        const analysisApproaches: string[] = [];

        // Determine primary domain
        if (promptLower.includes('sales') || promptLower.includes('revenue')) {
            primaryDomain = 'sales_performance';
            businessQuestions.push('How are sales performing?', 'What are the revenue trends?');
            analysisApproaches.push('trend analysis', 'period comparison');
        } else if (promptLower.includes('profit') || promptLower.includes('margin')) {
            primaryDomain = 'profitability';
            businessQuestions.push('What is our profitability?', 'Where can we improve margins?');
            analysisApproaches.push('margin analysis', 'cost breakdown');
        } else if (promptLower.includes('customer') || promptLower.includes('cac') || promptLower.includes('ltv')) {
            primaryDomain = 'customer_analytics';
            businessQuestions.push('How are we acquiring customers?', 'What is customer lifetime value?');
            analysisApproaches.push('cohort analysis', 'customer segmentation');
        } else if (promptLower.includes('marketing') || promptLower.includes('roas') || promptLower.includes('ad')) {
            primaryDomain = 'marketing_performance';
            businessQuestions.push('How effective is our marketing?', 'What is our ROAS?');
            analysisApproaches.push('channel analysis', 'campaign performance');
        }

        return {
            primaryDomain,
            secondaryDomains,
            businessQuestions,
            analysisApproaches,
            relevantBenchmarks: {}
        };
    }

    /**
     * Enrich existing data analysis with semantic context
     */
    private enrichDataAnalysis(dataAnalysis: DataAnalysis, prompt: string): AnalysisEnrichment {
        const metricDescriptions: Record<string, string> = {};
        const metricContext: Record<string, any> = {};
        const suggestedCombinations: MetricCombination[] = [];

        // Enhance metric descriptions with business context
        for (const metric of dataAnalysis.availableMetrics) {
            const definition = this.metricRegistry.getMetricDefinition(metric.name);
            
            if (definition) {
                // Use full semantic definition
                metricDescriptions[metric.name] = definition.description;
                metricContext[metric.name] = {
                    businessMeaning: definition.businessContext.interpretation,
                    interpretationGuidance: definition.businessContext.interpretation,
                    actionableInsights: definition.businessContext.keyInsights.slice(0, 3),
                    warnings: []
                };
            } else {
                // Fallback for metrics not in registry
                metricDescriptions[metric.name] = this.enhanceMetricDescription(metric);
                metricContext[metric.name] = {
                    businessMeaning: this.getBusinessMeaning(metric),
                    interpretationGuidance: `${metric.description} - analyze trends and patterns`,
                    actionableInsights: [`Monitor ${metric.name} performance`, `Compare ${metric.name} across periods`],
                    warnings: []
                };
            }
        }

        // Get relevant analysis patterns for metric combinations
        const availableMetricNames = dataAnalysis.availableMetrics.map(m => m.name);
        const relevantPatterns = this.businessContext.getRelevantAnalysisPatterns(availableMetricNames);
        
        // Convert analysis patterns to metric combinations
        for (const pattern of relevantPatterns.slice(0, 3)) { // Top 3 patterns
            suggestedCombinations.push({
                metrics: pattern.requiredMetrics,
                insight: pattern.description,
                visualizationApproach: pattern.visualization.join(' or '),
                businessValue: pattern.useCase
            });
        }

        // Generate comprehensive business insights
        const businessInsights = this.generateComprehensiveBusinessInsights(dataAnalysis.availableMetrics, prompt);
        
        // Get contextual benchmark data
        const benchmarkContext = this.getContextualBenchmarkData(dataAnalysis.availableMetrics, prompt);

        return {
            metricDescriptions,
            metricContext,
            suggestedCombinations,
            businessInsights,
            benchmarkContext,
            qualityInsights: [] // Will be populated by business validation
        };
    }

    /**
     * Infer metric category from name
     */
    private inferCategory(metricName: string): any {
        const nameLower = metricName.toLowerCase();
        
        if (nameLower.includes('sales') || nameLower.includes('revenue')) return 'sales';
        if (nameLower.includes('cost') || nameLower.includes('cogs')) return 'cogs';
        if (nameLower.includes('profit') || nameLower.includes('margin')) return 'profitability';
        if (nameLower.includes('customer') || nameLower.includes('order')) return 'quantities';
        if (nameLower.includes('marketing') || nameLower.includes('ad')) return 'marketing';
        if (nameLower.includes('cash') || nameLower.includes('balance')) return 'cash_flow';
        
        return 'operations';
    }

    /**
     * Enhance metric description with business context
     */
    private enhanceMetricDescription(metric: MetricInfo): string {
        let enhanced = metric.description;
        
        if (this.isBusinessTerm(metric.name)) {
            enhanced += ' (Business KPI)';
        }
        
        if (metric.hasTimeData) {
            enhanced += ' - Supports trend analysis';
        }
        
        if (metric.hasGrouping) {
            enhanced += ' - Can be broken down by categories';
        }

        return enhanced;
    }

    /**
     * Get business meaning for a metric
     */
    private getBusinessMeaning(metric: MetricInfo): string {
        const category = this.inferCategory(metric.name);
        
        switch (category) {
            case 'sales':
                return 'Indicates revenue generation and sales performance';
            case 'profitability':
                return 'Shows business profitability and efficiency';
            case 'quantities':
                return 'Measures business volume and scale';
            case 'marketing':
                return 'Reflects marketing effectiveness and ROI';
            default:
                return 'Provides operational business insights';
        }
    }

    /**
     * Generate comprehensive business insights based on available metrics and query context
     */
    private generateComprehensiveBusinessInsights(metrics: MetricInfo[], prompt: string): string[] {
        const insights: string[] = [];
        const promptLower = prompt.toLowerCase();

        // Categorize available metrics
        const metricsByCategory = this.categorizeMetricsByBusinessDomain(metrics);

        // Revenue Performance Insights
        if (metricsByCategory.sales.length > 0) {
            if (promptLower.includes('trend') || promptLower.includes('growth')) {
                insights.push('Revenue trend analysis will reveal growth patterns and seasonal variations critical for forecasting');
            }
            if (promptLower.includes('compare') || promptLower.includes('channel')) {
                insights.push('Sales comparison across channels/products can identify top performers and optimization opportunities');
            }
            if (metricsByCategory.sales.some(m => m.hasTimeData)) {
                insights.push('Time-series sales data enables identification of growth trends, seasonal patterns, and revenue velocity');
            }
        }

        // Profitability Insights
        if (metricsByCategory.profitability.length > 0 && metricsByCategory.costs.length > 0) {
            insights.push('Profit margin analysis combined with cost data reveals operational efficiency and pricing strategy effectiveness');
            insights.push('Waterfall analysis from revenue to net profit will show the impact of each cost component on bottom line');
        }

        // Unit Economics Insights
        if (metricsByCategory.unitEconomics.length > 0) {
            insights.push('Unit economics metrics (AOV, CAC, LTV) are fundamental for evaluating business model sustainability');
            if (promptLower.includes('efficiency') || promptLower.includes('performance')) {
                insights.push('Customer acquisition efficiency can be measured by tracking CAC trends against LTV ratios');
            }
        }

        // Marketing Performance Insights
        if (metricsByCategory.marketing.length > 0) {
            insights.push('Marketing metrics analysis will reveal channel effectiveness and budget allocation optimization opportunities');
            if (metricsByCategory.marketing.some(m => m.hasGrouping)) {
                insights.push('Channel-level marketing performance comparison identifies highest ROI acquisition sources');
            }
        }

        // Cash Flow Insights
        if (metricsByCategory.cashFlow.length > 0) {
            insights.push('Cash flow analysis is critical for understanding business liquidity and operational financial health');
            if (promptLower.includes('runway') || promptLower.includes('burn')) {
                insights.push('Burn rate and runway metrics are essential for growth stage companies to monitor sustainability');
            }
        }

        // Cross-Category Business Intelligence
        if (metricsByCategory.sales.length > 0 && metricsByCategory.marketing.length > 0) {
            insights.push('Sales and marketing alignment analysis reveals the effectiveness of marketing spend on revenue generation');
        }

        if (metricsByCategory.sales.length > 0 && metricsByCategory.costs.length > 0) {
            insights.push('Revenue-to-cost analysis enables gross margin optimization and operational efficiency improvements');
        }

        // Query-Specific Insights
        if (promptLower.includes('executive') || promptLower.includes('dashboard') || promptLower.includes('overview')) {
            insights.push('Executive dashboard should focus on KPIs that directly impact strategic decision-making and business outcomes');
        }

        if (promptLower.includes('operational') || promptLower.includes('tactical')) {
            insights.push('Operational analysis should dive into granular metrics that enable day-to-day optimization and process improvement');
        }

        // Business Context Insights
        const kpiCount = metrics.filter(m => m.isBusinessKPI).length;
        if (kpiCount > 0) {
            insights.push(`${kpiCount} critical business KPIs identified - these should be prioritized for decision-making analysis`);
        }

        // Time-based Analysis Insights
        const timeSeriesCount = metrics.filter(m => m.hasTimeData).length;
        if (timeSeriesCount > 0) {
            insights.push(`${timeSeriesCount} time-series metrics available - trend analysis will reveal business momentum and patterns`);
        }

        return insights.slice(0, 8); // Limit to most relevant insights
    }

    /**
     * Categorize metrics by business domain for targeted analysis
     */
    private categorizeMetricsByBusinessDomain(metrics: MetricInfo[]) {
        return {
            sales: metrics.filter(m => 
                m.semanticCategory === 'Sales' || 
                m.name.toLowerCase().includes('revenue') || 
                m.name.toLowerCase().includes('sales')
            ),
            profitability: metrics.filter(m => 
                m.semanticCategory === 'Profitability' || 
                m.name.toLowerCase().includes('profit') || 
                m.name.toLowerCase().includes('margin')
            ),
            costs: metrics.filter(m => 
                m.semanticCategory === 'COGS' || 
                m.name.toLowerCase().includes('cost') || 
                m.name.toLowerCase().includes('expense')
            ),
            unitEconomics: metrics.filter(m => 
                m.semanticCategory === 'Unit Economics' || 
                ['aov', 'cac', 'ltv', 'clv'].some(term => m.name.toLowerCase().includes(term))
            ),
            marketing: metrics.filter(m => 
                m.semanticCategory === 'Marketing' || 
                m.name.toLowerCase().includes('ad') || 
                m.name.toLowerCase().includes('marketing')
            ),
            cashFlow: metrics.filter(m => 
                m.semanticCategory === 'Cash Flow' || 
                m.name.toLowerCase().includes('cash') || 
                m.name.toLowerCase().includes('balance')
            )
        };
    }

    /**
     * Get contextual benchmark data based on available metrics and query
     */
    private getContextualBenchmarkData(metrics: MetricInfo[], prompt: string): string | null {
        const metricsByCategory = this.categorizeMetricsByBusinessDomain(metrics);
        const promptLower = prompt.toLowerCase();

        // E-commerce benchmarks context
        if (metricsByCategory.sales.length > 0 || metricsByCategory.unitEconomics.length > 0) {
            if (promptLower.includes('benchmark') || promptLower.includes('industry') || promptLower.includes('compare')) {
                return 'E-commerce benchmarks: AOV ($65-85), conversion rate (2-3%), CAC:LTV ratio (1:3), gross margin (20-40%). Consider seasonal variations and industry segments.';
            }
        }

        // Marketing benchmarks
        if (metricsByCategory.marketing.length > 0) {
            if (promptLower.includes('roas') || promptLower.includes('cac') || promptLower.includes('marketing')) {
                return 'Marketing benchmarks: ROAS (4:1 minimum), CAC payback period (6-12 months), email marketing CTR (2-3%), paid search CTR (3-5%).';
            }
        }

        // Profitability benchmarks
        if (metricsByCategory.profitability.length > 0) {
            if (promptLower.includes('margin') || promptLower.includes('profit')) {
                return 'Profitability benchmarks: Gross margin (40-60% for SaaS, 20-40% for e-commerce), operating margin (10-20%), net margin (5-15%).';
            }
        }

        // General business health
        if (metricsByCategory.cashFlow.length > 0) {
            return 'Cash flow benchmarks: Positive operating cash flow, 3-6 months runway minimum, working capital efficiency, seasonal cash flow patterns.';
        }

        return null;
    }
}