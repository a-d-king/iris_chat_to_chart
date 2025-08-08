import { Injectable } from '@nestjs/common';
import { DataAnalysis, MetricInfo } from './data-analysis.service';

/**
 * Interface for intent detection results
 */
export interface IntentAnalysis {
    primaryIntent: IntentType;
    secondaryIntents: IntentType[];
    confidence: number;
    reasoningFactors: string[];
    temporalSignals: TemporalSignal[];
    comparisonSignals: ComparisonSignal[];
    aggregationLevel: 'detailed' | 'summary' | 'overview';
    explicitMetrics: string[];
    implicitRequirements: string[];
}

export interface IntentType {
    type: 'temporal_trend' | 'categorical_comparison' | 'compositional_breakdown' | 'correlation_analysis' | 'performance_overview' | 'anomaly_detection' | 'forecasting' | 'drill_down';
    confidence: number;
    keywords: string[];
    semanticSignals: string[];
}

export interface TemporalSignal {
    type: 'trend' | 'seasonality' | 'period_comparison' | 'growth_analysis';
    keywords: string[];
    strength: number;
}

export interface ComparisonSignal {
    type: 'head_to_head' | 'ranking' | 'benchmark' | 'segment_analysis';
    entities: string[];
    strength: number;
}

/**
 * Interface for chart ranking results
 */
export interface ChartRanking {
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';
    score: number;
    confidence: number;
    reasoning: string;
    strengths: string[];
    weaknesses: string[];
    dataCompatibility: number;
    intentAlignment: number;
    visualEffectiveness: number;
    usabilityScore: number;
}

export interface TopKChartsAnalysis {
    rankings: ChartRanking[];
    topK: ChartRanking[];
    recommendedChart: ChartRanking;
    alternativeCharts: ChartRanking[];
    analysisMetadata: {
        totalScored: number;
        confidenceThreshold: number;
        scoringCriteria: string[];
    };
}

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
 * Can be enabled/disabled via ENABLE_REASONING environment variable
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
     * Analyze the user's prompt for intent and requirements using advanced semantic analysis
     */
    private analyzePrompt(prompt: string, step: number): ReasoningStep {
        const intentAnalysis = this.performIntentAnalysis(prompt);
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

        // Comparison signals
        if (intentAnalysis.comparisonSignals.length > 0) {
            const comparisonTypes = intentAnalysis.comparisonSignals.map(sig => sig.type).join(', ');
            factors.push(`Comparison type: ${comparisonTypes}`);
            reasoning += `Comparison analysis: ${comparisonTypes}. `;
        }

        // Aggregation level
        factors.push(`Analysis depth: ${intentAnalysis.aggregationLevel}`);
        reasoning += `Requested analysis depth: ${intentAnalysis.aggregationLevel}. `;

        // Explicit metrics mentioned
        if (intentAnalysis.explicitMetrics.length > 0) {
            factors.push(`Explicit metrics: ${intentAnalysis.explicitMetrics.join(', ')}`);
            reasoning += `Explicitly mentioned metrics: ${intentAnalysis.explicitMetrics.join(', ')}. `;
        }

        // Implicit requirements
        if (intentAnalysis.implicitRequirements.length > 0) {
            factors.push(`Implicit requirements: ${intentAnalysis.implicitRequirements.join(', ')}`);
            reasoning += `Inferred requirements: ${intentAnalysis.implicitRequirements.join(', ')}. `;
        }

        // Generate alternatives based on intent uncertainty
        const alternatives: string[] = [];
        if (intentAnalysis.confidence < 0.8) {
            alternatives.push('Could benefit from user clarification');
        }
        if (intentAnalysis.secondaryIntents.length > 1) {
            alternatives.push('Multiple interpretations possible - may need follow-up questions');
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
     * Perform comprehensive intent analysis using semantic understanding
     */
    private performIntentAnalysis(prompt: string): IntentAnalysis {
        const promptLower = prompt.toLowerCase();
        const words = promptLower.split(/\s+/);

        // Handle negations and complex queries
        const preprocessedPrompt = this.preprocessComplexQuery(promptLower);
        const negationContext = this.analyzeNegations(promptLower);
        const temporalContext = this.analyzeTemporalPatterns(promptLower);

        // Define intent patterns with semantic understanding
        const intentPatterns = {
            temporal_trend: {
                keywords: ['trend', 'over time', 'growth', 'decline', 'change', 'progression', 'evolution', 'trajectory', 'movement', 'pattern'],
                semanticSignals: ['month', 'year', 'quarter', 'week', 'daily', 'annual', 'seasonal', 'historical'],
                weight: 1.0
            },
            categorical_comparison: {
                keywords: ['compare', 'vs', 'versus', 'against', 'between', 'difference', 'contrast', 'relative to'],
                semanticSignals: ['better', 'worse', 'higher', 'lower', 'best', 'worst', 'top', 'bottom'],
                weight: 1.0
            },
            compositional_breakdown: {
                keywords: ['breakdown', 'composition', 'parts', 'segments', 'by', 'split', 'divide', 'portion'],
                semanticSignals: ['category', 'type', 'group', 'segment', 'component', 'part', 'share'],
                weight: 1.0
            },
            performance_overview: {
                keywords: ['overview', 'dashboard', 'summary', 'performance', 'status', 'snapshot', 'overall'],
                semanticSignals: ['key', 'main', 'primary', 'important', 'critical', 'total', 'overall'],
                weight: 1.2
            },
            correlation_analysis: {
                keywords: ['correlation', 'relationship', 'related', 'connection', 'impact', 'effect', 'influence'],
                semanticSignals: ['factor', 'driver', 'cause', 'affect', 'dependent', 'independent'],
                weight: 0.8
            },
            anomaly_detection: {
                keywords: ['anomaly', 'outlier', 'unusual', 'abnormal', 'spike', 'drop', 'unexpected'],
                semanticSignals: ['strange', 'weird', 'odd', 'different', 'deviation', 'exception'],
                weight: 0.7
            },
            forecasting: {
                keywords: ['forecast', 'predict', 'future', 'projection', 'estimate', 'anticipate'],
                semanticSignals: ['next', 'upcoming', 'expected', 'projected', 'planned'],
                weight: 0.6
            },
            drill_down: {
                keywords: ['detail', 'detailed', 'specific', 'granular', 'deep', 'drill'],
                semanticSignals: ['exactly', 'precisely', 'specifically', 'particular', 'individual'],
                weight: 0.9
            }
        };

        // Calculate intent scores with complex query handling
        const intentScores: { [key: string]: { score: number; matchedKeywords: string[]; matchedSignals: string[] } } = {};

        for (const [intentType, pattern] of Object.entries(intentPatterns)) {
            // Use both original and preprocessed prompt for matching
            const matchedKeywords = pattern.keywords.filter(keyword =>
                preprocessedPrompt.includes(keyword) || promptLower.includes(keyword)
            );
            const matchedSignals = pattern.semanticSignals.filter(signal =>
                words.some(word => word.includes(signal) || signal.includes(word))
            );

            let score = 0;
            score += matchedKeywords.length * 0.8;
            score += matchedSignals.length * 0.6;
            score *= pattern.weight;

            // Boost score for exact phrase matches
            pattern.keywords.forEach(keyword => {
                if (preprocessedPrompt.includes(keyword)) {
                    score += 0.3;
                }
            });

            // Enhance temporal scoring based on temporal context
            if (intentType === 'temporal_trend' && temporalContext.timeframes.length > 0) {
                score += temporalContext.timeframes.length * 0.4;
            }
            if (intentType === 'temporal_trend' && temporalContext.temporalComparisons.length > 0) {
                score += temporalContext.temporalComparisons.length * 0.5;
            }
            if (intentType === 'temporal_trend' && temporalContext.periodicitySignals.length > 0) {
                score += temporalContext.periodicitySignals.length * 0.3;
            }

            // Apply negation adjustments
            if (negationContext.hasNegation && negationContext.modifiedIntent === intentType) {
                score += 0.5; // Boost alternative intent suggested by negation analysis
            }
            if (negationContext.hasNegation && intentType === 'temporal_trend' &&
                negationContext.negatedConcepts.some(concept => concept.includes('time'))) {
                score *= 0.3; // Reduce temporal intent if time-related concepts are negated
            }

            intentScores[intentType] = {
                score,
                matchedKeywords,
                matchedSignals
            };
        }

        // Sort intents by score
        const sortedIntents = Object.entries(intentScores)
            .map(([type, data]) => ({
                type: type as IntentType['type'],
                confidence: Math.min(data.score / 3.0, 1.0), // Normalize to 0-1
                keywords: data.matchedKeywords,
                semanticSignals: data.matchedSignals
            }))
            .sort((a, b) => b.confidence - a.confidence);

        const primaryIntent = sortedIntents[0] || {
            type: 'performance_overview' as IntentType['type'],
            confidence: 0.5,
            keywords: [],
            semanticSignals: []
        };

        const secondaryIntents = sortedIntents.slice(1, 3).filter(intent => intent.confidence > 0.3);

        // Analyze temporal signals using advanced temporal analysis
        const temporalSignals: TemporalSignal[] = [];

        // Use temporal context analysis
        if (temporalContext.timeframes.length > 0 || promptLower.match(/trend|over time|growth|decline/)) {
            temporalSignals.push({
                type: 'trend',
                keywords: ['trend', 'growth', 'decline', ...temporalContext.timeframes],
                strength: Math.min(0.8 + temporalContext.timeframes.length * 0.1, 1.0)
            });
        }

        if (temporalContext.periodicitySignals.length > 0 || promptLower.match(/seasonal|monthly|quarterly|yearly/)) {
            temporalSignals.push({
                type: 'seasonality',
                keywords: [...temporalContext.periodicitySignals, 'seasonal', 'monthly', 'quarterly'],
                strength: Math.min(0.7 + temporalContext.periodicitySignals.length * 0.1, 1.0)
            });
        }

        if (temporalContext.temporalComparisons.length > 0 || promptLower.match(/compare.*period|vs.*month|versus.*quarter/)) {
            temporalSignals.push({
                type: 'period_comparison',
                keywords: [...temporalContext.temporalComparisons, 'compare period'],
                strength: Math.min(0.6 + temporalContext.temporalComparisons.length * 0.15, 1.0)
            });
        }

        // Add growth analysis if specific growth patterns detected
        if (promptLower.match(/year\s+over\s+year|growth\s+rate|compound.*growth/)) {
            temporalSignals.push({
                type: 'growth_analysis',
                keywords: ['year over year', 'growth rate', 'compound growth'],
                strength: 0.75
            });
        }

        // Analyze comparison signals
        const comparisonSignals: ComparisonSignal[] = [];
        if (promptLower.match(/vs|versus|against|compare/)) {
            const entities = this.extractComparisonEntities(promptLower);
            comparisonSignals.push({ type: 'head_to_head', entities, strength: 0.8 });
        }
        if (promptLower.match(/top|best|worst|ranking|rank/)) {
            comparisonSignals.push({ type: 'ranking', entities: [], strength: 0.7 });
        }

        // Determine aggregation level
        let aggregationLevel: 'detailed' | 'summary' | 'overview' = 'summary';
        if (promptLower.match(/overview|dashboard|summary/)) {
            aggregationLevel = 'overview';
        } else if (promptLower.match(/detail|specific|granular|individual/)) {
            aggregationLevel = 'detailed';
        }

        // Extract explicit metrics
        const explicitMetrics = this.extractExplicitMetrics(promptLower);

        // Identify implicit requirements
        const implicitRequirements = this.identifyImplicitRequirements(promptLower, primaryIntent.type);

        // Calculate overall confidence with complex query adjustments
        let overallConfidence = primaryIntent.confidence;

        // Boost confidence for clear temporal patterns
        if (temporalSignals.length > 0) overallConfidence += 0.1;
        if (temporalContext.timeframes.length > 1) overallConfidence += 0.05; // Multiple specific timeframes
        if (temporalContext.temporalComparisons.length > 0) overallConfidence += 0.08; // Clear temporal comparisons

        // Boost confidence for comparison signals
        if (comparisonSignals.length > 0) overallConfidence += 0.1;

        // Boost confidence for explicit metrics
        if (explicitMetrics.length > 0) overallConfidence += 0.15;

        // Adjust for complex query characteristics
        if (negationContext.hasNegation) {
            if (negationContext.modifiedIntent && primaryIntent.type === negationContext.modifiedIntent) {
                overallConfidence += 0.1; // Boost if negation led to correct alternative intent
            } else {
                overallConfidence -= 0.05; // Slight penalty for handling negations
            }
        }

        // Boost confidence for sophisticated temporal analysis
        const temporalStrength = temporalSignals.reduce((sum, signal) => sum + signal.strength, 0);
        if (temporalStrength > 1.5) overallConfidence += 0.05;

        // Penalty for too many ambiguous patterns
        if (secondaryIntents.length > 2 && primaryIntent.confidence < 0.7) {
            overallConfidence -= 0.08;
        }

        overallConfidence = Math.min(overallConfidence, 1.0);

        return {
            primaryIntent,
            secondaryIntents,
            confidence: overallConfidence,
            reasoningFactors: sortedIntents.slice(0, 3).map(intent =>
                `${intent.type}: ${Math.round(intent.confidence * 100)}%`
            ),
            temporalSignals,
            comparisonSignals,
            aggregationLevel,
            explicitMetrics,
            implicitRequirements
        };
    }

    /**
     * Extract entities being compared from the prompt
     */
    private extractComparisonEntities(prompt: string): string[] {
        const entities: string[] = [];
        const patterns = [
            /compare\s+(\w+)\s+(?:vs|versus|against|to|with)\s+(\w+)/g,
            /(\w+)\s+vs\s+(\w+)/g,
            /(\w+)\s+versus\s+(\w+)/g
        ];

        patterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                entities.push(match[1], match[2]);
            }
        });

        return [...new Set(entities)];
    }

    /**
     * Extract explicitly mentioned metrics from the prompt
     */
    private extractExplicitMetrics(prompt: string): string[] {
        const metricPatterns = [
            'sales', 'revenue', 'profit', 'margin', 'cost', 'expenses', 'income',
            'customers', 'users', 'orders', 'transactions', 'conversion',
            'growth', 'decline', 'performance', 'efficiency', 'productivity',
            'cash', 'balance', 'debt', 'assets', 'liabilities'
        ];

        return metricPatterns.filter(metric => prompt.includes(metric));
    }

    /**
     * Identify implicit requirements based on intent and context
     */
    private identifyImplicitRequirements(prompt: string, primaryIntent: IntentType['type']): string[] {
        const requirements: string[] = [];

        if (primaryIntent === 'temporal_trend') {
            requirements.push('time-series data required', 'trend visualization needed');
        }
        if (primaryIntent === 'categorical_comparison') {
            requirements.push('categorical grouping needed', 'clear value distinctions');
        }
        if (primaryIntent === 'compositional_breakdown') {
            requirements.push('part-to-whole relationships', 'hierarchical structure');
        }
        if (primaryIntent === 'performance_overview') {
            requirements.push('multiple metrics display', 'summary statistics');
        }

        if (prompt.includes('monthly') || prompt.includes('quarterly')) {
            requirements.push('time-based aggregation');
        }
        if (prompt.includes('by') || prompt.includes('breakdown')) {
            requirements.push('dimensional grouping');
        }

        return requirements;
    }

    /**
     * Preprocess complex queries to handle conditional statements, multiple clauses, and ambiguous language
     */
    private preprocessComplexQuery(prompt: string): string {
        let processed = prompt;

        // Handle conditional statements
        processed = processed.replace(/if\s+(.*?)\s+then\s+(.*?)(?:\s+else\s+(.*?))?/gi, (match, condition, thenPart, elsePart) => {
            // Extract the main intent from conditional statements
            return thenPart || condition;
        });

        // Handle multiple clauses connected by conjunctions
        processed = processed.replace(/\b(and|but|however|although|while)\b/g, ' ');

        // Resolve pronoun references
        processed = processed.replace(/\b(it|this|that|these|those)\b/g, '');

        // Handle question words that might confuse intent detection
        processed = processed.replace(/^(what|how|when|where|why|which|who)\s+/i, '');

        // Normalize comparative language
        processed = processed.replace(/\b(more|less|better|worse)\s+than\b/gi, 'compare');
        processed = processed.replace(/\b(higher|lower|greater|smaller)\s+than\b/gi, 'compare');

        // Handle temporal references
        processed = processed.replace(/\b(last|previous|prior|past)\s+(month|quarter|year|week)\b/gi, 'historical period');
        processed = processed.replace(/\b(next|upcoming|future)\s+(month|quarter|year|week)\b/gi, 'future period');
        processed = processed.replace(/\b(this|current)\s+(month|quarter|year|week)\b/gi, 'current period');

        // Handle vague language
        processed = processed.replace(/\b(kind of|sort of|maybe|perhaps|possibly|probably)\b/gi, '');
        processed = processed.replace(/\b(I want to see|show me|can you|could you|please)\b/gi, '');

        return processed;
    }

    /**
     * Analyze negations and their impact on intent
     */
    private analyzeNegations(prompt: string): { hasNegation: boolean; negatedConcepts: string[]; modifiedIntent?: string } {
        const negationWords = ['not', 'no', 'never', 'without', 'exclude', 'except', 'ignore', "don't", "won't", "can't", "shouldn't"];
        const negationPatterns = [
            /\b(not|no|never|without|exclude|except|ignore)\s+(\w+(?:\s+\w+)*)/gi,
            /\b(don't|won't|can't|shouldn't)\s+(\w+(?:\s+\w+)*)/gi
        ];

        const negatedConcepts: string[] = [];
        let hasNegation = false;

        // Find negated concepts
        negationPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                hasNegation = true;
                negatedConcepts.push(match[2]);
            }
        });

        // Check for simple negation words
        if (negationWords.some(word => prompt.includes(word))) {
            hasNegation = true;
        }

        // Determine how negation modifies intent
        let modifiedIntent: string | undefined;
        if (hasNegation) {
            // If negating temporal words, might want categorical instead
            if (negatedConcepts.some(concept => concept.includes('time') || concept.includes('trend'))) {
                modifiedIntent = 'categorical_comparison';
            }
            // If negating comparison words, might want overview instead  
            else if (negatedConcepts.some(concept => concept.includes('compare') || concept.includes('versus'))) {
                modifiedIntent = 'performance_overview';
            }
        }

        return {
            hasNegation,
            negatedConcepts,
            modifiedIntent
        };
    }

    /**
     * Advanced temporal pattern analysis
     */
    private analyzeTemporalPatterns(prompt: string): {
        timeframes: string[];
        temporalRelationships: string[];
        periodicitySignals: string[];
        temporalComparisons: string[];
    } {
        // Detect specific timeframes
        const timeframePatterns = [
            /\b(\d{4})\b/g, // Years
            /\b(\d{4}-\d{2})\b/g, // Year-month
            /\b(q[1-4]|quarter [1-4])\b/gi, // Quarters
            /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi, // Months
            /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{4}\b/gi, // Month year
            /\b(last|this|next)\s+(week|month|quarter|year)\b/gi, // Relative time
            /\b(\d+)\s+(days?|weeks?|months?|quarters?|years?)\s+(ago|from\s+now)\b/gi // Relative periods
        ];

        const timeframes: string[] = [];
        timeframePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(prompt)) !== null) {
                timeframes.push(match[1] || match[0]);
            }
        });

        // Detect temporal relationships
        const relationshipPatterns = [
            /\b(before|after|during|between|from|until|since|through)\b/gi,
            /\b(prior\s+to|following|preceding)\b/gi
        ];

        const temporalRelationships: string[] = [];
        relationshipPatterns.forEach(pattern => {
            const matches = prompt.match(pattern);
            if (matches) {
                temporalRelationships.push(...matches.map(m => m.toLowerCase()));
            }
        });

        // Detect periodicity signals
        const periodicityPatterns = [
            /\b(daily|weekly|monthly|quarterly|yearly|annually)\b/gi,
            /\b(seasonal|cyclical|periodic|recurring)\b/gi,
            /\b(every\s+\w+)\b/gi
        ];

        const periodicitySignals: string[] = [];
        periodicityPatterns.forEach(pattern => {
            const matches = prompt.match(pattern);
            if (matches) {
                periodicitySignals.push(...matches.map(m => m.toLowerCase()));
            }
        });

        // Detect temporal comparisons
        const comparisonPatterns = [
            /\b(year\s+over\s+year|month\s+over\s+month|quarter\s+over\s+quarter)\b/gi,
            /\b(compared\s+to\s+(last|previous|prior)\s+(month|quarter|year))\b/gi,
            /\b(vs\s+(last|previous|prior)\s+(month|quarter|year))\b/gi,
            /\b(same\s+period\s+(last|previous)\s+year)\b/gi
        ];

        const temporalComparisons: string[] = [];
        comparisonPatterns.forEach(pattern => {
            const matches = prompt.match(pattern);
            if (matches) {
                temporalComparisons.push(...matches.map(m => m.toLowerCase()));
            }
        });

        return {
            timeframes,
            temporalRelationships,
            periodicitySignals,
            temporalComparisons
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
        const availableCharts: ('line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall')[] =
            ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'];

        const rankings: ChartRanking[] = [];

        // Score each chart type
        for (const chartType of availableCharts) {
            const ranking = this.scoreChartType(chartType, prompt, dataAnalysis, intentAnalysis);
            rankings.push(ranking);
        }

        // Sort by score (descending)
        rankings.sort((a, b) => b.score - a.score);

        // Get top K
        const topK = rankings.slice(0, k);
        const recommendedChart = rankings[0];
        const alternativeCharts = rankings.slice(1, 4); // Top 2-4 as alternatives

        return {
            rankings,
            topK,
            recommendedChart,
            alternativeCharts,
            analysisMetadata: {
                totalScored: rankings.length,
                confidenceThreshold: 0.6,
                scoringCriteria: [
                    'Data compatibility',
                    'Intent alignment',
                    'Visual effectiveness',
                    'Usability score'
                ]
            }
        };
    }

    /**
     * Score a specific chart type based on multiple criteria
     */
    private scoreChartType(
        chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall',
        prompt: string,
        dataAnalysis: DataAnalysis,
        intentAnalysis?: IntentAnalysis
    ): ChartRanking {
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Score data compatibility (0-1)
        const dataCompatibility = this.scoreDataCompatibility(chartType, dataAnalysis);

        // Score intent alignment (0-1)
        const intentAlignment = this.scoreIntentAlignment(chartType, prompt, intentAnalysis);

        // Score visual effectiveness (0-1)
        const visualEffectiveness = this.scoreVisualEffectiveness(chartType, dataAnalysis);

        // Score usability (0-1)
        const usabilityScore = this.scoreUsability(chartType, dataAnalysis);

        // Calculate overall score (weighted average)
        const weights = {
            data: 0.3,
            intent: 0.35,
            visual: 0.2,
            usability: 0.15
        };

        const score = (
            dataCompatibility * weights.data +
            intentAlignment * weights.intent +
            visualEffectiveness * weights.visual +
            usabilityScore * weights.usability
        );

        // Generate reasoning and strengths/weaknesses
        const { reasoning, chartStrengths, chartWeaknesses } = this.generateChartReasoning(
            chartType, dataCompatibility, intentAlignment, visualEffectiveness, usabilityScore, dataAnalysis
        );

        strengths.push(...chartStrengths);
        weaknesses.push(...chartWeaknesses);

        // Calculate confidence based on score and data quality
        const confidence = Math.min(score + 0.1, 1.0) * (dataAnalysis.availableMetrics.length > 0 ? 1.0 : 0.8);

        return {
            chartType,
            score,
            confidence,
            reasoning,
            strengths,
            weaknesses,
            dataCompatibility,
            intentAlignment,
            visualEffectiveness,
            usabilityScore
        };
    }

    /**
     * Score how well a chart type fits the available data
     */
    private scoreDataCompatibility(chartType: string, dataAnalysis: DataAnalysis): number {
        const metrics = dataAnalysis.availableMetrics;
        let score = 0.5; // Base score

        const timeSeriesMetrics = metrics.filter(m => m.hasTimeData);
        const groupedMetrics = metrics.filter(m => m.hasGrouping);
        const scalarMetrics = metrics.filter(m => m.type === 'scalar');

        switch (chartType) {
            case 'line':
                if (timeSeriesMetrics.length > 0) score += 0.4;
                if (timeSeriesMetrics.length > 2) score += 0.1; // Multiple time series
                if (groupedMetrics.length === 0) score -= 0.2; // No grouping reduces line chart value
                break;

            case 'bar':
                if (scalarMetrics.length > 0 || groupedMetrics.length > 0) score += 0.3;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) <= 8)) score += 0.2;
                if (scalarMetrics.length > 5) score -= 0.1; // Too many scalars for simple bar
                break;

            case 'stacked-bar':
                if (groupedMetrics.length > 0) score += 0.4;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) >= 2 && (m.groupingDimensions?.length || 0) <= 6)) score += 0.2;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) > 8)) score -= 0.3; // Too many categories
                break;

            case 'heatmap':
                if (groupedMetrics.length > 0 && timeSeriesMetrics.length > 0) score += 0.3;
                if (groupedMetrics.some(m => (m.groupingDimensions?.length || 0) > 3)) score += 0.2;
                if (metrics.length < 3) score -= 0.2; // Not enough data for heatmap
                break;

            case 'waterfall':
                if (timeSeriesMetrics.length > 0) score += 0.2;
                if (metrics.some(m => m.name.toLowerCase().includes('change') || m.name.toLowerCase().includes('delta'))) score += 0.3;
                if (scalarMetrics.length > 0) score += 0.1;
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score how well a chart type aligns with user intent
     */
    private scoreIntentAlignment(chartType: string, prompt: string, intentAnalysis?: IntentAnalysis): number {
        let score = 0.5; // Base score
        const promptLower = prompt.toLowerCase();

        // Use intentAnalysis if available
        if (intentAnalysis) {
            const primaryIntent = intentAnalysis.primaryIntent.type;

            switch (chartType) {
                case 'line':
                    if (primaryIntent === 'temporal_trend') score += 0.4;
                    if (intentAnalysis.temporalSignals.some(s => s.type === 'trend')) score += 0.2;
                    if (primaryIntent === 'categorical_comparison') score -= 0.1;
                    break;

                case 'bar':
                    if (primaryIntent === 'categorical_comparison') score += 0.4;
                    if (primaryIntent === 'performance_overview') score += 0.2;
                    if (intentAnalysis.comparisonSignals.length > 0) score += 0.2;
                    break;

                case 'stacked-bar':
                    if (primaryIntent === 'compositional_breakdown') score += 0.4;
                    if (primaryIntent === 'categorical_comparison') score += 0.2;
                    if (intentAnalysis.aggregationLevel === 'detailed') score += 0.1;
                    break;

                case 'heatmap':
                    if (primaryIntent === 'correlation_analysis') score += 0.4;
                    if (primaryIntent === 'anomaly_detection') score += 0.3;
                    if (intentAnalysis.aggregationLevel === 'detailed') score += 0.1;
                    break;

                case 'waterfall':
                    if (primaryIntent === 'temporal_trend' && intentAnalysis.temporalSignals.some(s => s.type === 'growth_analysis')) score += 0.3;
                    if (promptLower.includes('impact') || promptLower.includes('change')) score += 0.2;
                    break;
            }
        } else {
            // Fallback to keyword matching if no intentAnalysis
            switch (chartType) {
                case 'line':
                    if (promptLower.match(/trend|over time|growth|decline/)) score += 0.3;
                    break;
                case 'bar':
                    if (promptLower.match(/compare|vs|versus|against/)) score += 0.3;
                    break;
                case 'stacked-bar':
                    if (promptLower.match(/breakdown|composition|by/)) score += 0.3;
                    break;
                case 'heatmap':
                    if (promptLower.match(/pattern|correlation|relationship/)) score += 0.3;
                    break;
                case 'waterfall':
                    if (promptLower.match(/impact|change|effect/)) score += 0.3;
                    break;
            }
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score visual effectiveness of chart type for given data
     */
    private scoreVisualEffectiveness(chartType: string, dataAnalysis: DataAnalysis): number {
        let score = 0.6; // Base effectiveness score
        const metrics = dataAnalysis.availableMetrics;

        switch (chartType) {
            case 'line':
                // Lines are excellent for trends but poor for categories without time
                if (metrics.some(m => m.hasTimeData)) score += 0.3;
                if (metrics.filter(m => m.hasTimeData).length > 1) score += 0.1; // Multiple trends
                break;

            case 'bar':
                // Bars are versatile and generally effective
                score += 0.2;
                if (metrics.some(m => m.hasGrouping && (m.groupingDimensions?.length || 0) <= 10)) score += 0.1;
                break;

            case 'stacked-bar':
                // Stacked bars excellent for composition but can be cluttered
                if (metrics.some(m => m.hasGrouping && (m.groupingDimensions?.length || 0) >= 2)) score += 0.2;
                if (metrics.some(m => (m.groupingDimensions?.length || 0) > 6)) score -= 0.2; // Too cluttered
                break;

            case 'heatmap':
                // Heatmaps great for patterns but need sufficient data
                if (metrics.length >= 3) score += 0.2;
                if (metrics.some(m => m.hasGrouping && m.hasTimeData)) score += 0.2;
                if (metrics.length < 2) score -= 0.3; // Insufficient for heatmap
                break;

            case 'waterfall':
                // Waterfalls are specialized but very effective for the right data
                if (metrics.some(m => m.name.toLowerCase().includes('change'))) score += 0.3;
                else score -= 0.1; // Less effective without change data
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Score usability and interpretability of chart type
     */
    private scoreUsability(chartType: string, dataAnalysis: DataAnalysis): number {
        let score = 0.7; // Base usability score

        switch (chartType) {
            case 'line':
                score += 0.2; // Generally easy to read
                break;
            case 'bar':
                score += 0.3; // Very intuitive
                break;
            case 'stacked-bar':
                score += 0.1; // Somewhat more complex
                if (dataAnalysis.availableMetrics.some(m => (m.groupingDimensions?.length || 0) > 5)) {
                    score -= 0.2; // More complex with many categories
                }
                break;
            case 'heatmap':
                score -= 0.1; // Requires more interpretation
                break;
            case 'waterfall':
                score += 0.0; // Specialized but clear when appropriate
                break;
        }

        return Math.max(0, Math.min(1, score));
    }

    /**
     * Generate detailed reasoning for chart selection
     */
    private generateChartReasoning(
        chartType: string,
        dataCompatibility: number,
        intentAlignment: number,
        visualEffectiveness: number,
        usabilityScore: number,
        dataAnalysis: DataAnalysis
    ): { reasoning: string; chartStrengths: string[]; chartWeaknesses: string[] } {
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        let reasoning = `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} chart analysis: `;

        // Data compatibility reasoning
        if (dataCompatibility > 0.8) {
            reasoning += 'Excellent data compatibility. ';
            strengths.push('Perfect fit for data structure');
        } else if (dataCompatibility > 0.6) {
            reasoning += 'Good data compatibility. ';
            strengths.push('Compatible with data structure');
        } else {
            reasoning += 'Limited data compatibility. ';
            weaknesses.push('Data structure not optimal for this chart type');
        }

        // Intent alignment reasoning
        if (intentAlignment > 0.8) {
            reasoning += 'Strong alignment with user intent. ';
            strengths.push('Directly addresses user requirements');
        } else if (intentAlignment > 0.6) {
            reasoning += 'Moderate alignment with intent. ';
        } else {
            reasoning += 'Weak intent alignment. ';
            weaknesses.push('Does not strongly address user intent');
        }

        // Visual effectiveness reasoning
        if (visualEffectiveness > 0.8) {
            strengths.push('Highly effective visualization');
        } else if (visualEffectiveness < 0.5) {
            weaknesses.push('Limited visual effectiveness for this data');
        }

        // Usability reasoning
        if (usabilityScore > 0.8) {
            strengths.push('Easy to interpret and understand');
        } else if (usabilityScore < 0.6) {
            weaknesses.push('May require more interpretation');
        }

        // Chart-specific strengths and weaknesses
        switch (chartType) {
            case 'line':
                if (dataAnalysis.availableMetrics.some(m => m.hasTimeData)) {
                    strengths.push('Excellent for showing trends over time');
                } else {
                    weaknesses.push('Less effective without temporal data');
                }
                break;
            case 'bar':
                strengths.push('Simple and intuitive comparisons');
                break;
            case 'stacked-bar':
                strengths.push('Shows both totals and composition');
                if (dataAnalysis.availableMetrics.some(m => (m.groupingDimensions?.length || 0) > 6)) {
                    weaknesses.push('May be cluttered with many categories');
                }
                break;
            case 'heatmap':
                strengths.push('Reveals complex patterns and correlations');
                weaknesses.push('Requires more cognitive effort to interpret');
                break;
            case 'waterfall':
                strengths.push('Perfect for showing cumulative changes');
                weaknesses.push('Specialized use case - not suitable for all data');
                break;
        }

        return {
            reasoning: reasoning.trim(),
            chartStrengths: strengths,
            chartWeaknesses: weaknesses
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
     * Provide reasoning for chart type selection using advanced ranking system
     */
    private reasonChartTypeSelection(
        prompt: string,
        dataAnalysis: DataAnalysis,
        selectedChartType: string,
        step: number
    ): ReasoningStep {
        // Generate comprehensive chart rankings
        const chartRankings = this.generateTopKCharts(prompt, dataAnalysis, 5);

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
            factors.push(`Visual effectiveness: ${Math.round(selectedChartRanking.visualEffectiveness * 100)}%`);
            factors.push(`Usability: ${Math.round(selectedChartRanking.usabilityScore * 100)}%`);

            // Add strengths
            if (selectedChartRanking.strengths.length > 0) {
                factors.push(`Strengths: ${selectedChartRanking.strengths.join(', ')}`);
                reasoning += `Key strengths: ${selectedChartRanking.strengths.slice(0, 2).join(' and ')}. `;
            }

            // Add reasoning from detailed analysis
            reasoning += selectedChartRanking.reasoning + ' ';

            // Explain ranking position
            if (selectedIndex === 0) {
                reasoning += 'This was the top-ranked option. ';
            } else if (selectedIndex <= 2) {
                reasoning += `This was among the top alternatives (ranked #${selectedIndex + 1}). `;
                const topChoice = chartRankings.recommendedChart;
                reasoning += `Top choice was ${topChoice.chartType} (${Math.round(topChoice.score * 100)}% score). `;
            } else {
                reasoning += `Note: Higher-ranked alternatives were available. `;
                const topChoice = chartRankings.recommendedChart;
                reasoning += `System recommendation was ${topChoice.chartType} (${Math.round(topChoice.score * 100)}% score). `;
            }
        } else {
            reasoning += `Selected ${selectedChartType} chart through AI analysis. `;
            factors.push('Chart type selected through runtime AI reasoning');
        }

        // Generate alternatives from rankings
        const alternatives = chartRankings.alternativeCharts
            .filter(alt => alt.chartType !== selectedChartType)
            .slice(0, 3)
            .map(alt => `${alt.chartType} (${Math.round(alt.score * 100)}% score) - ${alt.strengths[0] || 'viable alternative'}`);

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
        // Perform intent analysis
        const intentAnalysis = this.performIntentAnalysis(prompt);

        // Score all metrics
        const scoredMetrics = this.scoreMetricsForRelevance(prompt, availableMetrics, intentAnalysis);

        // Apply relationship analysis
        const enhancedMetrics = this.applyMetricRelationships(scoredMetrics);

        // Analyze data quality
        const qualityAnalysis = enhancedMetrics.map(scored => ({
            metric: scored.metric,
            quality: this.analyzeMetricDataQuality(scored.metric),
            scored
        }));

        // Extract quality issues
        const qualityIssues = qualityAnalysis
            .filter(qa => qa.quality.issues.length > 0)
            .map(qa => ({
                metric: qa.metric,
                issues: qa.quality.issues,
                severity: qa.quality.severity
            }));

        // Refine selection based on quality
        const refinedMetrics = qualityAnalysis
            .map(qa => {
                let adjustedScore = qa.scored.score;
                const newReasons = [...qa.scored.reasons];

                // Adjust score based on quality
                if (qa.quality.severity === 'high') {
                    adjustedScore *= 0.7;
                    newReasons.push(`Quality concerns: ${qa.quality.issues.join(', ')}`);
                } else if (qa.quality.severity === 'medium') {
                    adjustedScore *= 0.9;
                    newReasons.push(`Minor quality issues: ${qa.quality.issues.join(', ')}`);
                }

                return {
                    metric: qa.metric,
                    score: adjustedScore,
                    reasons: newReasons
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, maxMetrics);

        return {
            rankedMetrics: refinedMetrics,
            qualityIssues,
            intentAnalysis
        };
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

            // 1. Direct name matching
            if (promptLower.includes(metricName)) {
                score += 2.0;
                reasons.push('Direct name match');
            }

            // 2. Word-level matching with semantic similarity
            for (const promptWord of promptWords) {
                if (promptWord.length < 3) continue;

                for (const metricWord of metricWords) {
                    if (promptWord === metricWord) {
                        score += 1.5;
                        reasons.push(`Word match: ${promptWord}`);
                    } else if (promptWord.includes(metricWord) || metricWord.includes(promptWord)) {
                        score += 1.0;
                        reasons.push(`Partial match: ${promptWord}/${metricWord}`);
                    } else {
                        const semanticScore = this.calculateSemanticSimilarity(promptWord, metricWord);
                        if (semanticScore > 0.5) {
                            score += semanticScore;
                            reasons.push(`Semantic similarity: ${promptWord}/${metricWord}`);
                        }
                    }
                }
            }

            // 3. Intent-based boosting
            const intentBoost = this.calculateIntentBasedBoost(metric, intentAnalysis);
            score += intentBoost.score;
            if (intentBoost.reasons.length > 0) {
                reasons.push(...intentBoost.reasons);
            }

            // 4. Data structure quality
            const structureBoost = this.calculateDataStructureBoost(metric);
            score += structureBoost.score;
            if (structureBoost.reasons.length > 0) {
                reasons.push(...structureBoost.reasons);
            }

            return { metric, score, reasons };
        });
    }

    /**
     * Calculate semantic similarity between terms
     */
    private calculateSemanticSimilarity(word1: string, word2: string): number {
        // Business domain groups
        const semanticGroups = {
            financial: ['revenue', 'sales', 'income', 'profit', 'margin', 'cost', 'expense', 'cash'],
            performance: ['growth', 'performance', 'efficiency', 'kpi', 'metric'],
            customers: ['customer', 'client', 'user', 'account'],
            transactions: ['order', 'transaction', 'purchase', 'sale'],
            temporal: ['monthly', 'quarterly', 'yearly', 'period', 'time'],
            channels: ['channel', 'connector', 'source', 'platform']
        };

        // Find shared semantic groups
        for (const [groupName, terms] of Object.entries(semanticGroups)) {
            const word1InGroup = terms.some(term => word1.includes(term) || term.includes(word1));
            const word2InGroup = terms.some(term => word2.includes(term) || term.includes(word2));

            if (word1InGroup && word2InGroup) {
                return 0.7; // Strong semantic similarity
            }
        }

        // String similarity fallback
        const maxLen = Math.max(word1.length, word2.length);
        if (maxLen < 3) return 0;

        const editDistance = this.levenshteinDistance(word1, word2);
        const similarity = 1 - (editDistance / maxLen);

        return similarity > 0.7 ? similarity * 0.4 : 0;
    }

    /**
     * Calculate edit distance between strings
     */
    private levenshteinDistance(s1: string, s2: string): number {
        const dp = Array(s2.length + 1).fill(null).map(() => Array(s1.length + 1).fill(0));

        for (let i = 0; i <= s1.length; i++) dp[0][i] = i;
        for (let j = 0; j <= s2.length; j++) dp[j][0] = j;

        for (let j = 1; j <= s2.length; j++) {
            for (let i = 1; i <= s1.length; i++) {
                if (s1[i - 1] === s2[j - 1]) {
                    dp[j][i] = dp[j - 1][i - 1];
                } else {
                    dp[j][i] = Math.min(dp[j - 1][i - 1], dp[j][i - 1], dp[j - 1][i]) + 1;
                }
            }
        }

        return dp[s2.length][s1.length];
    }

    /**
     * Calculate intent-based metric boosting
     */
    private calculateIntentBasedBoost(
        metric: MetricInfo,
        intentAnalysis: IntentAnalysis
    ): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];

        const primaryIntent = intentAnalysis.primaryIntent.type;

        // Temporal intent boosting
        if (primaryIntent === 'temporal_trend' && metric.hasTimeData) {
            score += 1.0;
            reasons.push('Perfect for temporal analysis');
        }

        // Comparison intent boosting
        if (primaryIntent === 'categorical_comparison' && metric.hasGrouping) {
            const categories = metric.groupingDimensions?.length || 0;
            if (categories >= 2 && categories <= 8) {
                score += 0.8;
                reasons.push('Good for categorical comparison');
            }
        }

        // Overview intent boosting
        if (primaryIntent === 'performance_overview') {
            if (metric.name.match(/revenue|sales|profit|customer|order/i)) {
                score += 0.6;
                reasons.push('Key business metric');
            }
        }

        return { score, reasons };
    }

    /**
     * Calculate data structure quality boost
     */
    private calculateDataStructureBoost(metric: MetricInfo): { score: number; reasons: string[] } {
        let score = 0;
        const reasons: string[] = [];

        if (metric.hasTimeData && metric.hasGrouping) {
            score += 0.3;
            reasons.push('Rich data structure');
        }

        if (metric.valueType === 'currency' || metric.valueType === 'percentage') {
            score += 0.2;
            reasons.push('Well-defined value type');
        }

        return { score, reasons };
    }

    /**
     * Apply metric relationship analysis
     */
    private applyMetricRelationships(
        scoredMetrics: { metric: MetricInfo; score: number; reasons: string[] }[]
    ): { metric: MetricInfo; score: number; reasons: string[] }[] {
        const topMetrics = scoredMetrics.slice(0, 3);

        return scoredMetrics.map(scored => {
            let relationshipBoost = 0;
            const newReasons = [...scored.reasons];

            for (const topMetric of topMetrics) {
                if (scored.metric.name === topMetric.metric.name) continue;

                const relationship = this.analyzeMetricRelationship(scored.metric, topMetric.metric);
                if (relationship.score > 0) {
                    relationshipBoost += relationship.score * 0.5; // Scale down relationship boost
                    newReasons.push(`Related to ${topMetric.metric.name}: ${relationship.type}`);
                }
            }

            return {
                ...scored,
                score: scored.score + relationshipBoost,
                reasons: newReasons
            };
        });
    }

    /**
     * Analyze relationship between metrics
     */
    private analyzeMetricRelationship(metric1: MetricInfo, metric2: MetricInfo): { score: number; type: string } {
        const name1 = metric1.name.toLowerCase();
        const name2 = metric2.name.toLowerCase();

        // Domain relationships
        const domains = {
            sales: ['sales', 'revenue', 'orders'],
            financial: ['profit', 'margin', 'cost', 'cash'],
            customer: ['customer', 'user', 'client']
        };

        for (const [domain, keywords] of Object.entries(domains)) {
            const metric1InDomain = keywords.some(k => name1.includes(k));
            const metric2InDomain = keywords.some(k => name2.includes(k));

            if (metric1InDomain && metric2InDomain) {
                return { score: 0.5, type: `Same ${domain} domain` };
            }
        }

        // Complementary relationships
        if ((name1.includes('gross') && name2.includes('net')) ||
            (name2.includes('gross') && name1.includes('net'))) {
            return { score: 0.7, type: 'Complementary metrics' };
        }

        return { score: 0, type: 'No relationship' };
    }

    /**
     * Analyze metric data quality
     */
    analyzeMetricDataQuality(metric: MetricInfo): {
        issues: string[];
        severity: 'low' | 'medium' | 'high';
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let severity: 'low' | 'medium' | 'high' = 'low';

        // Check grouping quality
        if (metric.hasGrouping) {
            const categoryCount = metric.groupingDimensions?.length || 0;
            if (categoryCount === 0) {
                issues.push('No categories available');
                severity = 'high';
            } else if (categoryCount === 1) {
                issues.push('Only one category');
                severity = 'medium';
            } else if (categoryCount > 10) {
                issues.push('Too many categories');
                severity = 'medium';
            }

            // Check for unknown categories
            const unknownCount = metric.groupingDimensions?.filter(dim =>
                dim.toLowerCase().includes('unknown') || dim.toLowerCase().includes('undefined')
            ).length || 0;

            if (unknownCount > categoryCount * 0.3) {
                issues.push('High proportion of unknown categories');
                severity = severity === 'high' ? 'high' : 'medium';
            }
        }

        // Check value type
        if (metric.valueType === 'generic') {
            issues.push('Generic value type');
            if (severity === 'low') severity = 'low';
        }

        // Check for problematic names
        if (metric.name.toLowerCase().includes('test') || metric.name.toLowerCase().includes('debug')) {
            issues.push('Test/debug metric');
            severity = 'high';
        }

        return { issues, severity, recommendations };
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

    /**
     * Public helper: select top metrics and for each, select the best chart using shared intent
     * Returns selections along with full reasoning per metric-chart pair
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
            // Create a per-metric view of available data to score chart compatibility accurately
            const filteredDataAnalysis: DataAnalysis = {
                ...dataAnalysis,
                availableMetrics: [metric]
            };

            const chartAnalysis = this.generateTopKCharts(
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
} 