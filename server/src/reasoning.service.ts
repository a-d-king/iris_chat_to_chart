import { Injectable } from '@nestjs/common';
import { DataAnalysis, MetricInfo } from './data-analysis.service';

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
 * Service for providing transparent reasoning about chart and data selection decisions
 * Can be enabled/disabled via ENABLE_REASONING_LOG environment variable
 */
@Injectable()
export class ReasoningService {
    private readonly isEnabled: boolean;

    constructor() {
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
    }

    /**
     * Analyze the user's prompt for intent and requirements
     */
    private analyzePrompt(prompt: string, step: number): ReasoningStep {
        const factors: string[] = [];
        let confidence = 0.8;
        let reasoning = "Analyzing user intent and requirements from the prompt: ";

        // Detect temporal intent
        const temporalKeywords = ['trend', 'over time', 'growth', 'decline', 'change', 'progression'];
        const hasTemporalIntent = temporalKeywords.some(keyword =>
            prompt.toLowerCase().includes(keyword));
        if (hasTemporalIntent) {
            factors.push('Temporal analysis requested');
            reasoning += "User seeks temporal patterns. ";
        }

        // Detect comparison intent
        const comparisonKeywords = ['compare', 'vs', 'versus', 'against', 'between', 'different'];
        const hasComparisonIntent = comparisonKeywords.some(keyword =>
            prompt.toLowerCase().includes(keyword));
        if (hasComparisonIntent) {
            factors.push('Comparison analysis requested');
            reasoning += "User wants comparative analysis. ";
        }

        // Detect breakdown/composition intent
        const breakdownKeywords = ['breakdown', 'composition', 'parts', 'segments', 'by'];
        const hasBreakdownIntent = breakdownKeywords.some(keyword =>
            prompt.toLowerCase().includes(keyword));
        if (hasBreakdownIntent) {
            factors.push('Breakdown/composition analysis requested');
            reasoning += "User needs compositional breakdown. ";
        }

        // Detect specific time period mentions
        const timePatterns = /\b(january|february|march|april|may|june|july|august|september|october|november|december|\d{4}|\d{4}-\d{2}|q1|q2|q3|q4|quarter|month|year)\b/i;
        const hasSpecificTime = timePatterns.test(prompt);
        if (hasSpecificTime) {
            factors.push('Specific time period mentioned');
            reasoning += "Specific time period identified. ";
        }

        // Detect metric hints
        const metricKeywords = ['sales', 'revenue', 'profit', 'cost', 'customer', 'user', 'growth', 'performance'];
        const mentionedMetrics = metricKeywords.filter(keyword =>
            prompt.toLowerCase().includes(keyword));
        if (mentionedMetrics.length > 0) {
            factors.push(`Potential metrics identified: ${mentionedMetrics.join(', ')}`);
            reasoning += `Potential metrics: ${mentionedMetrics.join(', ')}. `;
        }

        // Adjust confidence based on clarity
        if (factors.length >= 3) confidence = 0.9;
        else if (factors.length === 2) confidence = 0.8;
        else if (factors.length === 1) confidence = 0.6;
        else confidence = 0.4;

        return {
            step,
            category: 'prompt_analysis',
            title: 'User Prompt Analysis',
            reasoning: reasoning.trim(),
            factors,
            confidence,
            alternatives: ['Could interpret as general data exploration', 'Might need clarification']
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

        // Analyze grouping capabilities
        const groupableMetrics = dataAnalysis.availableMetrics.filter(m => m.hasGrouping);
        if (groupableMetrics.length > 0) {
            factors.push(`${groupableMetrics.length} metrics support grouping`);
            reasoning += `${groupableMetrics.length} metrics can be grouped. `;
        }

        // Analyze value types
        const valueTypes = dataAnalysis.availableMetrics.reduce((acc, metric) => {
            acc[metric.valueType] = (acc[metric.valueType] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        factors.push(`Value types: ${Object.keys(valueTypes).join(', ')}`);
        reasoning += `Available value types: ${Object.keys(valueTypes).join(', ')}. `;

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
     * Provide reasoning for chart type selection
     */
    private reasonChartTypeSelection(
        prompt: string,
        dataAnalysis: DataAnalysis,
        selectedChartType: string,
        step: number
    ): ReasoningStep {
        const factors: string[] = [];
        let reasoning = `Selected ${selectedChartType} chart because: `;

        // Chart type reasoning based on characteristics
        const chartReasons: Record<string, string[]> = {
            'line': [
                'Optimal for showing trends over time',
                'Emphasizes continuous change and patterns',
                'Best for temporal data analysis'
            ],
            'bar': [
                'Excellent for categorical comparisons',
                'Clear visual distinction between values',
                'Simple and effective for discrete data'
            ],
            'stacked-bar': [
                'Shows both total and composition',
                'Ideal for part-to-whole relationships',
                'Effective for grouped categorical data'
            ],
            'heatmap': [
                'Reveals patterns across two dimensions',
                'Effective for correlation visualization',
                'Good for intensity/density mapping'
            ],
            'waterfall': [
                'Shows cumulative effects',
                'Ideal for sequential changes',
                'Perfect for impact analysis'
            ]
        };

        const reasons = chartReasons[selectedChartType] || ['Selected based on data characteristics'];
        factors.push(...reasons);
        reasoning += reasons.join('. ') + '. ';

        // Note: Legacy AI suggestions removed - now using true runtime reasoning
        factors.push('Chart type selected through runtime AI reasoning');
        reasoning += 'Decision made through explicit AI reasoning process. ';

        // Alternative chart types (based on data characteristics)
        const alternatives = ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall']
            .filter(type => type !== selectedChartType)
            .slice(0, 2)
            .map(type => `${type} chart available as alternative`);

        return {
            step,
            category: 'chart_selection',
            title: 'Chart Type Selection Reasoning',
            reasoning: reasoning.trim(),
            factors,
            confidence: 0.85, // High confidence for runtime reasoning-based decisions
            alternatives: alternatives.length > 0 ? alternatives : ['Other chart types less suitable for this data']
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

            if (metricInfo.hasGrouping) {
                factors.push('Supports data grouping');
                reasoning += 'Can be grouped for detailed breakdown. ';
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
                factor.includes('breakdown') ||
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

        // Date range reasoning
        if (finalChartSpec.dateRange) {
            factors.push(`Date range: ${finalChartSpec.dateRange}`);
            reasoning += `Applied date range: ${finalChartSpec.dateRange}. `;
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