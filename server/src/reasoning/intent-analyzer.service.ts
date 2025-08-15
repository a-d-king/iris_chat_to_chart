import { Injectable } from '@nestjs/common';

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
 * Service responsible for analyzing user intent from natural language prompts
 */
@Injectable()
export class IntentAnalyzerService {

    /**
     * Perform comprehensive intent analysis using semantic understanding
     * @param prompt - User's natural language prompt
     * @returns Detailed intent analysis results
     */
    performIntentAnalysis(prompt: string): IntentAnalysis {
        const promptLower = prompt.toLowerCase();
        const words = promptLower.split(/\s+/);

        // Handle negations and complex queries
        const preprocessedPrompt = this.preprocessComplexQuery(promptLower);
        const negationContext = this.analyzeNegations(promptLower);
        const temporalContext = this.analyzeTemporalPatterns(promptLower);

        // Define intent patterns with semantic understanding (enhanced with ecommerce terms)
        const intentPatterns = {
            temporal_trend: {
                keywords: ['trend', 'over time', 'growth', 'decline', 'change', 'progression', 'evolution', 'trajectory', 'movement', 'pattern', 'trajectory', 'runway', 'burn rate'],
                semanticSignals: ['month', 'year', 'quarter', 'week', 'daily', 'annual', 'seasonal', 'historical', 'yoy', 'mom', 'qoq'],
                weight: 1.0
            },
            categorical_comparison: {
                keywords: ['compare', 'vs', 'versus', 'against', 'between', 'difference', 'contrast', 'relative to', 'channel', 'segment', 'cohort'],
                semanticSignals: ['better', 'worse', 'higher', 'lower', 'best', 'worst', 'top', 'bottom', 'efficient', 'effective', 'performing'],
                weight: 1.0
            },
            compositional_breakdown: {
                keywords: ['breakdown', 'composition', 'parts', 'segments', 'by', 'split', 'divide', 'portion', 'waterfall', 'attribution'],
                semanticSignals: ['category', 'type', 'group', 'segment', 'component', 'part', 'share', 'contribution', 'allocation'],
                weight: 1.0
            },
            performance_overview: {
                keywords: ['overview', 'dashboard', 'summary', 'performance', 'status', 'snapshot', 'overall', 'kpi', 'metrics', 'health'],
                semanticSignals: ['key', 'main', 'primary', 'important', 'critical', 'total', 'overall', 'executive', 'strategic'],
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
     * Extract explicitly mentioned metrics from the prompt (enhanced with ecommerce metrics and semantic matching)
     */
    private extractExplicitMetrics(prompt: string): string[] {
        const metricPatterns = [
            // Core business metrics
            'sales', 'revenue', 'profit', 'margin', 'cost', 'expenses', 'income',
            'customers', 'users', 'orders', 'transactions', 'conversion',
            'growth', 'decline', 'performance', 'efficiency', 'productivity',
            'cash', 'balance', 'debt', 'assets', 'liabilities',
            
            // Ecommerce-specific metrics
            'aov', 'average order value', 'cac', 'customer acquisition cost',
            'ltv', 'lifetime value', 'clv', 'customer lifetime value',
            'roas', 'return on ad spend', 'mer', 'marketing efficiency',
            'cogs', 'cost of goods sold', 'gross profit', 'contribution margin',
            'net income', 'runway', 'burn rate', 'churn', 'retention',
            
            // Marketing metrics
            'cpc', 'cost per click', 'cpm', 'cost per mille', 'ctr', 'click through rate',
            'facebook ads', 'google ads', 'amazon ads', 'ad spend',
            
            // Operational metrics
            'fulfillment', 'shipping', 'freight', '3pl', 'logistics',
            'refunds', 'discounts', 'returns', 'chargebacks',
            
            // Financial metrics
            'cash flow', 'operating expenses', 'op ex', 'credit card balance',
            'payment fees', 'merchant fees', 'processor fees',

            // Business intelligence terms
            'kpi', 'key performance indicator', 'metrics', 'dashboard',
            'benchmarks', 'targets', 'goals', 'performance indicators',
            
            // Analytical terms that suggest metric focus
            'measure', 'track', 'monitor', 'analyze', 'evaluate', 'assess'
        ];

        const explicitMetrics = metricPatterns.filter(metric => 
            prompt.toLowerCase().includes(metric.toLowerCase())
        );

        // Add semantic analysis for business domains
        const promptLower = prompt.toLowerCase();
        
        // Detect business domain mentions that imply specific metrics
        if (promptLower.includes('unit economics') || promptLower.includes('customer economics')) {
            explicitMetrics.push('unit economics', 'aov', 'cac', 'ltv');
        }
        
        if (promptLower.includes('profitability') || promptLower.includes('p&l') || promptLower.includes('profit and loss')) {
            explicitMetrics.push('profitability', 'gross profit', 'net income', 'margins');
        }
        
        if (promptLower.includes('marketing performance') || promptLower.includes('marketing roi')) {
            explicitMetrics.push('marketing', 'roas', 'cac', 'ad spend');
        }
        
        if (promptLower.includes('financial health') || promptLower.includes('cash position')) {
            explicitMetrics.push('cash flow', 'runway', 'burn rate');
        }

        return [...new Set(explicitMetrics)]; // Remove duplicates
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
}