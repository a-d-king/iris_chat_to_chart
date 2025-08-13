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
     * Analyze user prompt and provide reasoning for chart/data selection
     * @param prompt - User's natural language prompt
     * @param dataAnalysis - Available data context and metrics
     * @param finalChartSpec - The chart specification that was ultimately selected
     * @returns ReasoningProcess with step-by-step decision logic
     */
    generateReasoning(
        prompt: string,
        dataAnalysis: DataAnalysis,
        finalChartSpec: any
    ): ReasoningProcess {
        const startTime = Date.now();

        if (!this.isEnabled) {
            return {
                enabled: false,
                steps: [],
                summary: {
                    selectedChart: finalChartSpec.chartType,
                    selectedMetric: finalChartSpec.metric,
                    confidence: 0,
                    keyFactors: []
                },
                metadata: {
                    totalSteps: 0,
                    processingTimeMs: 0,
                    environmentVariable: 'ENABLE_REASONING=false'
                }
            };
        }

        try {
            const steps: ReasoningStep[] = [];
            let stepNumber = 1;

            // Step 1: Prompt Analysis
            const promptAnalysis = this.analyzePrompt(prompt, stepNumber++);
            steps.push(promptAnalysis);

            // Step 2: Data Evaluation
            const dataEvaluation = this.evaluateAvailableData(dataAnalysis, stepNumber++);
            steps.push(dataEvaluation);

            // Step 3: Chart Type Selection Reasoning
            const chartSelection = this.reasonChartTypeSelection(
                prompt,
                dataAnalysis,
                finalChartSpec.chartType,
                stepNumber++
            );
            steps.push(chartSelection);

            // Step 4: Metric Selection Reasoning
            const metricSelection = this.reasonMetricSelection(
                prompt,
                dataAnalysis,
                finalChartSpec.metric,
                stepNumber++
            );
            steps.push(metricSelection);

            // Step 5: Final Decision Synthesis
            const finalDecision = this.synthesizeFinalDecision(
                prompt,
                finalChartSpec,
                steps,
                stepNumber++
            );
            steps.push(finalDecision);

            const processingTime = Date.now() - startTime;

            // Calculate overall confidence
            const overallConfidence = steps.reduce((sum, step) => sum + step.confidence, 0) / steps.length;

            // Extract key factors
            const keyFactors = steps
                .flatMap(step => step.factors)
                .filter((factor, index, arr) => arr.indexOf(factor) === index)
                .slice(0, 5); // Top 5 factors

            return {
                enabled: true,
                steps,
                summary: {
                    selectedChart: finalChartSpec.chartType,
                    selectedMetric: finalChartSpec.metric,
                    confidence: Math.round(overallConfidence * 100) / 100,
                    keyFactors
                },
                metadata: {
                    totalSteps: steps.length,
                    processingTimeMs: processingTime,
                    environmentVariable: 'ENABLE_REASONING=true'
                }
            };
        } catch (error) {
            this.errorHandler.handleApiError('reasoning_generation', error, {
                operation: 'generateReasoning',
                component: 'ReasoningService'
            });
        }
    }

    /**
     * Analyze the user's prompt for intent and requirements
     */
    private analyzePrompt(prompt: string, step: number): ReasoningStep {
        const intentAnalysis = this.intentAnalyzer.performIntentAnalysis(prompt);
        const factors: string[] = [];
        let reasoning = "Advanced intent analysis results: ";

        // Primary intent analysis
        factors.push(`Primary intent: ${intentAnalysis.primaryIntent.type} (${Math.round(intentAnalysis.primaryIntent.confidence * 100)}% confidence)`);
        reasoning += `Primary intent identified as ${intentAnalysis.primaryIntent.type.replace('_', ' ')} with ${Math.round(intentAnalysis.primaryIntent.confidence * 100)}% confidence. `;

        // Secondary intents
        if (intentAnalysis.secondaryIntents.length > 0) {
            const secondaryTypes = intentAnalysis.secondaryIntents.map(intent => intent.type).join(', ');
            factors.push(`Secondary intents: ${secondaryTypes}`);
            reasoning += `Additional intents detected: ${secondaryTypes}. `;
        }

        // Temporal signals
        if (intentAnalysis.temporalSignals.length > 0) {
            const temporalTypes = intentAnalysis.temporalSignals.map(sig => sig.type).join(', ');
            factors.push(`Temporal analysis: ${temporalTypes}`);
            reasoning += `Temporal patterns sought: ${temporalTypes}. `;
        }

        // Generate alternatives based on intent uncertainty
        const alternatives: string[] = [];
        if (intentAnalysis.confidence < 0.8) {
            alternatives.push('Could benefit from user clarification');
        }
        if (intentAnalysis.explicitMetrics.length === 0) {
            alternatives.push('No specific metrics mentioned - using best-match heuristics');
        }

        return {
            step,
            category: 'prompt_analysis',
            title: 'Advanced Intent Analysis',
            reasoning: reasoning.trim(),
            factors,
            confidence: intentAnalysis.confidence,
            alternatives: alternatives.length > 0 ? alternatives : ['Analysis clear - proceeding with high confidence'],
            intentAnalysis
        };
    }

    /**
     * Evaluate available data and its characteristics
     */
    private evaluateAvailableData(dataAnalysis: DataAnalysis, step: number): ReasoningStep {
        const factors: string[] = [];
        let reasoning = "Evaluating available data structure and characteristics: ";

        // Analyze metric types
        const metricTypes = dataAnalysis.availableMetrics.reduce((acc, metric) => {
            acc[metric.type] = (acc[metric.type] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        Object.entries(metricTypes).forEach(([type, count]) => {
            factors.push(`${count} ${type} metrics available`);
            reasoning += `Found ${count} ${type} metrics. `;
        });

        // Analyze time data availability
        const timeDataMetrics = dataAnalysis.availableMetrics.filter(m => m.hasTimeData);
        if (timeDataMetrics.length > 0) {
            factors.push(`${timeDataMetrics.length} metrics with temporal data`);
            reasoning += `${timeDataMetrics.length} metrics support time-based analysis. `;
        }

        return {
            step,
            category: 'data_evaluation',
            title: 'Available Data Assessment',
            reasoning: reasoning.trim(),
            factors,
            confidence: 0.9,
            alternatives: ['Could use different data aggregation approaches']
        };
    }

    /**
     * Provide reasoning for chart type selection using advanced ranking system
     */
    private reasonChartTypeSelection(
        prompt: string,
        dataAnalysis: DataAnalysis,
        selectedChartType: string,
        step: number
    ): ReasoningStep {
        // Generate comprehensive chart rankings
        const chartRankings = this.chartRanker.generateTopKCharts(prompt, dataAnalysis, 5);

        const factors: string[] = [];
        let reasoning = `Advanced chart selection analysis completed. `;

        // Find the selected chart in rankings
        const selectedChartRanking = chartRankings.rankings.find(r => r.chartType === selectedChartType);
        const selectedIndex = chartRankings.rankings.findIndex(r => r.chartType === selectedChartType);

        if (selectedChartRanking) {
            reasoning += `${selectedChartType} chart ranked #${selectedIndex + 1} out of ${chartRankings.rankings.length} options. `;

            // Add score breakdown
            factors.push(`Overall score: ${Math.round(selectedChartRanking.score * 100)}%`);
            factors.push(`Data compatibility: ${Math.round(selectedChartRanking.dataCompatibility * 100)}%`);
            factors.push(`Intent alignment: ${Math.round(selectedChartRanking.intentAlignment * 100)}%`);

            // Add strengths
            if (selectedChartRanking.strengths.length > 0) {
                factors.push(`Strengths: ${selectedChartRanking.strengths.join(', ')}`);
                reasoning += `Key strengths: ${selectedChartRanking.strengths.slice(0, 2).join(' and ')}. `;
            }
        } else {
            reasoning += `Selected ${selectedChartType} chart through AI analysis. `;
            factors.push('Chart type selected through runtime AI reasoning');
        }

        // Generate alternatives from rankings
        const alternatives = chartRankings.alternativeCharts
            .filter(alt => alt.chartType !== selectedChartType)
            .slice(0, 3)
            .map(alt => `${alt.chartType} (${Math.round(alt.score * 100)}% score)`);

        // Calculate confidence based on ranking position and score
        let confidence = selectedChartRanking ? selectedChartRanking.confidence : 0.85;
        if (selectedIndex === 0) confidence = Math.max(confidence, 0.9);
        else if (selectedIndex > 2) confidence = Math.max(confidence * 0.85, 0.6);

        return {
            step,
            category: 'chart_selection',
            title: 'Advanced Chart Selection Analysis',
            reasoning: reasoning.trim(),
            factors,
            confidence,
            alternatives: alternatives.length > 0 ? alternatives : ['Other chart types analyzed but scored lower'],
            chartRankings
        };
    }

    /**
     * Provide reasoning for metric selection
     */
    private reasonMetricSelection(
        prompt: string,
        dataAnalysis: DataAnalysis,
        selectedMetric: string,
        step: number
    ): ReasoningStep {
        const factors: string[] = [];
        let reasoning = `Selected metric '${selectedMetric}' because: `;

        // Find the selected metric in available metrics
        const metricInfo = dataAnalysis.availableMetrics.find(m => m.name === selectedMetric);

        if (metricInfo) {
            factors.push(`Metric type: ${metricInfo.type}`);
            factors.push(`Value type: ${metricInfo.valueType}`);

            if (metricInfo.hasTimeData) {
                factors.push('Supports temporal analysis');
                reasoning += 'Has time-based data for trend analysis. ';
            }

            reasoning += `${metricInfo.description}. `;
        }

        // Check for keyword matches
        const promptLower = prompt.toLowerCase();
        const metricLower = selectedMetric.toLowerCase();

        if (promptLower.includes(metricLower) || metricLower.includes(promptLower.split(' ')[0])) {
            factors.push('Direct keyword match with prompt');
            reasoning += 'Directly matches keywords in user prompt. ';
        }

        // Alternative metrics
        const alternatives = dataAnalysis.availableMetrics
            .filter(m => m.name !== selectedMetric)
            .slice(0, 3)
            .map(m => m.name);

        return {
            step,
            category: 'metric_selection',
            title: 'Metric Selection Reasoning',
            reasoning: reasoning.trim(),
            factors,
            confidence: metricInfo ? 0.85 : 0.6,
            alternatives: alternatives.length > 0 ? alternatives : ['No suitable alternatives identified']
        };
    }

    /**
     * Synthesize the final decision with overall reasoning
     */
    private synthesizeFinalDecision(
        prompt: string,
        finalChartSpec: any,
        previousSteps: ReasoningStep[],
        step: number
    ): ReasoningStep {
        const factors: string[] = [];
        let reasoning = "Final decision synthesis: ";

        // Connect back to original user request
        const promptKeywords = prompt.toLowerCase().split(/\s+/).filter(word => word.length > 3);
        const metricKeywords = finalChartSpec.metric?.toLowerCase().split(/[._\s]+/) || [];
        const keywordMatches = promptKeywords.filter(word =>
            metricKeywords.some((metricWord: string) => word.includes(metricWord) || metricWord.includes(word))
        );

        // Provide specific chart selection justification
        reasoning += `Selected ${finalChartSpec.chartType} chart for '${finalChartSpec.metric}' `;
        factors.push(`Chart type: ${finalChartSpec.chartType}`);
        factors.push(`Target metric: ${finalChartSpec.metric}`);

        if (finalChartSpec.groupBy) {
            reasoning += `with ${finalChartSpec.groupBy} grouping `;
            factors.push(`Grouped by: ${finalChartSpec.groupBy}`);
        }

        reasoning += `over ${finalChartSpec.dateRange} timeframe. `;
        factors.push(`Date range: ${finalChartSpec.dateRange}`);

        // Assess prompt alignment
        if (keywordMatches.length > 0) {
            reasoning += `Direct alignment with user request through keywords: ${keywordMatches.slice(0, 2).join(', ')}. `;
            factors.push(`Keyword alignment: ${keywordMatches.length} matches`);
        }

        // Extract key decision factors from previous steps
        const keyFactors = previousSteps
            .flatMap(step => step.factors)
            .filter(factor =>
                factor.includes('temporal') ||
                factor.includes('comparison') ||
                factor.includes('keyword match') ||
                factor.includes('confidence')
            )
            .slice(0, 2);

        factors.push(...keyFactors);

        // Assess decision quality based on step alignment
        const chartStepConfidence = previousSteps.find(s => s.category === 'chart_selection')?.confidence || 0.5;
        const metricStepConfidence = previousSteps.find(s => s.category === 'metric_selection')?.confidence || 0.5;
        const alignmentBonus = keywordMatches.length > 0 ? 0.1 : 0;

        const finalConfidence = Math.min(0.95, (chartStepConfidence + metricStepConfidence) / 2 + alignmentBonus);

        // Provide context-aware confidence assessment
        if (finalConfidence > 0.85) {
            reasoning += "High confidence: strong alignment between user intent, data characteristics, and AI analysis. ";
            factors.push('High confidence decision');
        } else if (finalConfidence > 0.65) {
            reasoning += "Moderate confidence: good match with some uncertainty in requirements. ";
            factors.push('Moderate confidence decision');
        } else {
            reasoning += "Lower confidence: limited alignment suggests user clarification could improve results. ";
            factors.push('Lower confidence decision');
        }

        // Generate specific alternatives based on the final spec
        const alternatives: string[] = [];
        if (finalChartSpec.chartType === 'line' && !prompt.toLowerCase().includes('trend')) {
            alternatives.push('Bar chart for categorical comparison instead of trends');
        } else if (finalChartSpec.chartType === 'bar' && prompt.toLowerCase().includes('trend')) {
            alternatives.push('Line chart for better trend visualization');
        }

        if (keywordMatches.length === 0) {
            alternatives.push('Consider different metric if user intent unclear');
        }

        if (alternatives.length === 0) {
            alternatives.push('Chart configuration optimized for user request');
        }

        return {
            step,
            category: 'final_decision',
            title: 'Decision Synthesis',
            reasoning: reasoning.trim(),
            factors,
            confidence: Math.round(finalConfidence * 100) / 100,
            alternatives
        };
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

            const reasoning = this.generateReasoning(prompt, filteredDataAnalysis, {
                chartType,
                metric: metric.name,
                dateRange
            });

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
     * Log reasoning steps to console if enabled
     */
    logReasoning(reasoning: ReasoningProcess): void {
        if (!this.isEnabled) return;

        this.errorHandler.logInfo('reasoning_process', 'Starting reasoning process', {
            component: 'ReasoningService',
            metadata: {
                confidence: reasoning.summary.confidence,
                processingTime: reasoning.metadata.processingTimeMs,
                steps: reasoning.metadata.totalSteps
            }
        });

        console.log('\n=== REASONING PROCESS ===');
        console.log(`Environment: ${reasoning.metadata.environmentVariable}`);
        console.log(`Processing Time: ${reasoning.metadata.processingTimeMs}ms`);
        console.log(`Overall Confidence: ${reasoning.summary.confidence}\n`);

        reasoning.steps.forEach(step => {
            console.log(`[Step ${step.step}] ${step.title} (${step.category})`);
            console.log(`Reasoning: ${step.reasoning}`);
            console.log(`Confidence: ${step.confidence}`);
            console.log(`Factors: ${step.factors.join(', ')}`);
            if (step.alternatives && step.alternatives.length > 0) {
                console.log(`Alternatives: ${step.alternatives.join(', ')}`);
            }
            console.log('---');
        });

        console.log('=== SUMMARY ===');
        console.log(`Selected Chart: ${reasoning.summary.selectedChart}`);
        console.log(`Selected Metric: ${reasoning.summary.selectedMetric}`);
        console.log(`Key Factors: ${reasoning.summary.keyFactors.join(', ')}`);
        console.log('=== END REASONING ===\n');
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