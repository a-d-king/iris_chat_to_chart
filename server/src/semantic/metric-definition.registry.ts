import { Injectable, Logger } from '@nestjs/common';
import { MetricDefinition, MetricRelationship, SemanticContext } from './interfaces/metric-definition.interface';

/**
 * Registry service for ecommerce metric definitions
 * Contains comprehensive definitions for all business metrics
 */
@Injectable()
export class MetricDefinitionRegistry {
    private readonly logger = new Logger(MetricDefinitionRegistry.name);
    private readonly metrics: Map<string, MetricDefinition> = new Map();
    private readonly relationships: MetricRelationship[] = [];
    private initialized = false;

    constructor() {
        this.initializeRegistry();
    }

    /**
     * Get metric definition by ID or name
     */
    getMetricDefinition(identifier: string): MetricDefinition | null {
        // Try direct ID lookup first
        let metric = this.metrics.get(identifier);
        if (metric) return metric;

        // Try case-insensitive name lookup
        const normalizedIdentifier = identifier.toLowerCase();
        for (const [id, definition] of this.metrics) {
            if (definition.name.toLowerCase() === normalizedIdentifier) {
                return definition;
            }
            
            // Check aliases
            if (definition.aliases.some(alias => alias.toLowerCase() === normalizedIdentifier)) {
                return definition;
            }
        }

        return null;
    }

    /**
     * Get all metric definitions
     */
    getAllMetrics(): MetricDefinition[] {
        return Array.from(this.metrics.values());
    }

    /**
     * Get metrics by category
     */
    getMetricsByCategory(category: string): MetricDefinition[] {
        return Array.from(this.metrics.values())
            .filter(metric => metric.category === category);
    }

    /**
     * Get related metrics for a given metric
     */
    getRelatedMetrics(metricId: string): string[] {
        return this.relationships
            .filter(rel => rel.fromMetric === metricId || rel.toMetric === metricId)
            .map(rel => rel.fromMetric === metricId ? rel.toMetric : rel.fromMetric);
    }

    /**
     * Get all metric relationships
     */
    getRelationships(): MetricRelationship[] {
        return [...this.relationships];
    }

    /**
     * Search metrics by term (name, alias, or description)
     */
    searchMetrics(term: string, limit = 10): MetricDefinition[] {
        const termLower = term.toLowerCase();
        const results: Array<{ metric: MetricDefinition; score: number }> = [];

        for (const metric of this.metrics.values()) {
            let score = 0;

            // Exact name match
            if (metric.name.toLowerCase() === termLower) {
                score += 100;
            } else if (metric.name.toLowerCase().includes(termLower)) {
                score += 50;
            }

            // Alias matches
            for (const alias of metric.aliases) {
                if (alias.toLowerCase() === termLower) {
                    score += 90;
                } else if (alias.toLowerCase().includes(termLower)) {
                    score += 40;
                }
            }

            // Description match
            if (metric.description.toLowerCase().includes(termLower)) {
                score += 20;
            }

            // Category/subcategory match
            if (metric.category.toLowerCase().includes(termLower)) {
                score += 30;
            }
            if (metric.subcategory?.toLowerCase().includes(termLower)) {
                score += 25;
            }

            if (score > 0) {
                results.push({ metric, score });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit)
            .map(result => result.metric);
    }

    /**
     * Get complete semantic context
     */
    getSemanticContext(): SemanticContext {
        return {
            metrics: this.getAllMetrics(),
            relationships: this.getRelationships(),
            domainKnowledge: {
                terminology: {
                    'AOV': 'Average Order Value - Total Net Sales divided by Order Quantity',
                    'CAC': 'Customer Acquisition Cost - Total Ad Spend divided by New Customer Quantity',
                    'LTV': 'Customer Lifetime Value - Total Net Sales divided by Unique Customers',
                    'ROAS': 'Return on Ad Spend - Total Net Sales divided by Total Ad Spend',
                    'MER': 'Marketing Efficiency Ratio - Revenue divided by Marketing Spend',
                    'COGS': 'Cost of Goods Sold - Direct costs attributable to production',
                    'Contribution Margin': 'Revenue minus variable costs',
                    'Gross Profit': 'Revenue minus Cost of Goods Sold',
                    'Net Income': 'Total revenue minus total expenses',
                    'Burn Rate': 'Rate at which company spends cash reserves',
                    'Runway': 'Time until company runs out of cash at current burn rate'
                },
                workflows: [
                    'Revenue Analysis → Sales Metrics → Profitability Assessment',
                    'Customer Analysis → Acquisition Cost → Lifetime Value → Unit Economics',
                    'Marketing Performance → Channel Analysis → ROAS → Campaign Optimization',
                    'Operational Efficiency → Cost Analysis → Margin Improvement',
                    'Cash Flow Management → Burn Rate → Runway Analysis'
                ],
                industryContext: [
                    'Ecommerce businesses focus on customer acquisition and retention',
                    'Unit economics (LTV/CAC ratio) critical for sustainable growth',
                    'Contribution margin indicates product-level profitability',
                    'Marketing efficiency varies significantly by channel',
                    'Cash flow management essential for scaling operations'
                ]
            }
        };
    }

    /**
     * Initialize the complete metric registry
     */
    private initializeRegistry(): void {
        if (this.initialized) return;

        this.logger.log('Initializing ecommerce metric registry...');

        // Initialize all metric categories
        this.initializeSalesMetrics();
        this.initializeCOGSMetrics();
        this.initializeProfitabilityMetrics();
        this.initializeUnitEconomicsMetrics();
        this.initializeMarketingMetrics();
        this.initializeQuantityMetrics();
        this.initializeCashFlowMetrics();
        this.initializeSubscriberMetrics();

        // Initialize relationships
        this.initializeMetricRelationships();

        this.initialized = true;
        this.logger.log(`Metric registry initialized with ${this.metrics.size} metrics and ${this.relationships.length} relationships`);
    }

    /**
     * Initialize Sales category metrics
     */
    private initializeSalesMetrics(): void {
        // Gross Sales
        this.metrics.set('gross_sales', {
            id: 'gross_sales',
            name: 'Gross Sales',
            aliases: ['total sales', 'gross revenue', 'total revenue'],
            description: 'Total sales revenue before any deductions',
            category: 'sales',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Indicates total revenue generated before accounting for discounts, refunds, and shipping',
                useCase: ['revenue tracking', 'sales performance', 'period comparison'],
                relatedMetrics: ['net_sales', 'discounts', 'refunds'],
                keyInsights: ['Sales volume trends', 'Seasonal patterns', 'Growth rates'],
                analysisPatterns: ['time series analysis', 'period-over-period comparison', 'channel breakdown']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'product', 'region']
        });

        // Net Shipping
        this.metrics.set('net_shipping', {
            id: 'net_shipping',
            name: 'Net Shipping',
            aliases: ['shipping revenue', 'shipping income'],
            description: 'Net revenue from shipping charges',
            category: 'sales',
            subcategory: 'shipping',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Revenue generated from shipping fees charged to customers',
                useCase: ['shipping analysis', 'logistics optimization', 'pricing strategy'],
                relatedMetrics: ['gross_sales', 'shipping_costs'],
                keyInsights: ['Shipping profitability', 'Free shipping impact'],
                analysisPatterns: ['shipping vs product revenue', 'regional shipping analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['region', 'shipping_method']
        });

        // Discounts
        this.metrics.set('discounts', {
            id: 'discounts',
            name: 'Discounts',
            aliases: ['discount amount', 'promotional discounts', 'coupon discounts'],
            description: 'Total amount of discounts given to customers',
            category: 'sales',
            subcategory: 'deductions',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Amount of revenue given up through promotional pricing and discounts',
                useCase: ['promotion analysis', 'pricing strategy', 'margin impact assessment'],
                relatedMetrics: ['gross_sales', 'discount_rate', 'net_sales'],
                keyInsights: ['Discount effectiveness', 'Impact on margins', 'Customer acquisition cost'],
                analysisPatterns: ['discount rate calculation', 'promotion ROI analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['promotion_type', 'channel']
        });

        // Refunds
        this.metrics.set('refunds', {
            id: 'refunds',
            name: 'Refunds',
            aliases: ['refund amount', 'returns', 'chargebacks'],
            description: 'Total amount refunded to customers',
            category: 'sales',
            subcategory: 'deductions',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Revenue lost due to product returns and refunds',
                useCase: ['quality analysis', 'customer satisfaction', 'product performance'],
                relatedMetrics: ['gross_sales', 'refund_rate', 'net_sales'],
                keyInsights: ['Product quality issues', 'Customer satisfaction levels', 'Fraud patterns'],
                analysisPatterns: ['refund rate by product', 'seasonal refund patterns']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'reason', 'channel']
        });

        // Total Net Sales
        this.metrics.set('total_net_sales', {
            id: 'total_net_sales',
            name: 'Total Net Sales',
            aliases: ['net sales', 'net revenue', 'adjusted sales'],
            description: 'Total Gross Sales minus Discounts and Refunds plus Shipping',
            category: 'sales',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'gross_sales - discounts - refunds + net_shipping',
                description: 'Total Gross Sales - Discounts - Refunds + Shipping',
                steps: ['Start with Gross Sales', 'Subtract Discounts', 'Subtract Refunds', 'Add Net Shipping']
            },
            dependencies: ['gross_sales', 'discounts', 'refunds', 'net_shipping'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Actual revenue after accounting for discounts, refunds, and shipping income',
                useCase: ['true revenue analysis', 'profitability calculation', 'financial reporting'],
                relatedMetrics: ['gross_profit', 'contribution_margin'],
                keyInsights: ['True business performance', 'Impact of promotions and returns'],
                analysisPatterns: ['net vs gross comparison', 'margin analysis foundation']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'product', 'region']
        });

        // New Customer Net Sales
        this.metrics.set('new_customer_net_sales', {
            id: 'new_customer_net_sales',
            name: 'New Customer Net Sales',
            aliases: ['first time customer sales', 'new customer revenue'],
            description: 'Net sales generated from customers making their first purchase',
            category: 'sales',
            subcategory: 'customer_segments',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Revenue generated from customer acquisition efforts',
                useCase: ['acquisition analysis', 'marketing ROI', 'customer segmentation'],
                relatedMetrics: ['cac', 'new_customer_aov', 'new_customer_orders'],
                keyInsights: ['Acquisition performance', 'New customer value', 'Marketing effectiveness'],
                analysisPatterns: ['acquisition funnel analysis', 'channel attribution']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'campaign']
        });

        // Returning Customer Net Sales
        this.metrics.set('returning_customer_net_sales', {
            id: 'returning_customer_net_sales',
            name: 'Returning Customer Net Sales',
            aliases: ['repeat customer sales', 'retention revenue'],
            description: 'Net sales generated from customers who have purchased before',
            category: 'sales',
            subcategory: 'customer_segments',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Revenue generated from customer retention and loyalty',
                useCase: ['retention analysis', 'loyalty programs', 'customer lifetime value'],
                relatedMetrics: ['ltv', 'returning_customer_aov', 'customer_retention_rate'],
                keyInsights: ['Customer loyalty', 'Retention effectiveness', 'Repeat purchase behavior'],
                analysisPatterns: ['cohort analysis', 'retention curve analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['customer_segment', 'purchase_frequency']
        });
    }

    /**
     * Initialize COGS (Cost of Goods Sold) metrics
     */
    private initializeCOGSMetrics(): void {
        // Product COGS
        this.metrics.set('product_cogs', {
            id: 'product_cogs',
            name: 'Product COGS',
            aliases: ['cost of goods sold', 'product cost', 'cogs'],
            description: 'Direct costs attributable to production of goods sold',
            category: 'cogs',
            subcategory: 'product_costs',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'inventory_system'],
            businessContext: {
                interpretation: 'Direct costs of producing or purchasing products sold',
                useCase: ['margin analysis', 'pricing strategy', 'supplier evaluation'],
                relatedMetrics: ['gross_profit', 'gross_margin', 'total_cogs'],
                keyInsights: ['Product profitability', 'Cost efficiency', 'Supplier performance'],
                analysisPatterns: ['cost per unit analysis', 'supplier comparison', 'product margin analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'supplier', 'category']
        });

        // Inbound Freight
        this.metrics.set('inbound_freight', {
            id: 'inbound_freight',
            name: 'Inbound Freight',
            aliases: ['inbound shipping', 'freight in', 'shipping to warehouse'],
            description: 'Costs for shipping products from suppliers to warehouse',
            category: 'cogs',
            subcategory: 'freight',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'logistics_system'],
            businessContext: {
                interpretation: 'Transportation costs for receiving inventory',
                useCase: ['logistics optimization', 'supplier negotiations', 'landed cost calculation'],
                relatedMetrics: ['product_cogs', 'outbound_freight', 'total_freight'],
                keyInsights: ['Logistics efficiency', 'Supplier proximity impact', 'Freight cost trends'],
                analysisPatterns: ['freight cost per unit', 'supplier freight comparison']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['supplier', 'shipping_method', 'route']
        });

        // Outbound Freight
        this.metrics.set('outbound_freight', {
            id: 'outbound_freight',
            name: 'Outbound Freight',
            aliases: ['outbound shipping', 'freight out', 'delivery costs'],
            description: 'Costs for shipping products to customers',
            category: 'cogs',
            subcategory: 'freight',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'fulfillment_system'],
            businessContext: {
                interpretation: 'Transportation costs for delivering to customers',
                useCase: ['delivery optimization', 'shipping strategy', 'customer satisfaction'],
                relatedMetrics: ['net_shipping', 'shipping_margin', '3pl_shipping'],
                keyInsights: ['Delivery efficiency', 'Regional cost variations', 'Shipping profitability'],
                analysisPatterns: ['shipping cost per order', 'regional freight analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['region', 'carrier', 'service_level']
        });

        // 3PL Shipping
        this.metrics.set('3pl_shipping', {
            id: '3pl_shipping',
            name: '3PL Shipping',
            aliases: ['third party logistics shipping', '3pl delivery costs'],
            description: 'Shipping costs incurred by third-party logistics providers',
            category: 'cogs',
            subcategory: '3pl',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', '3pl_systems'],
            businessContext: {
                interpretation: 'Outsourced shipping costs through logistics partners',
                useCase: ['3PL performance', 'cost comparison', 'logistics strategy'],
                relatedMetrics: ['3pl_fulfillment', 'outbound_freight', 'logistics_costs'],
                keyInsights: ['3PL efficiency', 'Cost vs internal shipping', 'Service quality'],
                analysisPatterns: ['3PL vs internal cost analysis', 'provider performance comparison']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['3pl_provider', 'service_type']
        });

        // 3PL Fulfillment
        this.metrics.set('3pl_fulfillment', {
            id: '3pl_fulfillment',
            name: '3PL Fulfillment',
            aliases: ['third party logistics fulfillment', '3pl warehouse costs'],
            description: 'Fulfillment and warehousing costs from third-party logistics providers',
            category: 'cogs',
            subcategory: '3pl',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', '3pl_systems'],
            businessContext: {
                interpretation: 'Outsourced warehousing and order processing costs',
                useCase: ['fulfillment optimization', 'warehouse efficiency', 'cost management'],
                relatedMetrics: ['3pl_shipping', 'pick_pack_costs', 'logistics_costs'],
                keyInsights: ['Fulfillment efficiency', 'Scaling costs', 'Provider performance'],
                analysisPatterns: ['fulfillment cost per order', '3PL performance metrics']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['3pl_provider', 'service_type']
        });

        // Pick & Pack (Logistics)
        this.metrics.set('pick_pack_costs', {
            id: 'pick_pack_costs',
            name: 'Pick & Pack Costs',
            aliases: ['logistics costs', 'fulfillment labor', 'warehouse operations'],
            description: 'Pick & pack, shipping costs for orders not fulfilled by FBT or FBA',
            category: 'cogs',
            subcategory: 'logistics',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Internal fulfillment operations costs',
                useCase: ['operations efficiency', 'labor cost management', 'fulfillment strategy'],
                relatedMetrics: ['logistics_total', '3pl_fulfillment', 'fulfillment_per_order'],
                keyInsights: ['Operational efficiency', 'Labor productivity', 'Scale economics'],
                analysisPatterns: ['cost per order analysis', 'efficiency trends']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['warehouse', 'shift', 'order_type']
        });

        // Payment Processor Fees
        this.metrics.set('payment_processor_fees', {
            id: 'payment_processor_fees',
            name: 'Payment Processor Fees',
            aliases: ['payment fees', 'transaction fees', 'paypal fees', 'affirm fees'],
            description: 'Fees paid to payment processors like PayPal, Affirm, etc.',
            category: 'cogs',
            subcategory: 'fees',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'payment_systems'],
            businessContext: {
                interpretation: 'Transaction processing costs for customer payments',
                useCase: ['payment strategy', 'cost optimization', 'processor comparison'],
                relatedMetrics: ['merchant_fees', 'total_fees', 'payment_conversion'],
                keyInsights: ['Payment efficiency', 'Processor performance', 'Cost per transaction'],
                analysisPatterns: ['processor cost comparison', 'payment method analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['processor', 'payment_method', 'channel']
        });

        // Merchant Fees
        this.metrics.set('merchant_fees', {
            id: 'merchant_fees',
            name: 'Merchant Fees',
            aliases: ['platform fees', 'shopify fees', 'amazon fees', 'marketplace fees'],
            description: 'Fees paid to merchant platforms like Shopify, Amazon (outside FBA), TTS, etc.',
            category: 'cogs',
            subcategory: 'fees',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'platform_systems'],
            businessContext: {
                interpretation: 'Platform and marketplace transaction fees',
                useCase: ['platform strategy', 'channel profitability', 'fee optimization'],
                relatedMetrics: ['payment_processor_fees', 'total_fees', 'channel_profitability'],
                keyInsights: ['Platform cost efficiency', 'Channel economics', 'Fee impact on margins'],
                analysisPatterns: ['platform fee comparison', 'channel profitability analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['platform', 'channel', 'fee_type']
        });

        // Total COGS
        this.metrics.set('total_cogs', {
            id: 'total_cogs',
            name: 'Total COGS',
            aliases: ['total cost of goods sold', 'all costs'],
            description: 'Product COGS + 3PL + Freight + Fees',
            category: 'cogs',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'product_cogs + 3pl_shipping + 3pl_fulfillment + inbound_freight + outbound_freight + payment_processor_fees + merchant_fees',
                description: 'Sum of all direct costs: Product COGS + 3PL + Freight + Fees',
                steps: [
                    'Start with Product COGS',
                    'Add 3PL shipping costs',
                    'Add 3PL fulfillment costs', 
                    'Add inbound and outbound freight',
                    'Add payment processor fees',
                    'Add merchant fees'
                ]
            },
            dependencies: ['product_cogs', '3pl_shipping', '3pl_fulfillment', 'inbound_freight', 'outbound_freight', 'payment_processor_fees', 'merchant_fees'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Complete cost structure for goods sold',
                useCase: ['profitability analysis', 'margin calculation', 'cost management'],
                relatedMetrics: ['gross_profit', 'contribution_margin', 'delivered_gross_profit'],
                keyInsights: ['True product costs', 'Cost structure optimization', 'Margin opportunities'],
                analysisPatterns: ['cost breakdown analysis', 'margin waterfall', 'cost trend analysis']
            },
            recommendedChartTypes: ['waterfall', 'stacked-bar', 'line'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['cost_category', 'product', 'channel']
        });
    }

    private initializeProfitabilityMetrics(): void {
        // Product Gross Profit
        this.metrics.set('product_gross_profit', {
            id: 'product_gross_profit',
            name: 'Product Gross Profit',
            aliases: ['gross profit', 'product margin'],
            description: 'Total Net Sales - Product COGS - Inbound Freight',
            category: 'profitability',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_net_sales - product_cogs - inbound_freight',
                description: 'Total Net Sales minus Product COGS and Inbound Freight',
                steps: [
                    'Start with Total Net Sales',
                    'Subtract Product COGS',
                    'Subtract Inbound Freight'
                ]
            },
            dependencies: ['total_net_sales', 'product_cogs', 'inbound_freight'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Profit after direct product costs and freight',
                useCase: ['product profitability', 'pricing decisions', 'supplier negotiations'],
                relatedMetrics: ['gross_margin', 'contribution_margin', 'delivered_gross_profit'],
                keyInsights: ['Product line profitability', 'Cost impact on margins', 'Pricing power'],
                analysisPatterns: ['margin analysis by product', 'gross profit trends', 'cost structure optimization']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'channel', 'region']
        });

        // Delivered Gross Profit
        this.metrics.set('delivered_gross_profit', {
            id: 'delivered_gross_profit',
            name: 'Delivered Gross Profit',
            aliases: ['delivered margin', 'post-fulfillment profit'],
            description: 'Total Net Sales - Product COGS - Freight - 3PL - Merchant Fees',
            category: 'profitability',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_net_sales - product_cogs - inbound_freight - outbound_freight - 3pl_shipping - 3pl_fulfillment - merchant_fees',
                description: 'Total Net Sales minus Product COGS, Freight, 3PL, and Merchant Fees',
                steps: [
                    'Start with Total Net Sales',
                    'Subtract Product COGS',
                    'Subtract Freight costs (inbound + outbound)',
                    'Subtract 3PL costs (shipping + fulfillment)',
                    'Subtract Merchant Fees'
                ]
            },
            dependencies: ['total_net_sales', 'product_cogs', 'inbound_freight', 'outbound_freight', '3pl_shipping', '3pl_fulfillment', 'merchant_fees'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Profit after all delivery and platform costs',
                useCase: ['delivery profitability', 'channel analysis', 'fulfillment optimization'],
                relatedMetrics: ['contribution_margin', 'net_income', 'channel_profitability'],
                keyInsights: ['True delivery profitability', 'Channel efficiency', 'Fulfillment cost impact'],
                analysisPatterns: ['delivery cost analysis', 'channel profitability comparison', 'fulfillment efficiency']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'fulfillment_method', 'region']
        });

        // Contribution Margin
        this.metrics.set('contribution_margin', {
            id: 'contribution_margin',
            name: 'Contribution Margin',
            aliases: ['cm', 'variable profit'],
            description: 'Total Net Sales - Total COGS - Total Marketing Expense',
            category: 'profitability',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_net_sales - total_cogs - total_marketing',
                description: 'Total Net Sales minus Total COGS and Total Marketing Expense',
                steps: [
                    'Start with Total Net Sales',
                    'Subtract Total COGS',
                    'Subtract Total Marketing Expense'
                ]
            },
            dependencies: ['total_net_sales', 'total_cogs', 'total_marketing'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Profit after variable costs, before fixed expenses',
                useCase: ['unit economics', 'scaling decisions', 'marketing ROI'],
                relatedMetrics: ['contribution_margin_percent', 'cm_per_order', 'net_income'],
                keyInsights: ['Scalability potential', 'Variable cost efficiency', 'Marketing effectiveness'],
                analysisPatterns: ['contribution margin trends', 'unit economics analysis', 'breakeven analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'channel', 'customer_segment']
        });

        // Net Income
        this.metrics.set('net_income', {
            id: 'net_income',
            name: 'Net Income',
            aliases: ['net profit', 'bottom line', 'earnings'],
            description: 'Contribution Margin - Operating Expenses',
            category: 'profitability',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'contribution_margin - op_ex',
                description: 'Contribution Margin minus Operating Expenses',
                steps: [
                    'Start with Contribution Margin',
                    'Subtract Operating Expenses'
                ]
            },
            dependencies: ['contribution_margin', 'op_ex'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Final profit after all expenses',
                useCase: ['overall profitability', 'business sustainability', 'investor reporting'],
                relatedMetrics: ['net_margin', 'ebitda', 'cash_flow'],
                keyInsights: ['Business profitability', 'Operational efficiency', 'Growth sustainability'],
                analysisPatterns: ['profitability trends', 'expense management', 'profit margin analysis']
            },
            recommendedChartTypes: ['line', 'bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['period', 'business_unit']
        });

        // Discount Rate
        this.metrics.set('discount_rate', {
            id: 'discount_rate',
            name: 'Discount Rate',
            aliases: ['discount percentage', 'promotion rate'],
            description: 'Discounts / Gross Sales',
            category: 'profitability',
            valueType: 'percentage',
            unit: '%',
            calculation: {
                formula: '(discounts / gross_sales) * 100',
                description: 'Discounts divided by Gross Sales, expressed as percentage',
                steps: [
                    'Divide total Discounts by Gross Sales',
                    'Multiply by 100 for percentage'
                ]
            },
            dependencies: ['discounts', 'gross_sales'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Percentage of revenue given as discounts',
                useCase: ['promotion analysis', 'pricing strategy', 'margin impact'],
                relatedMetrics: ['refund_rate', 'net_margin', 'promotion_roi'],
                keyInsights: ['Promotion intensity', 'Pricing discipline', 'Customer acquisition cost'],
                analysisPatterns: ['discount effectiveness', 'promotional impact on margins', 'seasonal discount patterns']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['promotion_type', 'channel', 'product']
        });

        // Refund Rate
        this.metrics.set('refund_rate', {
            id: 'refund_rate',
            name: 'Refund Rate',
            aliases: ['return rate', 'refund percentage'],
            description: 'Refunds / Gross Sales',
            category: 'profitability',
            valueType: 'percentage',
            unit: '%',
            calculation: {
                formula: '(refunds / gross_sales) * 100',
                description: 'Refunds divided by Gross Sales, expressed as percentage',
                steps: [
                    'Divide total Refunds by Gross Sales',
                    'Multiply by 100 for percentage'
                ]
            },
            dependencies: ['refunds', 'gross_sales'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Percentage of revenue lost to refunds',
                useCase: ['quality analysis', 'customer satisfaction', 'operational efficiency'],
                relatedMetrics: ['discount_rate', 'customer_satisfaction', 'product_quality'],
                keyInsights: ['Product quality issues', 'Customer satisfaction', 'Return patterns'],
                analysisPatterns: ['refund rate by product', 'seasonal return patterns', 'quality impact analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'reason', 'channel']
        });

        // CM Margin (Contribution Margin Percentage)
        this.metrics.set('cm_margin', {
            id: 'cm_margin',
            name: 'CM Margin',
            aliases: ['contribution margin percentage', 'cm %', 'variable margin'],
            description: 'Contribution Margin / Total Net Sales',
            category: 'profitability',
            valueType: 'percentage',
            unit: '%',
            calculation: {
                formula: '(contribution_margin / total_net_sales) * 100',
                description: 'Contribution Margin divided by Total Net Sales, expressed as percentage',
                steps: [
                    'Divide Contribution Margin by Total Net Sales',
                    'Multiply by 100 for percentage'
                ]
            },
            dependencies: ['contribution_margin', 'total_net_sales'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Percentage of revenue retained after variable costs',
                useCase: ['unit economics', 'pricing strategy', 'scaling analysis'],
                relatedMetrics: ['gross_margin', 'net_margin', 'contribution_per_order'],
                keyInsights: ['Variable cost efficiency', 'Scalability potential', 'Pricing power'],
                analysisPatterns: ['margin trend analysis', 'product profitability comparison', 'unit economics assessment']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['product', 'channel', 'customer_segment']
        });

        // Net Margin
        this.metrics.set('net_margin', {
            id: 'net_margin',
            name: 'Net Margin',
            aliases: ['net profit margin', 'net margin percentage'],
            description: 'Net Income / Total Net Sales',
            category: 'profitability',
            valueType: 'percentage',
            unit: '%',
            calculation: {
                formula: '(net_income / total_net_sales) * 100',
                description: 'Net Income divided by Total Net Sales, expressed as percentage',
                steps: [
                    'Divide Net Income by Total Net Sales',
                    'Multiply by 100 for percentage'
                ]
            },
            dependencies: ['net_income', 'total_net_sales'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Final profit percentage after all costs',
                useCase: ['overall profitability', 'business efficiency', 'investor metrics'],
                relatedMetrics: ['gross_margin', 'cm_margin', 'operating_margin'],
                keyInsights: ['Overall business efficiency', 'Profit generation capability', 'Cost control effectiveness'],
                analysisPatterns: ['profitability trends', 'margin comparison', 'efficiency analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['period', 'business_unit']
        });
    }

    private initializeUnitEconomicsMetrics(): void {
        // AOV (Average Order Value)
        this.metrics.set('aov', {
            id: 'aov',
            name: 'AOV',
            aliases: ['average order value', 'avg order value'],
            description: 'Total Net Sales / Order Quantity',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_net_sales / total_orders',
                description: 'Total Net Sales divided by Order Quantity',
                steps: [
                    'Divide Total Net Sales by Total Orders'
                ]
            },
            dependencies: ['total_net_sales', 'total_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Average revenue per order',
                useCase: ['pricing strategy', 'customer behavior analysis', 'marketing optimization'],
                relatedMetrics: ['new_customer_aov', 'returning_customer_aov', 'ltv'],
                keyInsights: ['Customer purchasing power', 'Basket size optimization', 'Upselling effectiveness'],
                analysisPatterns: ['AOV trends', 'channel AOV comparison', 'customer segment analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'customer_segment', 'product_category']
        });

        // First Order AOV
        this.metrics.set('first_order_aov', {
            id: 'first_order_aov',
            name: 'First Order AOV',
            aliases: ['initial order value', 'first purchase aov'],
            description: 'Average order value for first-time customers',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'new_customer_net_sales / new_customer_orders',
                description: 'New Customer Net Sales divided by New Customer Orders',
                steps: [
                    'Divide New Customer Net Sales by New Customer Orders'
                ]
            },
            dependencies: ['new_customer_net_sales', 'new_customer_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Average first purchase value',
                useCase: ['acquisition analysis', 'onboarding optimization', 'marketing campaign assessment'],
                relatedMetrics: ['aov', 'cac', 'ltv_cac_ratio'],
                keyInsights: ['First impression value', 'Acquisition quality', 'Onboarding effectiveness'],
                analysisPatterns: ['first vs repeat order comparison', 'acquisition channel analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'campaign']
        });

        // New Customer AOV
        this.metrics.set('new_customer_aov', {
            id: 'new_customer_aov',
            name: 'New Customer AOV',
            aliases: ['new customer average order value'],
            description: 'New Customer Net Sales / New Customer Orders',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'new_customer_net_sales / new_customer_orders',
                description: 'New Customer Net Sales divided by New Customer Orders',
                steps: [
                    'Divide New Customer Net Sales by New Customer Orders'
                ]
            },
            dependencies: ['new_customer_net_sales', 'new_customer_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Average order value from newly acquired customers',
                useCase: ['customer acquisition analysis', 'marketing effectiveness', 'new customer behavior'],
                relatedMetrics: ['returning_customer_aov', 'cac', 'first_order_aov'],
                keyInsights: ['New customer value', 'Acquisition quality', 'Initial purchase behavior'],
                analysisPatterns: ['new vs returning AOV comparison', 'acquisition channel effectiveness']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'campaign', 'customer_segment']
        });

        // Returning Customer AOV
        this.metrics.set('returning_customer_aov', {
            id: 'returning_customer_aov',
            name: 'Returning Customer AOV',
            aliases: ['repeat customer aov', 'loyal customer aov'],
            description: 'Returning Customer Net Sales / Returning Customer Orders',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'returning_customer_net_sales / returning_customer_orders',
                description: 'Returning Customer Net Sales divided by Returning Customer Orders',
                steps: [
                    'Divide Returning Customer Net Sales by Returning Customer Orders'
                ]
            },
            dependencies: ['returning_customer_net_sales', 'returning_customer_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Average order value from repeat customers',
                useCase: ['customer retention analysis', 'loyalty program effectiveness', 'repeat purchase behavior'],
                relatedMetrics: ['new_customer_aov', 'ltv', 'customer_retention_rate'],
                keyInsights: ['Customer loyalty value', 'Repeat purchase behavior', 'Retention program impact'],
                analysisPatterns: ['loyalty progression analysis', 'repeat purchase patterns']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['customer_segment', 'loyalty_tier']
        });

        // CAC (Customer Acquisition Cost)
        this.metrics.set('cac', {
            id: 'cac',
            name: 'CAC',
            aliases: ['customer acquisition cost', 'acquisition cost'],
            description: 'Total Ad Spend / New Customer Quantity',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_marketing / new_customers',
                description: 'Total Ad Spend divided by New Customer Quantity',
                steps: [
                    'Divide Total Marketing Spend by Number of New Customers'
                ]
            },
            dependencies: ['total_marketing', 'new_customers'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Cost to acquire each new customer',
                useCase: ['marketing efficiency', 'channel optimization', 'budget allocation'],
                relatedMetrics: ['ltv', 'ltv_cac_ratio', 'amer'],
                keyInsights: ['Marketing efficiency', 'Channel profitability', 'Scaling viability'],
                analysisPatterns: ['CAC by channel', 'CAC trends over time', 'payback period analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['marketing_channel', 'campaign', 'customer_segment']
        });

        // aMER (Acquisition Marketing Efficiency Ratio)
        this.metrics.set('amer', {
            id: 'amer',
            name: 'aMER',
            aliases: ['acquisition marketing efficiency ratio', 'amer ratio'],
            description: 'New Customer Net Sales / Total Ad Spend',
            category: 'unit_economics',
            valueType: 'ratio',
            calculation: {
                formula: 'new_customer_net_sales / total_marketing',
                description: 'New Customer Net Sales divided by Total Ad Spend',
                steps: [
                    'Divide New Customer Net Sales by Total Marketing Spend'
                ]
            },
            dependencies: ['new_customer_net_sales', 'total_marketing'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Revenue generated per dollar spent on customer acquisition',
                useCase: ['marketing ROI', 'acquisition efficiency', 'campaign optimization'],
                relatedMetrics: ['net_mer', 'cac', 'roas'],
                keyInsights: ['Acquisition campaign effectiveness', 'Marketing spend efficiency', 'Channel performance'],
                analysisPatterns: ['aMER by channel', 'campaign efficiency comparison', 'acquisition ROI trends']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['marketing_channel', 'campaign']
        });

        // Net MER (ROAS) - Return on Ad Spend
        this.metrics.set('net_mer', {
            id: 'net_mer',
            name: 'Net MER (ROAS)',
            aliases: ['roas', 'return on ad spend', 'marketing efficiency ratio'],
            description: 'Total Net Sales / Total Ad Spend',
            category: 'unit_economics',
            valueType: 'ratio',
            calculation: {
                formula: 'total_net_sales / total_marketing',
                description: 'Total Net Sales divided by Total Ad Spend',
                steps: [
                    'Divide Total Net Sales by Total Marketing Spend'
                ]
            },
            dependencies: ['total_net_sales', 'total_marketing'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Total revenue generated per dollar of marketing spend',
                useCase: ['marketing ROI', 'budget optimization', 'campaign performance'],
                relatedMetrics: ['amer', 'contribution_margin', 'cac'],
                keyInsights: ['Overall marketing effectiveness', 'Campaign profitability', 'Spend optimization'],
                analysisPatterns: ['ROAS by channel', 'campaign performance comparison', 'marketing ROI trends']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['marketing_channel', 'campaign', 'audience']
        });

        // LTV (Lifetime Value)
        this.metrics.set('ltv', {
            id: 'ltv',
            name: 'LTV',
            aliases: ['lifetime value', 'customer lifetime value', 'clv'],
            description: 'Total Net Sales / Unique Customers',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'total_net_sales / unique_customers',
                description: 'Total Net Sales divided by Unique Customers',
                steps: [
                    'Divide Total Net Sales by Total Unique Customers'
                ]
            },
            dependencies: ['total_net_sales', 'unique_customers'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Average revenue generated per customer over their lifetime',
                useCase: ['customer value assessment', 'retention strategy', 'marketing budget allocation'],
                relatedMetrics: ['cac', 'ltv_cac_ratio', 'customer_retention_rate'],
                keyInsights: ['Customer value potential', 'Retention effectiveness', 'Business sustainability'],
                analysisPatterns: ['LTV by cohort', 'LTV trends over time', 'customer segment value']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['customer_segment', 'acquisition_channel', 'cohort']
        });

        // CM per Order (Contribution Margin per Order)
        this.metrics.set('cm_per_order', {
            id: 'cm_per_order',
            name: 'CM per Order',
            aliases: ['contribution margin per order', 'unit contribution margin'],
            description: 'Contribution Margin / Order Quantity',
            category: 'unit_economics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'contribution_margin / total_orders',
                description: 'Contribution Margin divided by Order Quantity',
                steps: [
                    'Divide Contribution Margin by Total Orders'
                ]
            },
            dependencies: ['contribution_margin', 'total_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Variable profit generated per order',
                useCase: ['unit economics', 'order profitability', 'pricing strategy'],
                relatedMetrics: ['aov', 'contribution_margin', 'cm_margin'],
                keyInsights: ['Order-level profitability', 'Variable cost efficiency', 'Scaling economics'],
                analysisPatterns: ['CM per order trends', 'profitability by order size', 'cost structure optimization']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'product_category', 'order_size']
        });

        // LTV/CAC Ratio
        this.metrics.set('ltv_cac_ratio', {
            id: 'ltv_cac_ratio',
            name: 'LTV/CAC Ratio',
            aliases: ['ltv to cac ratio', 'customer value ratio'],
            description: 'LTV / CAC',
            category: 'unit_economics',
            valueType: 'ratio',
            calculation: {
                formula: 'ltv / cac',
                description: 'Lifetime Value divided by Customer Acquisition Cost',
                steps: [
                    'Divide LTV by CAC'
                ]
            },
            dependencies: ['ltv', 'cac'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Return on customer acquisition investment',
                useCase: ['business sustainability', 'marketing efficiency', 'growth strategy'],
                relatedMetrics: ['ltv', 'cac', 'payback_period'],
                keyInsights: ['Customer acquisition profitability', 'Business model viability', 'Growth sustainability'],
                analysisPatterns: ['LTV:CAC ratio trends', 'channel efficiency comparison', 'business model health']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'customer_segment', 'cohort']
        });
    }

    private initializeMarketingMetrics(): void {
        // FB (Facebook Ads)
        this.metrics.set('fb_ads', {
            id: 'fb_ads',
            name: 'FB Ads',
            aliases: ['facebook ads', 'facebook spend', 'meta ads'],
            description: 'Advertising spend on Facebook and Instagram platforms',
            category: 'marketing',
            subcategory: 'paid_social',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'facebook_ads'],
            businessContext: {
                interpretation: 'Investment in Facebook/Instagram advertising',
                useCase: ['social media marketing', 'brand awareness', 'customer acquisition'],
                relatedMetrics: ['total_marketing', 'roas', 'cac'],
                keyInsights: ['Social media ROI', 'Audience engagement', 'Brand awareness impact'],
                analysisPatterns: ['FB ads performance', 'audience analysis', 'creative testing']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['campaign', 'audience', 'creative']
        });

        // Google Ads
        this.metrics.set('google_ads', {
            id: 'google_ads',
            name: 'Google Ads',
            aliases: ['google adwords', 'google spend', 'search ads'],
            description: 'Advertising spend on Google Ads platform',
            category: 'marketing',
            subcategory: 'paid_search',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'google_ads'],
            businessContext: {
                interpretation: 'Investment in Google search and display advertising',
                useCase: ['search marketing', 'intent-based targeting', 'performance marketing'],
                relatedMetrics: ['total_marketing', 'roas', 'cac'],
                keyInsights: ['Search performance', 'Keyword effectiveness', 'Intent capture'],
                analysisPatterns: ['keyword analysis', 'search trends', 'bid optimization']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['campaign', 'keyword_group', 'ad_type']
        });

        // Amazon Ads
        this.metrics.set('amazon_ads', {
            id: 'amazon_ads',
            name: 'Amazon Ads',
            aliases: ['amazon advertising', 'amazon ppc', 'amazon spend'],
            description: 'Advertising spend on Amazon advertising platform',
            category: 'marketing',
            subcategory: 'marketplace_ads',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'amazon_ads'],
            businessContext: {
                interpretation: 'Investment in Amazon marketplace advertising',
                useCase: ['marketplace visibility', 'product discovery', 'competitive positioning'],
                relatedMetrics: ['total_marketing', 'amazon_sales', 'marketplace_roas'],
                keyInsights: ['Marketplace performance', 'Product visibility', 'Competitive positioning'],
                analysisPatterns: ['product advertising performance', 'marketplace competition']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['campaign_type', 'product', 'marketplace']
        });

        // Product Giveaway Marketing
        this.metrics.set('product_giveaway_marketing', {
            id: 'product_giveaway_marketing',
            name: 'Product Giveaway Marketing',
            aliases: ['giveaway costs', 'promotional products', 'sample costs'],
            description: 'Product COGS + shipping + fulfillment of product giveaways',
            category: 'marketing',
            subcategory: 'promotional',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'giveaway_product_cogs + giveaway_shipping + giveaway_fulfillment',
                description: 'Sum of product costs, shipping, and fulfillment for giveaway campaigns',
                steps: [
                    'Calculate product COGS for giveaway items',
                    'Add shipping costs for giveaway delivery',
                    'Add fulfillment costs for giveaway processing'
                ]
            },
            dependencies: ['giveaway_product_cogs', 'giveaway_shipping', 'giveaway_fulfillment'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Cost of promotional product campaigns',
                useCase: ['promotional campaigns', 'brand awareness', 'customer acquisition'],
                relatedMetrics: ['total_marketing', 'brand_awareness', 'customer_acquisition'],
                keyInsights: ['Promotional campaign effectiveness', 'Brand awareness impact', 'Acquisition cost'],
                analysisPatterns: ['giveaway ROI analysis', 'promotional campaign effectiveness']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['campaign', 'product_type']
        });

        // Total Marketing
        this.metrics.set('total_marketing', {
            id: 'total_marketing',
            name: 'Total Marketing',
            aliases: ['total ad spend', 'marketing spend', 'advertising costs'],
            description: 'Sum of all configured ad connections + Custom Marketing',
            category: 'marketing',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'fb_ads + google_ads + amazon_ads + product_giveaway_marketing + custom_marketing',
                description: 'Sum of all advertising and marketing expenses',
                steps: [
                    'Add Facebook Ads spend',
                    'Add Google Ads spend',
                    'Add Amazon Ads spend',
                    'Add Product Giveaway costs',
                    'Add Custom Marketing spend'
                ]
            },
            dependencies: ['fb_ads', 'google_ads', 'amazon_ads', 'product_giveaway_marketing'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Complete marketing investment across all channels',
                useCase: ['marketing budget management', 'ROI analysis', 'channel optimization'],
                relatedMetrics: ['roas', 'cac', 'contribution_margin'],
                keyInsights: ['Total marketing efficiency', 'Budget allocation', 'Channel performance'],
                analysisPatterns: ['marketing mix analysis', 'budget optimization', 'channel attribution']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar', 'waterfall'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'campaign_type']
        });

        // CPC (Cost Per Click)
        this.metrics.set('cpc', {
            id: 'cpc',
            name: 'CPC',
            aliases: ['cost per click', 'avg cpc'],
            description: 'Average cost per click across advertising campaigns',
            category: 'marketing',
            subcategory: 'performance_metrics',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'ad_platforms'],
            businessContext: {
                interpretation: 'Efficiency of click acquisition',
                useCase: ['bid optimization', 'keyword strategy', 'campaign efficiency'],
                relatedMetrics: ['ctr', 'cpm', 'conversion_rate'],
                keyInsights: ['Click acquisition cost', 'Keyword competitiveness', 'Bid efficiency'],
                analysisPatterns: ['CPC trends', 'keyword analysis', 'competitive benchmarking']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'keyword', 'campaign']
        });

        // CPM (Cost Per Mille)
        this.metrics.set('cpm', {
            id: 'cpm',
            name: 'CPM',
            aliases: ['cost per mille', 'cost per thousand impressions'],
            description: 'Cost per thousand impressions',
            category: 'marketing',
            subcategory: 'performance_metrics',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'ad_platforms'],
            businessContext: {
                interpretation: 'Cost efficiency of reach and awareness',
                useCase: ['brand awareness', 'reach optimization', 'impression efficiency'],
                relatedMetrics: ['cpc', 'ctr', 'reach'],
                keyInsights: ['Awareness cost efficiency', 'Audience targeting', 'Brand visibility cost'],
                analysisPatterns: ['CPM trends', 'audience analysis', 'awareness campaigns']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'audience', 'campaign']
        });

        // CTR (Click Through Rate)
        this.metrics.set('ctr', {
            id: 'ctr',
            name: 'CTR',
            aliases: ['click through rate', 'click rate'],
            description: 'Clicks divided by impressions, expressed as percentage',
            category: 'marketing',
            subcategory: 'performance_metrics',
            valueType: 'percentage',
            unit: '%',
            dataSources: ['iris_api', 'ad_platforms'],
            businessContext: {
                interpretation: 'Ad relevance and engagement effectiveness',
                useCase: ['ad optimization', 'creative testing', 'audience relevance'],
                relatedMetrics: ['cpc', 'cpm', 'conversion_rate'],
                keyInsights: ['Ad relevance', 'Creative performance', 'Audience engagement'],
                analysisPatterns: ['CTR optimization', 'creative analysis', 'audience testing']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'creative', 'audience']
        });
    }

    private initializeQuantityMetrics(): void {
        // New Customers
        this.metrics.set('new_customers', {
            id: 'new_customers',
            name: 'New Customers',
            aliases: ['new customer count', 'acquired customers', 'first-time customers'],
            description: 'Unique individuals that placed their first order in the selected period',
            category: 'quantities',
            subcategory: 'customers',
            valueType: 'count',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Customer acquisition volume',
                useCase: ['acquisition tracking', 'growth measurement', 'marketing effectiveness'],
                relatedMetrics: ['cac', 'new_customer_aov', 'total_customers'],
                keyInsights: ['Acquisition velocity', 'Growth trajectory', 'Marketing performance'],
                analysisPatterns: ['acquisition trends', 'channel effectiveness', 'growth analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'campaign', 'region']
        });

        // Returning Customers
        this.metrics.set('returning_customers', {
            id: 'returning_customers',
            name: 'Returning Customers',
            aliases: ['repeat customers', 'loyal customers', 'existing customers'],
            description: 'Customers that have placed an order before the selected period',
            category: 'quantities',
            subcategory: 'customers',
            valueType: 'count',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Customer retention and loyalty volume',
                useCase: ['retention analysis', 'loyalty measurement', 'customer lifetime tracking'],
                relatedMetrics: ['ltv', 'returning_customer_aov', 'retention_rate'],
                keyInsights: ['Customer loyalty', 'Retention effectiveness', 'Business stability'],
                analysisPatterns: ['retention analysis', 'loyalty trends', 'customer lifecycle']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['customer_segment', 'loyalty_tier', 'tenure']
        });

        // Total Unique Customers
        this.metrics.set('unique_customers', {
            id: 'unique_customers',
            name: 'Total Unique Customers',
            aliases: ['total customers', 'customer count', 'unique customer count'],
            description: 'Total number of unique customers (new + returning)',
            category: 'quantities',
            subcategory: 'customers',
            valueType: 'count',
            calculation: {
                formula: 'new_customers + returning_customers',
                description: 'Sum of new and returning customers',
                steps: ['Add New Customers', 'Add Returning Customers']
            },
            dependencies: ['new_customers', 'returning_customers'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Total customer base activity',
                useCase: ['customer base analysis', 'business scale', 'market penetration'],
                relatedMetrics: ['ltv', 'customer_acquisition_rate', 'market_share'],
                keyInsights: ['Customer base size', 'Business scale', 'Market reach'],
                analysisPatterns: ['customer base growth', 'market penetration', 'scale analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['region', 'customer_type']
        });

        // First Order
        this.metrics.set('first_orders', {
            id: 'first_orders',
            name: 'First Orders',
            aliases: ['initial orders', 'first-time orders'],
            description: 'The first order placed by each customer',
            category: 'quantities',
            subcategory: 'orders',
            valueType: 'count',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Customer acquisition order volume',
                useCase: ['acquisition analysis', 'onboarding effectiveness', 'first experience tracking'],
                relatedMetrics: ['new_customers', 'first_order_aov', 'conversion_rate'],
                keyInsights: ['Acquisition conversion', 'First experience quality', 'Onboarding success'],
                analysisPatterns: ['first order analysis', 'conversion funnel', 'onboarding optimization']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'product_category']
        });

        // New Customer Orders
        this.metrics.set('new_customer_orders', {
            id: 'new_customer_orders',
            name: 'New Customer Orders',
            aliases: ['orders from new customers', 'acquisition orders'],
            description: 'ALL orders placed by new customers (customers acquired in the period)',
            category: 'quantities',
            subcategory: 'orders',
            valueType: 'count',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Order volume from newly acquired customers',
                useCase: ['acquisition performance', 'new customer behavior', 'onboarding success'],
                relatedMetrics: ['new_customer_aov', 'cac', 'new_customer_net_sales'],
                keyInsights: ['New customer engagement', 'Acquisition quality', 'Initial purchase patterns'],
                analysisPatterns: ['new customer behavior', 'acquisition funnel', 'early engagement']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['acquisition_channel', 'customer_segment']
        });

        // Returning Customer Orders
        this.metrics.set('returning_customer_orders', {
            id: 'returning_customer_orders',
            name: 'Returning Customer Orders',
            aliases: ['repeat orders', 'loyalty orders'],
            description: 'Orders placed by returning customers',
            category: 'quantities',
            subcategory: 'orders',
            valueType: 'count',
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Order volume from existing customer base',
                useCase: ['retention analysis', 'loyalty measurement', 'repeat purchase behavior'],
                relatedMetrics: ['returning_customer_aov', 'ltv', 'retention_rate'],
                keyInsights: ['Customer loyalty', 'Retention effectiveness', 'Repeat behavior'],
                analysisPatterns: ['retention analysis', 'loyalty trends', 'repeat purchase patterns']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['customer_segment', 'loyalty_tier']
        });

        // Total Orders
        this.metrics.set('total_orders', {
            id: 'total_orders',
            name: 'Total Orders',
            aliases: ['order count', 'order volume', 'total transactions'],
            description: 'All orders placed but not cancelled with sales value > 0',
            category: 'quantities',
            subcategory: 'orders',
            valueType: 'count',
            calculation: {
                formula: 'new_customer_orders + returning_customer_orders',
                description: 'Sum of new and returning customer orders',
                steps: ['Add New Customer Orders', 'Add Returning Customer Orders']
            },
            dependencies: ['new_customer_orders', 'returning_customer_orders'],
            dataSources: ['iris_api'],
            businessContext: {
                interpretation: 'Total business transaction volume',
                useCase: ['business scale', 'operational planning', 'growth measurement'],
                relatedMetrics: ['aov', 'total_net_sales', 'order_frequency'],
                keyInsights: ['Business activity', 'Operational scale', 'Transaction volume'],
                analysisPatterns: ['order trends', 'seasonality analysis', 'growth tracking']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['channel', 'product_category', 'region']
        });
    }

    private initializeCashFlowMetrics(): void {
        // Cash on Hand
        this.metrics.set('cash_on_hand', {
            id: 'cash_on_hand',
            name: 'Cash on Hand',
            aliases: ['cash balance', 'available cash', 'liquid cash'],
            description: 'Cash metrics are point in time at midnight of the last day of the selected period',
            category: 'cash_flow',
            subcategory: 'balances',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'accounting_system'],
            businessContext: {
                interpretation: 'Available liquid funds for operations',
                useCase: ['liquidity management', 'cash flow planning', 'financial health'],
                relatedMetrics: ['runway_months', 'change_in_cash', 'burn_rate'],
                keyInsights: ['Liquidity position', 'Financial stability', 'Operating capacity'],
                analysisPatterns: ['cash flow trends', 'liquidity analysis', 'financial planning']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: false
        });

        // Credit Card Balance
        this.metrics.set('credit_card_balance', {
            id: 'credit_card_balance',
            name: 'Credit Card Balance',
            aliases: ['cc balance', 'credit balance', 'outstanding credit'],
            description: 'Cash metrics are point in time at midnight of the last day of the selected period',
            category: 'cash_flow',
            subcategory: 'balances',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'accounting_system'],
            businessContext: {
                interpretation: 'Outstanding credit card debt',
                useCase: ['debt management', 'cash flow planning', 'financial health'],
                relatedMetrics: ['cash_on_hand', 'net_cash_position', 'interest_expense'],
                keyInsights: ['Debt levels', 'Credit utilization', 'Financial leverage'],
                analysisPatterns: ['debt trends', 'credit management', 'leverage analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['account', 'card_type']
        });

        // Change in Cash
        this.metrics.set('change_in_cash', {
            id: 'change_in_cash',
            name: 'Change in Cash',
            aliases: ['cash flow', 'net cash change', 'cash movement'],
            description: 'Period-over-period change in cash position',
            category: 'cash_flow',
            subcategory: 'flows',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'accounting_system'],
            businessContext: {
                interpretation: 'Net cash generation or consumption',
                useCase: ['cash flow analysis', 'operational efficiency', 'financial performance'],
                relatedMetrics: ['cash_on_hand', 'operating_cash_flow', 'burn_rate'],
                keyInsights: ['Cash generation', 'Operational efficiency', 'Financial sustainability'],
                analysisPatterns: ['cash flow analysis', 'trend analysis', 'operational performance']
            },
            recommendedChartTypes: ['line', 'waterfall', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['cash_source', 'business_unit']
        });

        // Runway Months
        this.metrics.set('runway_months', {
            id: 'runway_months',
            name: 'Runway Months',
            aliases: ['cash runway', 'months of runway', 'survival time'],
            description: 'Cash on hand / monthly burn rate',
            category: 'cash_flow',
            subcategory: 'projections',
            valueType: 'count',
            unit: 'months',
            calculation: {
                formula: 'cash_on_hand / monthly_burn_rate',
                description: 'Cash on hand divided by monthly burn rate',
                steps: [
                    'Calculate monthly burn rate',
                    'Divide Cash on Hand by monthly burn rate'
                ]
            },
            dependencies: ['cash_on_hand', 'monthly_burn_rate'],
            dataSources: ['iris_api', 'accounting_system'],
            businessContext: {
                interpretation: 'Time until cash depletion at current burn rate',
                useCase: ['financial planning', 'fundraising timing', 'cash management'],
                relatedMetrics: ['cash_on_hand', 'burn_rate', 'operating_cash_flow'],
                keyInsights: ['Financial runway', 'Sustainability timeline', 'Fundraising urgency'],
                analysisPatterns: ['runway projections', 'scenario analysis', 'financial planning']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: false
        });

        // Operating Expenses
        this.metrics.set('op_ex', {
            id: 'op_ex',
            name: 'Op Ex',
            aliases: ['operating expenses', 'operational costs', 'fixed costs'],
            description: 'Operating expenses including salaries, rent, and other fixed costs',
            category: 'cash_flow',
            subcategory: 'expenses',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'accounting_system'],
            businessContext: {
                interpretation: 'Fixed operational costs',
                useCase: ['cost management', 'budgeting', 'profitability analysis'],
                relatedMetrics: ['net_income', 'burn_rate', 'operating_margin'],
                keyInsights: ['Cost structure', 'Operational efficiency', 'Fixed cost management'],
                analysisPatterns: ['expense analysis', 'cost optimization', 'budget management']
            },
            recommendedChartTypes: ['line', 'bar', 'stacked-bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['expense_category', 'department', 'cost_center']
        });
    }

    private initializeSubscriberMetrics(): void {
        // New Subscribers Acquired
        this.metrics.set('new_subscribers_acquired', {
            id: 'new_subscribers_acquired',
            name: 'New Subscribers Acquired',
            aliases: ['new subscribers', 'subscriber acquisition', 'new signups'],
            description: 'Number of new subscribers acquired in the period',
            category: 'subscribers',
            subcategory: 'acquisition',
            valueType: 'count',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Subscription growth rate',
                useCase: ['subscription growth', 'acquisition tracking', 'marketing effectiveness'],
                relatedMetrics: ['churned_subscribers', 'net_subscribers_gained', 'subscriber_cac'],
                keyInsights: ['Subscription growth', 'Market penetration', 'Acquisition effectiveness'],
                analysisPatterns: ['subscription growth trends', 'acquisition funnel analysis']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'acquisition_channel']
        });

        // Churned Subscribers
        this.metrics.set('churned_subscribers', {
            id: 'churned_subscribers',
            name: 'Churned Subscribers',
            aliases: ['lost subscribers', 'subscription churn', 'cancelled subscriptions'],
            description: 'Number of subscribers who cancelled in the period',
            category: 'subscribers',
            subcategory: 'churn',
            valueType: 'count',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Subscription loss rate',
                useCase: ['churn analysis', 'retention improvement', 'customer satisfaction'],
                relatedMetrics: ['new_subscribers_acquired', 'churn_rate', 'retention_rate'],
                keyInsights: ['Customer satisfaction', 'Product-market fit', 'Retention challenges'],
                analysisPatterns: ['churn analysis', 'retention trends', 'satisfaction tracking']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['churn_reason', 'subscription_plan', 'tenure']
        });

        // Net Subscribers Gained
        this.metrics.set('net_subscribers_gained', {
            id: 'net_subscribers_gained',
            name: 'Net Subscribers Gained',
            aliases: ['net subscriber growth', 'subscriber net adds'],
            description: 'New Subscribers Acquired - Churned Subscribers',
            category: 'subscribers',
            valueType: 'count',
            calculation: {
                formula: 'new_subscribers_acquired - churned_subscribers',
                description: 'New Subscribers Acquired minus Churned Subscribers',
                steps: [
                    'Start with New Subscribers Acquired',
                    'Subtract Churned Subscribers'
                ]
            },
            dependencies: ['new_subscribers_acquired', 'churned_subscribers'],
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Net subscription base growth',
                useCase: ['subscription growth', 'business growth', 'market expansion'],
                relatedMetrics: ['subscriber_growth_rate', 'total_subscribers', 'churn_rate'],
                keyInsights: ['Net growth trajectory', 'Business sustainability', 'Market expansion'],
                analysisPatterns: ['net growth analysis', 'growth sustainability', 'market penetration']
            },
            recommendedChartTypes: ['line', 'waterfall', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'market_segment']
        });

        // New Subscriber Revenue
        this.metrics.set('new_subscriber_revenue', {
            id: 'new_subscriber_revenue',
            name: 'New Subscriber Revenue',
            aliases: ['new subscription revenue', 'acquisition revenue'],
            description: 'Revenue generated from newly acquired subscribers',
            category: 'subscribers',
            subcategory: 'revenue',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Revenue impact of subscriber acquisition',
                useCase: ['revenue growth', 'acquisition value', 'subscription performance'],
                relatedMetrics: ['new_subscriber_aov', 'subscription_ltv', 'arpu'],
                keyInsights: ['Acquisition value', 'Revenue growth', 'Subscriber quality'],
                analysisPatterns: ['acquisition revenue analysis', 'subscriber value trends']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'acquisition_channel']
        });

        // Returning Subscriber Revenue
        this.metrics.set('returning_subscriber_revenue', {
            id: 'returning_subscriber_revenue',
            name: 'Returning Subscriber Revenue',
            aliases: ['existing subscriber revenue', 'retention revenue'],
            description: 'Revenue generated from existing subscribers',
            category: 'subscribers',
            subcategory: 'revenue',
            valueType: 'currency',
            unit: 'USD',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Revenue from subscriber retention',
                useCase: ['retention value', 'recurring revenue', 'subscriber loyalty'],
                relatedMetrics: ['returning_subscriber_aov', 'subscription_ltv', 'retention_rate'],
                keyInsights: ['Retention value', 'Recurring revenue stability', 'Subscriber loyalty'],
                analysisPatterns: ['retention revenue analysis', 'recurring revenue trends']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'subscriber_segment']
        });

        // New Subscriber AOV
        this.metrics.set('new_subscriber_aov', {
            id: 'new_subscriber_aov',
            name: 'New Subscriber AOV',
            aliases: ['new subscriber average order value'],
            description: 'Average order value from newly acquired subscribers',
            category: 'subscribers',
            subcategory: 'metrics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'new_subscriber_revenue / new_subscriber_orders',
                description: 'New Subscriber Revenue divided by New Subscriber Orders',
                steps: [
                    'Divide New Subscriber Revenue by New Subscriber Orders'
                ]
            },
            dependencies: ['new_subscriber_revenue', 'new_subscriber_orders'],
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Value per transaction from new subscribers',
                useCase: ['subscriber value analysis', 'pricing strategy', 'acquisition quality'],
                relatedMetrics: ['returning_subscriber_aov', 'subscriber_ltv', 'arpu'],
                keyInsights: ['New subscriber value', 'Acquisition quality', 'Pricing effectiveness'],
                analysisPatterns: ['subscriber value analysis', 'acquisition quality assessment']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'acquisition_channel']
        });

        // Returning Subscriber AOV
        this.metrics.set('returning_subscriber_aov', {
            id: 'returning_subscriber_aov',
            name: 'Returning Subscriber AOV',
            aliases: ['existing subscriber aov', 'retention aov'],
            description: 'Average order value from existing subscribers',
            category: 'subscribers',
            subcategory: 'metrics',
            valueType: 'currency',
            unit: 'USD',
            calculation: {
                formula: 'returning_subscriber_revenue / returning_subscriber_orders',
                description: 'Returning Subscriber Revenue divided by Returning Subscriber Orders',
                steps: [
                    'Divide Returning Subscriber Revenue by Returning Subscriber Orders'
                ]
            },
            dependencies: ['returning_subscriber_revenue', 'returning_subscriber_orders'],
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Value per transaction from existing subscribers',
                useCase: ['retention value', 'loyalty analysis', 'subscriber lifecycle'],
                relatedMetrics: ['new_subscriber_aov', 'subscriber_ltv', 'retention_rate'],
                keyInsights: ['Retention value', 'Subscriber loyalty', 'Lifecycle progression'],
                analysisPatterns: ['retention value analysis', 'subscriber lifecycle tracking']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'subscriber_segment']
        });

        // New Subscriber Orders
        this.metrics.set('new_subscriber_orders', {
            id: 'new_subscriber_orders',
            name: 'New Subscriber Orders',
            aliases: ['new subscriber order count'],
            description: 'Number of orders from newly acquired subscribers',
            category: 'subscribers',
            subcategory: 'orders',
            valueType: 'count',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Order volume from new subscribers',
                useCase: ['subscriber engagement', 'acquisition success', 'onboarding effectiveness'],
                relatedMetrics: ['new_subscriber_aov', 'new_subscriber_revenue', 'engagement_rate'],
                keyInsights: ['New subscriber engagement', 'Onboarding success', 'Acquisition quality'],
                analysisPatterns: ['subscriber engagement analysis', 'onboarding effectiveness']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'acquisition_channel']
        });

        // Returning Subscriber Orders
        this.metrics.set('returning_subscriber_orders', {
            id: 'returning_subscriber_orders',
            name: 'Returning Subscriber Orders',
            aliases: ['existing subscriber orders', 'retention orders'],
            description: 'Number of orders from existing subscribers',
            category: 'subscribers',
            subcategory: 'orders',
            valueType: 'count',
            dataSources: ['iris_api', 'subscription_system'],
            businessContext: {
                interpretation: 'Order volume from retained subscribers',
                useCase: ['retention analysis', 'subscriber loyalty', 'engagement tracking'],
                relatedMetrics: ['returning_subscriber_aov', 'retention_rate', 'subscriber_ltv'],
                keyInsights: ['Subscriber loyalty', 'Retention success', 'Engagement levels'],
                analysisPatterns: ['retention engagement analysis', 'loyalty tracking']
            },
            recommendedChartTypes: ['line', 'bar'],
            supportsTimeSeries: true,
            supportsGrouping: true,
            groupingDimensions: ['subscription_plan', 'subscriber_segment']
        });
    }

    private initializeMetricRelationships(): void {
        // Sales relationships
        this.relationships.push(
            { fromMetric: 'gross_sales', toMetric: 'total_net_sales', relationshipType: 'feeds_into', strength: 0.9, description: 'Gross sales is the foundation for net sales calculation' },
            { fromMetric: 'discounts', toMetric: 'total_net_sales', relationshipType: 'feeds_into', strength: 0.8, description: 'Discounts reduce gross sales to calculate net sales' },
            { fromMetric: 'refunds', toMetric: 'total_net_sales', relationshipType: 'feeds_into', strength: 0.8, description: 'Refunds reduce gross sales to calculate net sales' },
            { fromMetric: 'net_shipping', toMetric: 'total_net_sales', relationshipType: 'feeds_into', strength: 0.7, description: 'Shipping revenue adds to net sales' }
        );

        // COGS relationships
        this.relationships.push(
            { fromMetric: 'product_cogs', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.9, description: 'Product COGS is the largest component of total COGS' },
            { fromMetric: 'inbound_freight', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.7, description: 'Inbound freight contributes to total cost structure' },
            { fromMetric: 'outbound_freight', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.7, description: 'Outbound freight contributes to total cost structure' },
            { fromMetric: '3pl_shipping', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.6, description: '3PL shipping costs contribute to total COGS' },
            { fromMetric: '3pl_fulfillment', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.6, description: '3PL fulfillment costs contribute to total COGS' },
            { fromMetric: 'payment_processor_fees', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.5, description: 'Payment fees are part of total cost structure' },
            { fromMetric: 'merchant_fees', toMetric: 'total_cogs', relationshipType: 'feeds_into', strength: 0.5, description: 'Merchant fees are part of total cost structure' }
        );

        // Profitability relationships
        this.relationships.push(
            { fromMetric: 'total_net_sales', toMetric: 'product_gross_profit', relationshipType: 'feeds_into', strength: 0.9, description: 'Net sales is revenue base for gross profit calculation' },
            { fromMetric: 'product_cogs', toMetric: 'product_gross_profit', relationshipType: 'feeds_into', strength: 0.9, description: 'Product COGS reduces gross profit' },
            { fromMetric: 'total_net_sales', toMetric: 'contribution_margin', relationshipType: 'feeds_into', strength: 0.9, description: 'Net sales is revenue base for contribution margin' },
            { fromMetric: 'total_cogs', toMetric: 'contribution_margin', relationshipType: 'feeds_into', strength: 0.9, description: 'Total COGS reduces contribution margin' },
            { fromMetric: 'total_marketing', toMetric: 'contribution_margin', relationshipType: 'feeds_into', strength: 0.8, description: 'Marketing spend reduces contribution margin' },
            { fromMetric: 'contribution_margin', toMetric: 'net_income', relationshipType: 'feeds_into', strength: 0.9, description: 'Contribution margin is base for net income calculation' },
            { fromMetric: 'op_ex', toMetric: 'net_income', relationshipType: 'feeds_into', strength: 0.8, description: 'Operating expenses reduce net income' }
        );

        // Unit economics relationships
        this.relationships.push(
            { fromMetric: 'total_net_sales', toMetric: 'aov', relationshipType: 'feeds_into', strength: 0.9, description: 'Net sales divided by orders gives AOV' },
            { fromMetric: 'total_orders', toMetric: 'aov', relationshipType: 'feeds_into', strength: 0.9, description: 'Order quantity is denominator for AOV calculation' },
            { fromMetric: 'total_marketing', toMetric: 'cac', relationshipType: 'feeds_into', strength: 0.9, description: 'Marketing spend drives customer acquisition cost' },
            { fromMetric: 'new_customers', toMetric: 'cac', relationshipType: 'feeds_into', strength: 0.9, description: 'New customers is denominator for CAC calculation' },
            { fromMetric: 'total_net_sales', toMetric: 'ltv', relationshipType: 'feeds_into', strength: 0.8, description: 'Net sales contributes to customer lifetime value' },
            { fromMetric: 'unique_customers', toMetric: 'ltv', relationshipType: 'feeds_into', strength: 0.8, description: 'Customer count is denominator for LTV calculation' },
            { fromMetric: 'ltv', toMetric: 'ltv_cac_ratio', relationshipType: 'feeds_into', strength: 0.9, description: 'LTV is numerator in LTV/CAC ratio' },
            { fromMetric: 'cac', toMetric: 'ltv_cac_ratio', relationshipType: 'feeds_into', strength: 0.9, description: 'CAC is denominator in LTV/CAC ratio' }
        );

        // Marketing relationships
        this.relationships.push(
            { fromMetric: 'fb_ads', toMetric: 'total_marketing', relationshipType: 'feeds_into', strength: 0.7, description: 'Facebook ads contribute to total marketing spend' },
            { fromMetric: 'google_ads', toMetric: 'total_marketing', relationshipType: 'feeds_into', strength: 0.7, description: 'Google ads contribute to total marketing spend' },
            { fromMetric: 'amazon_ads', toMetric: 'total_marketing', relationshipType: 'feeds_into', strength: 0.6, description: 'Amazon ads contribute to total marketing spend' },
            { fromMetric: 'product_giveaway_marketing', toMetric: 'total_marketing', relationshipType: 'feeds_into', strength: 0.5, description: 'Product giveaways contribute to total marketing spend' },
            { fromMetric: 'total_net_sales', toMetric: 'net_mer', relationshipType: 'feeds_into', strength: 0.9, description: 'Net sales is numerator for ROAS calculation' },
            { fromMetric: 'total_marketing', toMetric: 'net_mer', relationshipType: 'feeds_into', strength: 0.9, description: 'Marketing spend is denominator for ROAS calculation' }
        );

        // Quantity relationships
        this.relationships.push(
            { fromMetric: 'new_customers', toMetric: 'unique_customers', relationshipType: 'feeds_into', strength: 0.8, description: 'New customers contribute to total unique customers' },
            { fromMetric: 'returning_customers', toMetric: 'unique_customers', relationshipType: 'feeds_into', strength: 0.8, description: 'Returning customers contribute to total unique customers' },
            { fromMetric: 'new_customer_orders', toMetric: 'total_orders', relationshipType: 'feeds_into', strength: 0.7, description: 'New customer orders contribute to total orders' },
            { fromMetric: 'returning_customer_orders', toMetric: 'total_orders', relationshipType: 'feeds_into', strength: 0.7, description: 'Returning customer orders contribute to total orders' }
        );

        // Cash flow relationships
        this.relationships.push(
            { fromMetric: 'cash_on_hand', toMetric: 'runway_months', relationshipType: 'feeds_into', strength: 0.9, description: 'Cash on hand is numerator for runway calculation' },
            { fromMetric: 'net_income', toMetric: 'change_in_cash', relationshipType: 'correlates_with', strength: 0.7, description: 'Net income influences cash flow changes' },
            { fromMetric: 'op_ex', toMetric: 'runway_months', relationshipType: 'feeds_into', strength: 0.8, description: 'Operating expenses affect burn rate and runway' }
        );

        // Cross-category strategic relationships
        this.relationships.push(
            { fromMetric: 'cac', toMetric: 'contribution_margin', relationshipType: 'correlates_with', strength: 0.6, description: 'Lower CAC improves overall unit economics' },
            { fromMetric: 'aov', toMetric: 'contribution_margin', relationshipType: 'correlates_with', strength: 0.7, description: 'Higher AOV typically improves contribution margin' },
            { fromMetric: 'ltv_cac_ratio', toMetric: 'runway_months', relationshipType: 'correlates_with', strength: 0.5, description: 'Better unit economics extend financial runway' },
            { fromMetric: 'net_mer', toMetric: 'contribution_margin', relationshipType: 'correlates_with', strength: 0.7, description: 'Marketing efficiency impacts overall profitability' }
        );

        // Subscriber relationships
        this.relationships.push(
            { fromMetric: 'new_subscribers_acquired', toMetric: 'net_subscribers_gained', relationshipType: 'feeds_into', strength: 0.8, description: 'New subscribers contribute to net subscriber growth' },
            { fromMetric: 'churned_subscribers', toMetric: 'net_subscribers_gained', relationshipType: 'feeds_into', strength: 0.8, description: 'Churned subscribers reduce net subscriber growth' },
            { fromMetric: 'new_subscriber_revenue', toMetric: 'new_subscriber_aov', relationshipType: 'feeds_into', strength: 0.9, description: 'New subscriber revenue drives AOV calculation' },
            { fromMetric: 'new_subscriber_orders', toMetric: 'new_subscriber_aov', relationshipType: 'feeds_into', strength: 0.9, description: 'New subscriber orders is denominator for AOV' },
            { fromMetric: 'returning_subscriber_revenue', toMetric: 'returning_subscriber_aov', relationshipType: 'feeds_into', strength: 0.9, description: 'Returning subscriber revenue drives AOV calculation' },
            { fromMetric: 'returning_subscriber_orders', toMetric: 'returning_subscriber_aov', relationshipType: 'feeds_into', strength: 0.9, description: 'Returning subscriber orders is denominator for AOV' }
        );
    }
}