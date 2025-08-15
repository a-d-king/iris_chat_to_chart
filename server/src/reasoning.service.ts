import { Injectable } from '@nestjs/common';
import { DataAnalysis, MetricInfo } from './data/data-analysis.service';
import { IntentAnalyzerService, IntentAnalysis } from './reasoning/intent-analyzer.service';
import { ChartRankerService, TopKChartsAnalysis, ChartRanking } from './reasoning/chart-ranker.service';
import { ErrorHandlerService } from './common/error-handler.service';
import { EcommerceSemanticService } from './semantic/ecommerce-semantic.service';



/**
 * Interface for reasoning step information
 */
export interface ReasoningStep {
    step: number;
    category: 'prompt_analysis' | 'data_evaluation' | 'chart_selection' | 'metric_selection' | 'final_decision';
    title: string;
    reasoning: string;
    factors: string[];
    confidence: number;
    alternatives?: string[];
    intentAnalysis?: IntentAnalysis;
    chartRankings?: TopKChartsAnalysis;
}

/**
 * Interface for complete reasoning process
 */
export interface ReasoningProcess {
    enabled: boolean;
    steps: ReasoningStep[];
    summary: {
        selectedChart: string;
        selectedMetric: string;
        confidence: number;
        keyFactors: string[];
    };
    metadata: {
        totalSteps: number;
        processingTimeMs: number;
        environmentVariable: string;
    };
}

/**
 * Interfaces for joint metric and chart selection workflow
 */
export interface MetricChartSelection {
    metric: MetricInfo;
    chartType: ChartRanking['chartType'];
    chartAnalysis: TopKChartsAnalysis;
    reasoning: ReasoningProcess;
}

export interface MetricsAndChartsSelection {
    intentAnalysis: IntentAnalysis;
    selections: MetricChartSelection[];
}

/**
 * Service for providing transparent reasoning about chart and data selection decisions
 */
@Injectable()
export class ReasoningService {
    private readonly isEnabled: boolean;

    constructor(
        private intentAnalyzer: IntentAnalyzerService,
        private chartRanker: ChartRankerService,
        private errorHandler: ErrorHandlerService,
        private ecommerceSemantic: EcommerceSemanticService
    ) {
        // Check environment variable for reasoning enablement
        this.isEnabled = process.env.ENABLE_REASONING === 'true';
    }















    /**
     * Comprehensive metric analysis and ranking for dashboards and charts
     */
    analyzeAndRankMetrics(
        prompt: string,
        availableMetrics: MetricInfo[],
        maxMetrics: number = 5
    ): {
        rankedMetrics: { metric: MetricInfo; score: number; reasons: string[]; confidence: number }[];
        qualityIssues: { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }[];
        intentAnalysis: IntentAnalysis;
        diversityInfo: { selectedTypes: string[]; coverage: number };
    } {
        try {
            // Perform intent analysis
            const intentAnalysis = this.intentAnalyzer.performIntentAnalysis(prompt);

            // Score all metrics based on prompt relevance and intent
            const scoredMetrics = this.scoreMetricsForRelevance(prompt, availableMetrics, intentAnalysis);

            // 1: Implement comprehensive data quality analysis
            const qualityIssues = this.analyzeMetricQuality(availableMetrics);

            // 2: Apply business context and domain knowledge
            const businessBoostedMetrics = this.applyBusinessContextBoosts(scoredMetrics, intentAnalysis);

            // 3: Ensure diversity in metric selection
            const diverseMetrics = this.selectDiverseMetrics(businessBoostedMetrics, maxMetrics, intentAnalysis);

            // 4: Calculate confidence scores per metric
            const rankedMetricsWithConfidence = diverseMetrics.map(item => ({
                ...item,
                confidence: this.calculateMetricConfidence(item, intentAnalysis, qualityIssues)
            }));

            // 5: Calculate diversity metrics for transparency
            const diversityInfo = this.calculateDiversityInfo(rankedMetricsWithConfidence);

            return {
                rankedMetrics: rankedMetricsWithConfidence,
                qualityIssues,
                intentAnalysis,
                diversityInfo
            };
        } catch (error) {
            this.errorHandler.handleApiError('metric_analysis', error, {
                operation: 'analyzeAndRankMetrics',
                component: 'ReasoningService'
            });
        }
    }

    /**
     * Enhanced relevance scoring with fuzzy matching and comprehensive intent handling
     */
    private scoreMetricsForRelevance(
        prompt: string,
        metrics: MetricInfo[],
        intentAnalysis: IntentAnalysis
    ): { metric: MetricInfo; score: number; reasons: string[] }[] {
        const promptLower = prompt.toLowerCase();
        const promptWords = promptLower.split(/\s+/);

        return metrics.map(metric => {
            let score = 0;
            const reasons: string[] = [];

            const metricName = metric.name.toLowerCase();
            const metricWords = metricName.split(/[._\s]+/);

            // Enhanced text matching with fuzzy logic
            if (promptLower.includes(metricName)) {
                score += 2.5; // Increased from 2.0
                reasons.push('Direct name match');
            }

            // Improved word-level matching with stemming consideration
            for (const promptWord of promptWords) {
                if (promptWord.length < 3) continue;
                for (const metricWord of metricWords) {
                    if (promptWord === metricWord) {
                        score += 1.8; // Increased from 1.5
                        reasons.push(`Exact word match: ${promptWord}`);
                    } else if (promptWord.includes(metricWord) || metricWord.includes(promptWord)) {
                        score += 1.2; // Increased from 1.0
                        reasons.push(`Partial match: ${promptWord}/${metricWord}`);
                    } else if (this.calculateLevenshteinSimilarity(promptWord, metricWord) > 0.8) {
                        score += 0.8;
                        reasons.push(`Similar word: ${promptWord}~${metricWord}`);
                    }
                }
            }

            // Semantic category matching - new enhancement
            if (metric.semanticCategory) {
                const categoryLower = metric.semanticCategory.toLowerCase();
                if (promptLower.includes(categoryLower)) {
                    score += 1.5;
                    reasons.push(`Semantic category match: ${metric.semanticCategory}`);
                }
                
                // Category-specific keyword matching
                if (this.promptMatchesSemanticCategory(promptLower, metric.semanticCategory)) {
                    score += 1.0;
                    reasons.push(`Business domain relevance: ${metric.semanticCategory}`);
                }
            }

            // Business KPI prioritization
            if (metric.isBusinessKPI) {
                score += 1.3;
                reasons.push('Critical business KPI');
                
                // Extra boost for executive/dashboard queries
                if (promptLower.includes('executive') || promptLower.includes('dashboard') || promptLower.includes('kpi')) {
                    score += 0.5;
                    reasons.push('Executive-level KPI for dashboard');
                }
            }

            // Business context matching
            if (metric.businessContext) {
                const contextWords = metric.businessContext.toLowerCase().split(/\s+/);
                let contextMatches = 0;
                for (const promptWord of promptWords) {
                    if (promptWord.length > 3 && contextWords.includes(promptWord)) {
                        contextMatches++;
                    }
                }
                if (contextMatches > 0) {
                    score += contextMatches * 0.4;
                    reasons.push(`Business context relevance: ${contextMatches} matches`);
                }
            }

            // Enhanced intent-based scoring for all intent types
            const primaryIntent = intentAnalysis.primaryIntent.type;

            switch (primaryIntent) {
                case 'temporal_trend':
                    if (metric.hasTimeData) {
                        score += 1.2;
                        reasons.push('Perfect for temporal analysis');
                    }
                    // Boost for revenue/growth metrics in trend analysis
                    if (metric.semanticCategory === 'Sales' || metric.name.toLowerCase().includes('growth')) {
                        score += 0.6;
                        reasons.push('Revenue metrics ideal for trend analysis');
                    }
                    break;
                case 'categorical_comparison':
                    if (metric.hasGrouping) {
                        score += 1.0;
                        reasons.push('Ideal for categorical comparison');
                    }
                    // Boost for marketing/channel metrics
                    if (metric.semanticCategory === 'Marketing') {
                        score += 0.5;
                        reasons.push('Marketing metrics excel in comparisons');
                    }
                    break;
                case 'compositional_breakdown':
                    if (metric.type === 'embeddedMetrics' || metric.hasGrouping) {
                        score += 1.1;
                        reasons.push('Good for compositional analysis');
                    }
                    // Boost for profitability/cost breakdown
                    if (metric.semanticCategory === 'Profitability' || metric.semanticCategory === 'COGS') {
                        score += 0.7;
                        reasons.push('Financial metrics perfect for breakdown analysis');
                    }
                    break;
                case 'performance_overview':
                    if (metric.valueType === 'percentage' || metric.valueType === 'currency') {
                        score += 0.9;
                        reasons.push('Suitable for performance metrics');
                    }
                    // Prioritize KPIs for overview
                    if (metric.isBusinessKPI) {
                        score += 0.8;
                        reasons.push('Key performance indicator for overview');
                    }
                    break;
                case 'correlation_analysis':
                    if (metric.type === 'timeSeries' && metric.hasTimeData) {
                        score += 1.0;
                        reasons.push('Time series enables correlation analysis');
                    }
                    break;
            }

            // Description and metadata matching
            if (metric.description) {
                const descriptionWords = metric.description.toLowerCase().split(/\s+/);
                for (const promptWord of promptWords) {
                    if (promptWord.length > 3 && descriptionWords.includes(promptWord)) {
                        score += 0.5;
                        reasons.push(`Description match: ${promptWord}`);
                    }
                }
            }

            // Chart recommendation alignment
            if (metric.chartRecommendations.length > 0) {
                score += 0.2;
                reasons.push('Has chart recommendations');
            }

            return { metric, score, reasons };
        });
    }

    /**
     * Comprehensive quality analysis
     */
    private analyzeMetricQuality(metrics: MetricInfo[]): { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }[] {
        return metrics.map(metric => {
            const issues: string[] = [];
            let severity: 'low' | 'medium' | 'high' = 'low';

            // Check for missing temporal data when expected
            if (metric.type === 'timeSeries' && !metric.hasTimeData) {
                issues.push('Marked as time series but missing temporal data');
                severity = 'high';
            }

            // Check grouping dimension quality
            if (metric.hasGrouping && metric.groupingDimensions) {
                const unknownRatio = metric.groupingDimensions.filter(d =>
                    d.toLowerCase().includes('unknown') ||
                    d.toLowerCase().includes('undefined') ||
                    d.toLowerCase().includes('null') ||
                    d.trim() === ''
                ).length / metric.groupingDimensions.length;

                if (unknownRatio > 0.5) {
                    issues.push(`${Math.round(unknownRatio * 100)}% unknown/unlabeled categories`);
                    severity = 'high';
                } else if (unknownRatio > 0.3) {
                    issues.push(`${Math.round(unknownRatio * 100)}% unknown categories`);
                    severity = severity === 'high' ? 'high' : 'medium';
                }

                if (metric.groupingDimensions.length === 1) {
                    issues.push('Only one category - limited grouping value');
                    severity = severity === 'high' ? 'high' : 'medium';
                }

                if (metric.groupingDimensions.length > 12) {
                    issues.push(`Too many categories (${metric.groupingDimensions.length}) for effective visualization`);
                    severity = severity === 'high' ? 'high' : 'medium';
                }
            }

            // Check value type consistency
            if (metric.sampleValues && metric.sampleValues.length > 0) {
                const valueTypes = new Set(metric.sampleValues.map(v => typeof v));
                if (valueTypes.size > 1) {
                    issues.push('Inconsistent value types in sample data');
                    severity = severity === 'high' ? 'high' : 'medium';
                }
            }

            // Check for embedded metrics without proper metadata
            if (metric.type === 'embeddedMetrics' && (!metric.embeddedMetrics || metric.embeddedMetrics.length === 0)) {
                issues.push('Marked as embedded metrics but no embedded metric names provided');
                severity = 'high';
            }

            return { metric, issues, severity };
        }).filter(item => item.issues.length > 0);
    }

    /**
     * Business context and domain knowledge
     */
    private applyBusinessContextBoosts(
        scoredMetrics: { metric: MetricInfo; score: number; reasons: string[] }[],
        intentAnalysis: IntentAnalysis
    ): { metric: MetricInfo; score: number; reasons: string[] }[] {
        return scoredMetrics.map(item => {
            let boostedScore = item.score;
            const newReasons = [...item.reasons];

            // Financial metrics prioritization for finance platform
            const metricName = item.metric.name.toLowerCase();
            if (metricName.includes('revenue') || metricName.includes('profit') ||
                metricName.includes('cost') || metricName.includes('margin')) {
                boostedScore += 0.5;
                newReasons.push('Core financial metric');
            }

            // Time-sensitive data gets priority for temporal queries
            if (intentAnalysis.temporalSignals.length > 0 && item.metric.hasTimeData) {
                const temporalBoost = intentAnalysis.temporalSignals.length * 0.3;
                boostedScore += temporalBoost;
                newReasons.push(`Strong temporal match (${intentAnalysis.temporalSignals.length} signals)`);
            }

            // Value type alignment with intent
            if (intentAnalysis.primaryIntent.type === 'performance_overview' &&
                item.metric.valueType === 'percentage') {
                boostedScore += 0.4;
                newReasons.push('Percentage metrics ideal for performance overview');
            }

            // Penalize overly complex metrics for simple queries
            if (intentAnalysis.confidence > 0.8 &&
                item.metric.type === 'dynamicKeyObject' &&
                intentAnalysis.primaryIntent.type !== 'drill_down') {
                boostedScore -= 0.3;
                newReasons.push('Complex metric may not match simple query intent');
            }

            return { ...item, score: boostedScore, reasons: newReasons };
        });
    }

    /**
     * Diversity-aware selection
     */
    private selectDiverseMetrics(
        scoredMetrics: { metric: MetricInfo; score: number; reasons: string[] }[],
        maxMetrics: number,
        intentAnalysis: IntentAnalysis
    ): { metric: MetricInfo; score: number; reasons: string[] }[] {
        const sortedMetrics = scoredMetrics.sort((a, b) => b.score - a.score);
        const selectedMetrics: typeof sortedMetrics = [];
        const selectedTypes = new Set<string>();
        const selectedValueTypes = new Set<string>();

        for (const metric of sortedMetrics) {
            if (selectedMetrics.length >= maxMetrics) break;

            // Always include the top scorer
            if (selectedMetrics.length === 0) {
                selectedMetrics.push(metric);
                selectedTypes.add(metric.metric.type);
                selectedValueTypes.add(metric.metric.valueType);
                continue;
            }

            // Diversity scoring
            let diversityBonus = 0;

            // Prefer different metric types
            if (!selectedTypes.has(metric.metric.type)) {
                diversityBonus += 0.2;
            }

            // Prefer different value types
            if (!selectedValueTypes.has(metric.metric.valueType)) {
                diversityBonus += 0.1;
            }

            // Apply diversity threshold - only skip if very similar and score difference is small
            const scoreDifference = selectedMetrics[0].score - metric.score;
            const diversityThreshold = 0.15;

            if (diversityBonus > diversityThreshold || scoreDifference < 1.0) {
                selectedMetrics.push({
                    ...metric,
                    score: metric.score + diversityBonus,
                    reasons: [...metric.reasons, ...(diversityBonus > 0 ? ['Adds metric diversity'] : [])]
                });
                selectedTypes.add(metric.metric.type);
                selectedValueTypes.add(metric.metric.valueType);
            }
        }

        return selectedMetrics;
    }

    /**
     * Sophisticated confidence calculation
     */
    private calculateMetricConfidence(
        metricScore: { metric: MetricInfo; score: number; reasons: string[] },
        intentAnalysis: IntentAnalysis,
        qualityIssues: { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }[]
    ): number {
        let confidence = Math.min(0.95, metricScore.score / 5.0); // Normalize score to confidence

        // Boost confidence for high intent alignment
        confidence += intentAnalysis.confidence * 0.1;

        // Reduce confidence for quality issues
        const metricQualityIssue = qualityIssues.find(qi => qi.metric.name === metricScore.metric.name);
        if (metricQualityIssue) {
            const qualityPenalty = metricQualityIssue.severity === 'high' ? 0.3 :
                metricQualityIssue.severity === 'medium' ? 0.15 : 0.05;
            confidence -= qualityPenalty;
        }

        // Boost confidence for metrics with rich metadata
        if (metricScore.metric.chartRecommendations.length > 0) {
            confidence += 0.05;
        }

        if (metricScore.metric.description && metricScore.metric.description.length > 10) {
            confidence += 0.05;
        }

        return Math.max(0.1, Math.min(0.95, confidence));
    }

    /**
     * Diversity information calculation
     */
    private calculateDiversityInfo(
        rankedMetrics: { metric: MetricInfo; score: number; reasons: string[]; confidence: number }[]
    ): { selectedTypes: string[]; coverage: number } {
        const selectedTypes = [...new Set(rankedMetrics.map(rm => rm.metric.type))];
        const selectedValueTypes = [...new Set(rankedMetrics.map(rm => rm.metric.valueType))];

        // Calculate coverage as a combination of type diversity and value type diversity
        const typeCoverage = selectedTypes.length / Math.min(5, rankedMetrics.length); // Normalize by possible types
        const valueCoverage = selectedValueTypes.length / Math.min(4, rankedMetrics.length); // 4 value types
        const coverage = (typeCoverage + valueCoverage) / 2;

        return {
            selectedTypes,
            coverage: Math.round(coverage * 100) / 100
        };
    }

    /**
     * Public helper: select top metrics and for each, select the best chart using shared intent
     */
    selectMetricsAndCharts(
        prompt: string,
        dataAnalysis: DataAnalysis,
        options?: { maxMetrics?: number; topKCharts?: number; dateRange?: string }
    ): MetricsAndChartsSelection {
        const maxMetrics = options?.maxMetrics ?? 3;
        const topKCharts = options?.topKCharts ?? 5;
        const dateRange = options?.dateRange;

        const metricResults = this.analyzeAndRankMetrics(
            prompt,
            dataAnalysis.availableMetrics,
            maxMetrics
        );

        const intentAnalysis = metricResults.intentAnalysis;

        const selections: MetricChartSelection[] = metricResults.rankedMetrics.map(({ metric }) => {
            // Create a per-metric view of available data
            const filteredDataAnalysis: DataAnalysis = {
                ...dataAnalysis,
                availableMetrics: [metric]
            };

            const chartAnalysis = this.chartRanker.generateTopKCharts(
                prompt,
                filteredDataAnalysis,
                topKCharts,
                intentAnalysis
            );

            const chartType = chartAnalysis.recommendedChart.chartType;

            // Note: Reasoning functionality removed from chat pipeline
            // This method preserves the structure for potential future use
            const reasoning: ReasoningProcess = {
                enabled: false,
                steps: [] as ReasoningStep[],
                summary: {
                    selectedChart: chartType,
                    selectedMetric: metric.name,
                    confidence: 0,
                    keyFactors: [] as string[]
                },
                metadata: {
                    totalSteps: 0,
                    processingTimeMs: 0,
                    environmentVariable: 'REASONING_DISABLED_FOR_CHAT'
                }
            };

            return {
                metric,
                chartType,
                chartAnalysis,
                reasoning
            };
        });

        return {
            intentAnalysis,
            selections
        };
    }

    /**
     * Get current reasoning enablement status
     */
    getReasoningStatus(): { enabled: boolean; environmentVariable: string } {
        return {
            enabled: this.isEnabled,
            environmentVariable: `ENABLE_REASONING=${process.env.ENABLE_REASONING || 'false'}`
        };
    }



    /**
     * Helper method for fuzzy string matching
     */
    private calculateLevenshteinSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Helper method to calculate Levenshtein distance between two strings
     */
    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // insertion
                    matrix[j - 1][i] + 1, // deletion
                    matrix[j - 1][i - 1] + substitutionCost // substitution
                );
            }
        }

        return matrix[str2.length][str1.length];
    }

    /**
     * Check if prompt context matches semantic category for business relevance
     */
    private promptMatchesSemanticCategory(promptLower: string, semanticCategory: string): boolean {
        const categoryKeywords = {
            'Sales': ['revenue', 'sales', 'income', 'earnings', 'gross', 'net sales'],
            'Profitability': ['profit', 'margin', 'profitability', 'earnings', 'bottom line'],
            'COGS': ['cost', 'cogs', 'expense', 'spending', 'costs'],
            'Unit Economics': ['aov', 'cac', 'ltv', 'clv', 'customer', 'unit', 'economics'],
            'Marketing': ['marketing', 'ads', 'advertising', 'campaign', 'roas', 'acquisition'],
            'Cash Flow': ['cash', 'flow', 'runway', 'burn', 'balance', 'liquidity'],
            'Quantities': ['orders', 'customers', 'users', 'volume', 'count', 'quantity']
        };

        const keywords = categoryKeywords[semanticCategory as keyof typeof categoryKeywords] || [];
        return keywords.some(keyword => promptLower.includes(keyword));
    }
}