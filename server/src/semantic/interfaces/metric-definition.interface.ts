/**
 * Interface for defining ecommerce metrics in the semantic layer
 */
export interface MetricDefinition {
    /** Unique identifier for the metric */
    id: string;

    /** Display name for the metric */
    name: string;

    /** Alternative names and aliases for the metric */
    aliases: string[];

    /** Detailed description of what this metric measures */
    description: string;

    /** Category this metric belongs to */
    category: MetricCategory;

    /** Subcategory for more granular organization */
    subcategory?: string;

    /** Type of value this metric represents */
    valueType: 'currency' | 'percentage' | 'count' | 'ratio' | 'rate' | 'generic';

    /** Unit of measurement (e.g., 'USD', '%', 'orders') */
    unit?: string;

    /** Calculation formula if this is a calculated metric */
    calculation?: MetricCalculation;

    /** Other metrics this metric depends on */
    dependencies?: string[];

    /** Typical data sources for this metric */
    dataSources: string[];

    /** Business context and interpretation guidelines */
    businessContext: BusinessContext;

    /** Recommended chart types for visualizing this metric */
    recommendedChartTypes: ChartType[];

    /** Whether this metric supports time-series analysis */
    supportsTimeSeries: boolean;

    /** Whether this metric can be broken down by categories */
    supportsGrouping: boolean;

    /** Possible grouping dimensions */
    groupingDimensions?: string[];

    /** Typical value ranges for validation */
    typicalRange?: {
        min?: number;
        max?: number;
        expected?: number;
    };
}

/**
 * Main categories of ecommerce metrics
 */
export type MetricCategory = 
    | 'sales'
    | 'cogs'
    | 'profitability' 
    | 'unit_economics'
    | 'marketing'
    | 'cash_flow'
    | 'quantities'
    | 'subscribers'
    | 'operations';

/**
 * Chart types supported by the system
 */
export type ChartType = 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';

/**
 * Calculation definition for computed metrics
 */
export interface MetricCalculation {
    /** Formula expression using metric IDs */
    formula: string;

    /** Human-readable description of the calculation */
    description: string;

    /** Order of operations or calculation steps */
    steps?: string[];

    /** Whether this calculation requires specific time aggregation */
    aggregationLevel?: 'daily' | 'monthly' | 'quarterly' | 'yearly';
}

/**
 * Business context and interpretation guidelines
 */
export interface BusinessContext {
    /** What this metric indicates about business performance */
    interpretation: string;

    /** When this metric is typically used */
    useCase: string[];

    /** Industry benchmarks or typical values */
    benchmarks?: {
        excellent?: number;
        good?: number;
        average?: number;
        poor?: number;
    };

    /** Related metrics that provide additional context */
    relatedMetrics: string[];

    /** Key insights this metric can reveal */
    keyInsights: string[];

    /** Common analysis patterns for this metric */
    analysisPatterns: string[];
}

/**
 * Relationship between metrics
 */
export interface MetricRelationship {
    /** Source metric ID */
    fromMetric: string;

    /** Target metric ID */
    toMetric: string;

    /** Type of relationship */
    relationshipType: 'feeds_into' | 'composed_of' | 'correlates_with' | 'inverse_of' | 'ratio_with';

    /** Strength of the relationship (0-1) */
    strength: number;

    /** Description of how they relate */
    description: string;
}

/**
 * Semantic context for enhanced AI understanding
 */
export interface SemanticContext {
    /** Available metric definitions */
    metrics: MetricDefinition[];

    /** Relationships between metrics */
    relationships: MetricRelationship[];

    /** Business domain knowledge */
    domainKnowledge: {
        /** Common business terms and their meanings */
        terminology: Record<string, string>;

        /** Typical analysis workflows */
        workflows: string[];

        /** Industry-specific considerations */
        industryContext: string[];
    };
}