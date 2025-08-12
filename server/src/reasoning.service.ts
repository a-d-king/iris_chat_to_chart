import { Injectable } from '@nestjs/common';
import { DataAnalysis, MetricInfo } from './data-analysis.service';
import { IntentAnalyzerService, IntentAnalysis } from './reasoning/intent-analyzer.service';
import { ChartRankerService, TopKChartsAnalysis, ChartRanking } from './reasoning/chart-ranker.service';
import { ErrorHandlerService } from './common/error-handler.service';

// Re-export interfaces from extracted services for backward compatibility
export { IntentAnalysis, IntentType, TemporalSignal, ComparisonSignal } from './reasoning/intent-analyzer.service';
export { ChartRanking, TopKChartsAnalysis } from './reasoning/chart-ranker.service';

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
 * Refactored to use specialized services for intent analysis and chart ranking
 */
@Injectable()
export class ReasoningService {
    private readonly isEnabled: boolean;

    constructor(
        private intentAnalyzer: IntentAnalyzerService,
        private chartRanker: ChartRankerService,
        private errorHandler: ErrorHandlerService
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
                .filter((factor, index, arr) => arr.indexOf(factor) === index) // Remove duplicates
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

        // Extract key decision factors from previous steps
        const keyFactors = previousSteps
            .flatMap(step => step.factors)
            .filter(factor =>
                factor.includes('temporal') ||
                factor.includes('comparison') ||
                factor.includes('keyword match') ||
                factor.includes('confidence')
            )
            .slice(0, 3);

        factors.push(...keyFactors);

        reasoning += `Combining user intent analysis, data characteristics, and AI recommendations. `;

        // Confidence assessment
        const avgConfidence = previousSteps.reduce((sum, step) => sum + step.confidence, 0) / previousSteps.length;

        if (avgConfidence > 0.8) {
            reasoning += "High confidence in this decision based on clear user intent and suitable data. ";
            factors.push('High confidence decision');
        } else if (avgConfidence > 0.6) {
            reasoning += "Moderate confidence - some ambiguity in requirements. ";
            factors.push('Moderate confidence decision');
        } else {
            reasoning += "Lower confidence - may benefit from user clarification. ";
            factors.push('Lower confidence decision');
        }

        return {
            step,
            category: 'final_decision',
            title: 'Decision Synthesis',
            reasoning: reasoning.trim(),
            factors,
            confidence: avgConfidence,
            alternatives: ['Could refine based on user feedback', 'Alternative chart types available if needed']
        };
    }

    /**
     * Generate top K chart recommendations with systematic ranking
     */
    generateTopKCharts(
        prompt: string,
        dataAnalysis: DataAnalysis,
        k: number = 5,
        intentAnalysis?: IntentAnalysis
    ): TopKChartsAnalysis {
        return this.chartRanker.generateTopKCharts(prompt, dataAnalysis, k, intentAnalysis);
    }

    /**
     * Comprehensive metric analysis and ranking for dashboards and charts
     */
    analyzeAndRankMetrics(
        prompt: string,
        availableMetrics: MetricInfo[],
        maxMetrics: number = 5
    ): {
        rankedMetrics: { metric: MetricInfo; score: number; reasons: string[] }[];
        qualityIssues: { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }[];
        intentAnalysis: IntentAnalysis;
    } {
        try {
            // Perform intent analysis
            const intentAnalysis = this.intentAnalyzer.performIntentAnalysis(prompt);

            // Score all metrics based on prompt relevance and intent
            const scoredMetrics = this.scoreMetricsForRelevance(prompt, availableMetrics, intentAnalysis);

            // Analyze data quality
            const qualityIssues: { metric: MetricInfo; issues: string[]; severity: 'low' | 'medium' | 'high' }[] = [];
            
            const rankedMetrics = scoredMetrics
                .sort((a, b) => b.score - a.score)
                .slice(0, maxMetrics);

            return {
                rankedMetrics,
                qualityIssues,
                intentAnalysis
            };
        } catch (error) {
            this.errorHandler.handleApiError('metric_analysis', error, {
                operation: 'analyzeAndRankMetrics',
                component: 'ReasoningService'
            });
        }
    }

    /**
     * Score metrics for relevance to prompt and intent
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

            // Direct name matching
            if (promptLower.includes(metricName)) {
                score += 2.0;
                reasons.push('Direct name match');
            }

            // Word-level matching
            for (const promptWord of promptWords) {
                if (promptWord.length < 3) continue;
                for (const metricWord of metricWords) {
                    if (promptWord === metricWord) {
                        score += 1.5;
                        reasons.push(`Word match: ${promptWord}`);
                    } else if (promptWord.includes(metricWord) || metricWord.includes(promptWord)) {
                        score += 1.0;
                        reasons.push(`Partial match: ${promptWord}/${metricWord}`);
                    }
                }
            }

            // Intent-based boosting
            const primaryIntent = intentAnalysis.primaryIntent.type;
            if (primaryIntent === 'temporal_trend' && metric.hasTimeData) {
                score += 1.0;
                reasons.push('Perfect for temporal analysis');
            }
            if (primaryIntent === 'categorical_comparison' && metric.hasGrouping) {
                score += 0.8;
                reasons.push('Good for categorical comparison');
            }

            return { metric, score, reasons };
        });
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
}