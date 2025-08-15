import { MetricDefinition, MetricRelationship } from './metric-definition.interface';

/**
 * Enhanced semantic context for natural language understanding
 */
export interface EnhancedSemanticContext {
    /** Query-specific metric suggestions */
    suggestedMetrics: SuggestedMetric[];

    /** Business domain context for the query */
    domainContext: DomainContext;

    /** Semantic enrichment for existing data analysis */
    enrichment: AnalysisEnrichment;
}

/**
 * Metric suggestion with semantic reasoning
 */
export interface SuggestedMetric {
    /** Metric definition */
    metric: MetricDefinition;

    /** Relevance score (0-1) */
    relevanceScore: number;

    /** Why this metric was suggested */
    reasoning: string[];

    /** Confidence in the suggestion */
    confidence: number;

    /** Related metrics to consider */
    relatedSuggestions: string[];
}

/**
 * Domain-specific context for business analysis
 */
export interface DomainContext {
    /** Primary business area being analyzed */
    primaryDomain: string;

    /** Secondary domains that might be relevant */
    secondaryDomains: string[];

    /** Business questions this analysis might answer */
    businessQuestions: string[];

    /** Recommended analysis approaches */
    analysisApproaches: string[];

    /** Industry benchmarks relevant to the query */
    relevantBenchmarks: Record<string, number>;
}

/**
 * Enrichment information for existing data analysis
 */
export interface AnalysisEnrichment {
    /** Enhanced descriptions for discovered metrics */
    metricDescriptions: Record<string, string>;

    /** Business context for each metric */
    metricContext: Record<string, BusinessMetricContext>;

    /** Suggested metric combinations for deeper analysis */
    suggestedCombinations: MetricCombination[];

    /** Quality insights about the metrics */
    qualityInsights: QualityInsight[];
}

/**
 * Business context specific to a metric in the current analysis
 */
export interface BusinessMetricContext {
    /** What this metric reveals in the business context */
    businessMeaning: string;

    /** How to interpret values for this metric */
    interpretationGuidance: string;

    /** Typical actions based on this metric */
    actionableInsights: string[];

    /** Warning signs to look for */
    warnings: string[];
}

/**
 * Suggested combination of metrics for comprehensive analysis
 */
export interface MetricCombination {
    /** Metrics in this combination */
    metrics: string[];

    /** What this combination reveals */
    insight: string;

    /** Recommended visualization approach */
    visualizationApproach: string;

    /** Business value of this combination */
    businessValue: string;
}

/**
 * Quality insights about metric data and analysis
 */
export interface QualityInsight {
    /** Metric this insight applies to */
    metricId: string;

    /** Type of quality insight */
    type: 'data_quality' | 'business_logic' | 'temporal_pattern' | 'anomaly' | 'benchmark_comparison';

    /** Severity level */
    severity: 'info' | 'warning' | 'critical';

    /** Description of the insight */
    description: string;

    /** Recommended action if any */
    recommendation?: string;
}