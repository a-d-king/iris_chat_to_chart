import { Injectable, Logger } from '@nestjs/common';
import { MetricDefinition } from './interfaces/metric-definition.interface';
import { BusinessMetricContext, QualityInsight } from './interfaces/semantic-context.interface';

/**
 * Represents business performance benchmarks for a metric
 */
export interface BusinessBenchmark {
    /** Industry or category this benchmark applies to */
    context: string;
    /** Excellent performance threshold */
    excellent: number;
    /** Good performance threshold */
    good: number;
    /** Average performance threshold */
    average: number;
    /** Poor performance threshold */
    poor: number;
    /** Unit of measurement */
    unit: string;
    /** Additional context about the benchmark */
    notes?: string;
}

/**
 * Business analysis pattern definition
 */
export interface AnalysisPattern {
    /** Pattern identifier */
    id: string;
    /** Pattern name */
    name: string;
    /** Description of the pattern */
    description: string;
    /** Metrics involved in this pattern */
    requiredMetrics: string[];
    /** Optional metrics that enhance the analysis */
    optionalMetrics?: string[];
    /** Business questions this pattern answers */
    businessQuestions: string[];
    /** Recommended visualization approach */
    visualization: string[];
    /** When to use this pattern */
    useCase: string;
    /** Expected insights from this pattern */
    expectedInsights: string[];
}

/**
 * Business validation rule
 */
export interface ValidationRule {
    /** Rule identifier */
    id: string;
    /** Metric this rule applies to */
    metricId: string;
    /** Type of validation */
    type: 'range' | 'ratio' | 'trend' | 'logical';
    /** Rule description */
    description: string;
    /** Validation logic */
    condition: string;
    /** Severity of violation */
    severity: 'info' | 'warning' | 'error';
    /** Message when rule is violated */
    message: string;
    /** Suggested action */
    action?: string;
}

/**
 * Service providing business context and domain knowledge for ecommerce metrics
 */
@Injectable()
export class BusinessContextService {
    private readonly logger = new Logger(BusinessContextService.name);
    private benchmarks: Map<string, BusinessBenchmark[]> = new Map();
    private analysisPatterns: Map<string, AnalysisPattern> = new Map();
    private validationRules: Map<string, ValidationRule[]> = new Map();

    constructor() {
        this.initializeBusinessContext();
        this.logger.log('BusinessContextService initialized');
    }

    /**
     * Get business benchmarks for a metric
     */
    getBenchmarks(metricId: string): BusinessBenchmark[] {
        return this.benchmarks.get(metricId) || [];
    }

    /**
     * Get business interpretation for a metric value
     */
    interpretMetricValue(metricId: string, value: number, context?: any): BusinessMetricContext {
        const benchmarks = this.getBenchmarks(metricId);
        const interpretation = this.generateInterpretation(metricId, value, benchmarks);
        const actionableInsights = this.generateActionableInsights(metricId, value, benchmarks);
        const warnings = this.generateWarnings(metricId, value, benchmarks);

        return {
            businessMeaning: interpretation.meaning,
            interpretationGuidance: interpretation.guidance,
            actionableInsights,
            warnings
        };
    }

    /**
     * Get relevant analysis patterns for a set of metrics
     */
    getRelevantAnalysisPatterns(availableMetrics: string[]): AnalysisPattern[] {
        const relevantPatterns: AnalysisPattern[] = [];

        for (const pattern of this.analysisPatterns.values()) {
            const hasRequiredMetrics = pattern.requiredMetrics.every(required => 
                availableMetrics.includes(required)
            );

            if (hasRequiredMetrics) {
                relevantPatterns.push(pattern);
            }
        }

        return relevantPatterns.sort((a, b) => b.requiredMetrics.length - a.requiredMetrics.length);
    }

    /**
     * Validate metric values against business rules
     */
    validateMetricValue(metricId: string, value: number, context?: any): QualityInsight[] {
        const rules = this.validationRules.get(metricId) || [];
        const insights: QualityInsight[] = [];

        for (const rule of rules) {
            const violation = this.evaluateRule(rule, value, context);
            if (violation) {
                insights.push({
                    metricId,
                    type: 'business_logic',
                    severity: rule.severity,
                    description: rule.message,
                    recommendation: rule.action
                });
            }
        }

        return insights;
    }

    /**
     * Get business context for metric relationships
     */
    getRelationshipContext(fromMetric: string, toMetric: string): string {
        const relationshipContexts = {
            'cac_ltv': 'LTV/CAC ratio is critical for sustainable growth. Aim for 3:1 or higher.',
            'aov_margin': 'Higher AOV typically improves contribution margins through better cost absorption.',
            'marketing_roas': 'ROAS should account for full customer lifetime value, not just first purchase.',
            'churn_growth': 'Net growth requires balancing acquisition with retention effectiveness.',
            'cash_runway': 'Runway calculations must factor in growth plans and seasonal cash flow patterns.'
        };

        const key = `${fromMetric}_${toMetric}`;
        return relationshipContexts[key] || 'Analyze the relationship between these metrics for business insights.';
    }

    /**
     * Get recommended next steps for metric analysis
     */
    getRecommendedNextSteps(metricId: string, value: number): string[] {
        const steps: string[] = [];
        const benchmarks = this.getBenchmarks(metricId);

        if (benchmarks.length > 0) {
            const benchmark = benchmarks[0];
            
            if (value < benchmark.poor) {
                steps.push(`Immediate attention needed - ${metricId} is significantly below industry standards`);
                steps.push('Conduct root cause analysis to identify improvement opportunities');
            } else if (value < benchmark.average) {
                steps.push(`${metricId} has room for improvement compared to industry benchmarks`);
                steps.push('Identify 2-3 key initiatives to optimize performance');
            } else if (value >= benchmark.excellent) {
                steps.push(`${metricId} is performing excellently - consider sharing best practices`);
                steps.push('Monitor for sustainability and potential further optimization');
            }
        }

        // Add metric-specific recommendations
        const specificSteps = this.getMetricSpecificRecommendations(metricId, value);
        steps.push(...specificSteps);

        return steps;
    }

    /**
     * Initialize business context data
     */
    private initializeBusinessContext(): void {
        this.initializeBenchmarks();
        this.initializeAnalysisPatterns();
        this.initializeValidationRules();
    }

    /**
     * Initialize industry benchmarks
     */
    private initializeBenchmarks(): void {
        // Unit Economics Benchmarks
        this.benchmarks.set('ltv_cac_ratio', [{
            context: 'Ecommerce SaaS',
            excellent: 5.0,
            good: 3.0,
            average: 2.0,
            poor: 1.0,
            unit: 'ratio',
            notes: 'LTV:CAC ratio of 3:1 is minimum for healthy unit economics'
        }]);

        this.benchmarks.set('cac', [{
            context: 'Ecommerce D2C',
            excellent: 25,
            good: 50,
            average: 75,
            poor: 100,
            unit: 'USD',
            notes: 'CAC varies significantly by industry and customer value'
        }]);

        this.benchmarks.set('net_mer', [{
            context: 'Ecommerce',
            excellent: 4.0,
            good: 3.0,
            average: 2.0,
            poor: 1.5,
            unit: 'ratio',
            notes: 'ROAS of 4:1 indicates strong marketing efficiency'
        }]);

        // Profitability Benchmarks
        this.benchmarks.set('cm_margin', [{
            context: 'Ecommerce',
            excellent: 0.4,
            good: 0.3,
            average: 0.2,
            poor: 0.1,
            unit: 'percentage',
            notes: 'Contribution margin above 30% allows for growth investment'
        }]);

        this.benchmarks.set('net_margin', [{
            context: 'Ecommerce',
            excellent: 0.15,
            good: 0.10,
            average: 0.05,
            poor: 0.00,
            unit: 'percentage',
            notes: 'Net margins above 10% indicate mature, efficient operations'
        }]);

        // Engagement Benchmarks
        this.benchmarks.set('ctr', [{
            context: 'Facebook Ads',
            excellent: 0.02,
            good: 0.015,
            average: 0.01,
            poor: 0.005,
            unit: 'percentage',
            notes: 'CTR varies by industry, audience, and campaign type'
        }]);

        // Cash Flow Benchmarks
        this.benchmarks.set('runway_months', [{
            context: 'Growing Business',
            excellent: 18,
            good: 12,
            average: 6,
            poor: 3,
            unit: 'months',
            notes: 'Minimum 6 months runway recommended for operational stability'
        }]);
    }

    /**
     * Initialize business analysis patterns
     */
    private initializeAnalysisPatterns(): void {
        // Unit Economics Analysis
        this.analysisPatterns.set('unit_economics', {
            id: 'unit_economics',
            name: 'Unit Economics Analysis',
            description: 'Comprehensive analysis of customer acquisition and lifetime value',
            requiredMetrics: ['cac', 'ltv', 'aov'],
            optionalMetrics: ['ltv_cac_ratio', 'contribution_margin', 'payback_period'],
            businessQuestions: [
                'Are we acquiring customers profitably?',
                'What is our customer payback period?',
                'How sustainable is our growth model?'
            ],
            visualization: ['bar', 'line', 'waterfall'],
            useCase: 'Evaluate business model sustainability and growth potential',
            expectedInsights: [
                'Customer acquisition efficiency',
                'Growth sustainability assessment',
                'Optimization opportunities'
            ]
        });

        // Profitability Deep Dive
        this.analysisPatterns.set('profitability_analysis', {
            id: 'profitability_analysis',
            name: 'Profitability Deep Dive',
            description: 'Complete margin analysis from gross profit to net income',
            requiredMetrics: ['total_net_sales', 'total_cogs', 'contribution_margin'],
            optionalMetrics: ['product_gross_profit', 'delivered_gross_profit', 'net_income'],
            businessQuestions: [
                'Where are we losing margin?',
                'What drives our profitability?',
                'How can we improve margins?'
            ],
            visualization: ['waterfall', 'stacked-bar', 'line'],
            useCase: 'Identify margin improvement opportunities and cost optimization',
            expectedInsights: [
                'Margin leakage analysis',
                'Cost structure optimization',
                'Profitability drivers'
            ]
        });

        // Marketing Efficiency Analysis
        this.analysisPatterns.set('marketing_efficiency', {
            id: 'marketing_efficiency',
            name: 'Marketing Channel Efficiency',
            description: 'Multi-channel marketing performance and ROI analysis',
            requiredMetrics: ['total_marketing', 'net_mer', 'cac'],
            optionalMetrics: ['fb_ads', 'google_ads', 'amazon_ads', 'amer'],
            businessQuestions: [
                'Which channels are most efficient?',
                'How should we allocate marketing budget?',
                'What is our blended marketing performance?'
            ],
            visualization: ['bar', 'stacked-bar', 'line'],
            useCase: 'Optimize marketing spend allocation and improve ROI',
            expectedInsights: [
                'Channel performance comparison',
                'Budget allocation optimization',
                'Marketing mix effectiveness'
            ]
        });

        // Customer Behavior Analysis
        this.analysisPatterns.set('customer_behavior', {
            id: 'customer_behavior',
            name: 'Customer Behavior Analysis',
            description: 'New vs returning customer behavior and value analysis',
            requiredMetrics: ['new_customers', 'returning_customers', 'new_customer_aov'],
            optionalMetrics: ['returning_customer_aov', 'ltv', 'retention_rate'],
            businessQuestions: [
                'How do new and returning customers behave differently?',
                'What is the value progression of customers?',
                'How effective are our retention efforts?'
            ],
            visualization: ['bar', 'line', 'stacked-bar'],
            useCase: 'Understand customer lifecycle and optimize retention strategies',
            expectedInsights: [
                'Customer lifecycle patterns',
                'Retention opportunities',
                'Value progression analysis'
            ]
        });

        // Cash Flow Health Check
        this.analysisPatterns.set('cash_flow_health', {
            id: 'cash_flow_health',
            name: 'Cash Flow Health Check',
            description: 'Comprehensive cash flow and financial runway analysis',
            requiredMetrics: ['cash_on_hand', 'runway_months', 'change_in_cash'],
            optionalMetrics: ['op_ex', 'net_income', 'credit_card_balance'],
            businessQuestions: [
                'How healthy is our cash position?',
                'How long can we operate at current burn rate?',
                'What are our cash flow trends?'
            ],
            visualization: ['line', 'waterfall', 'bar'],
            useCase: 'Monitor financial health and plan for growth or fundraising',
            expectedInsights: [
                'Financial runway assessment',
                'Cash flow trends',
                'Burn rate optimization'
            ]
        });
    }

    /**
     * Initialize business validation rules
     */
    private initializeValidationRules(): void {
        // LTV/CAC Ratio validation
        this.validationRules.set('ltv_cac_ratio', [{
            id: 'ltv_cac_minimum',
            metricId: 'ltv_cac_ratio',
            type: 'range',
            description: 'LTV/CAC ratio below 3:1 indicates unsustainable unit economics',
            condition: 'value < 3.0',
            severity: 'warning',
            message: 'LTV/CAC ratio is below the recommended 3:1 minimum for sustainable growth',
            action: 'Focus on improving customer lifetime value or reducing acquisition costs'
        }]);

        // Contribution Margin validation
        this.validationRules.set('cm_margin', [{
            id: 'cm_margin_minimum',
            metricId: 'cm_margin',
            type: 'range',
            description: 'Contribution margin below 20% limits growth investment capacity',
            condition: 'value < 0.2',
            severity: 'warning',
            message: 'Contribution margin is below 20%, which may limit growth investment capacity',
            action: 'Review cost structure and pricing strategy to improve margins'
        }]);

        // Cash Runway validation
        this.validationRules.set('runway_months', [{
            id: 'runway_critical',
            metricId: 'runway_months',
            type: 'range',
            description: 'Cash runway below 6 months requires immediate attention',
            condition: 'value < 6',
            severity: 'error',
            message: 'Cash runway is critically low - less than 6 months remaining',
            action: 'Implement immediate cash preservation measures or secure additional funding'
        }]);

        // ROAS validation
        this.validationRules.set('net_mer', [{
            id: 'roas_minimum',
            metricId: 'net_mer',
            type: 'range',
            description: 'ROAS below 2:1 indicates inefficient marketing spend',
            condition: 'value < 2.0',
            severity: 'warning',
            message: 'ROAS is below 2:1, indicating potentially inefficient marketing spend',
            action: 'Review marketing channels and optimize campaigns for better returns'
        }]);
    }

    /**
     * Generate business interpretation for a metric value
     */
    private generateInterpretation(metricId: string, value: number, benchmarks: BusinessBenchmark[]): { meaning: string; guidance: string } {
        let meaning = `Current ${metricId} value is ${value}`;
        let guidance = 'Monitor trends and compare with historical performance';

        if (benchmarks.length > 0) {
            const benchmark = benchmarks[0];
            
            if (value >= benchmark.excellent) {
                meaning += ' - Excellent performance, significantly above industry standards';
                guidance = 'Maintain current strategies and consider scaling successful approaches';
            } else if (value >= benchmark.good) {
                meaning += ' - Good performance, above average for the industry';
                guidance = 'Continue current approach with minor optimizations for excellence';
            } else if (value >= benchmark.average) {
                meaning += ' - Average performance, meeting industry standards';
                guidance = 'Identify improvement opportunities to reach good performance levels';
            } else {
                meaning += ' - Below average performance, needs improvement';
                guidance = 'Urgent attention required - implement improvement initiatives immediately';
            }
        }

        return { meaning, guidance };
    }

    /**
     * Generate actionable insights for a metric
     */
    private generateActionableInsights(metricId: string, value: number, benchmarks: BusinessBenchmark[]): string[] {
        const insights: string[] = [];

        // Add metric-specific insights
        switch (metricId) {
            case 'cac':
                insights.push('Optimize marketing channels with lowest CAC');
                insights.push('Improve conversion rates to reduce acquisition costs');
                break;
            case 'ltv':
                insights.push('Focus on customer retention and repeat purchases');
                insights.push('Implement upselling and cross-selling strategies');
                break;
            case 'aov':
                insights.push('Bundle products to increase average order size');
                insights.push('Implement minimum order thresholds for free shipping');
                break;
            case 'contribution_margin':
                insights.push('Review pricing strategy for margin improvement');
                insights.push('Optimize cost structure and supplier relationships');
                break;
        }

        return insights;
    }

    /**
     * Generate warnings based on metric performance
     */
    private generateWarnings(metricId: string, value: number, benchmarks: BusinessBenchmark[]): string[] {
        const warnings: string[] = [];

        if (benchmarks.length > 0) {
            const benchmark = benchmarks[0];
            
            if (value < benchmark.poor) {
                warnings.push(`${metricId} is significantly below industry standards - immediate action required`);
            }
        }

        return warnings;
    }

    /**
     * Get metric-specific recommendations
     */
    private getMetricSpecificRecommendations(metricId: string, value: number): string[] {
        const recommendations: string[] = [];

        switch (metricId) {
            case 'ltv_cac_ratio':
                if (value < 3) {
                    recommendations.push('Focus on improving customer lifetime value through retention programs');
                    recommendations.push('Optimize marketing spend efficiency to reduce CAC');
                }
                break;
            case 'runway_months':
                if (value < 12) {
                    recommendations.push('Evaluate funding options or implement cost reduction measures');
                    recommendations.push('Accelerate revenue growth initiatives');
                }
                break;
            case 'net_mer':
                if (value < 3) {
                    recommendations.push('Pause underperforming marketing channels');
                    recommendations.push('Double down on high-ROAS channels and campaigns');
                }
                break;
        }

        return recommendations;
    }

    /**
     * Evaluate a business validation rule
     */
    private evaluateRule(rule: ValidationRule, value: number, context?: any): boolean {
        try {
            // Simple condition evaluation - in production, use a proper expression evaluator
            switch (rule.condition) {
                case 'value < 3.0':
                    return value < 3.0;
                case 'value < 0.2':
                    return value < 0.2;
                case 'value < 6':
                    return value < 6;
                case 'value < 2.0':
                    return value < 2.0;
                default:
                    return false;
            }
        } catch (error) {
            this.logger.warn(`Error evaluating validation rule ${rule.id}: ${error.message}`);
            return false;
        }
    }
}