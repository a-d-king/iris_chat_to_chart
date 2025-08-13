import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAnalysis } from './data/data-analysis.service';
import { startTrace } from './observability/langfuse';
import { EcommerceSemanticService } from './semantic/ecommerce-semantic.service';

const openai = new OpenAI();

/**
 * OpenAI tool schema for chart creation
 * Define the structure that GPT should follow when generating chart specifications
 */
const TOOL_SCHEMA = [{
    type: 'function' as const,
    function: {
        name: 'create_chart',
        description: 'Produce a simple chart spec',
        parameters: {
            type: 'object',
            properties: {
                chartType: {
                    enum: ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'],
                    description: 'Type of chart to generate'
                },
                metric: {
                    type: 'string',
                    description: 'The metric to display in the chart'
                },
                groupBy: {
                    type: 'string',
                    description: 'Optional grouping dimension for the data'
                },
                dateRange: {
                    type: 'string',
                    pattern: 'YYYY[-MM]',
                    description: 'Date range in YYYY or YYYY-MM format'
                }
            },
            required: ['chartType', 'metric', 'dateRange']
        }
    }
}];

/**
 * Service for handling OpenAI API interactions
 * Processes natural language prompts and returns structured chart specifications
 */
@Injectable()
export class OpenAiService {
    constructor(private ecommerceSemantic: EcommerceSemanticService) {}
    /**
     * Send a prompt to GPT and get back a structured chart specification with explicit reasoning
     * @param prompt - Natural language description of the desired chart
     * @param dataAnalysis - Analysis of available data for context
     * @returns Promise<ChartSpecDto> - Structured chart specification
     */
    async prompt(prompt: string, dataAnalysis?: DataAnalysis) {
        // Step 1: Get explicit reasoning from GPT-4
        const reasoningResponse = await this.generateReasoning(prompt, dataAnalysis);

        // Step 2: Use reasoning to make final decision
        const chartSpec = await this.makeReasonedDecision(prompt, dataAnalysis, reasoningResponse);

        return {
            ...chartSpec,
            aiReasoning: reasoningResponse
        };
    }

    /**
     * Generate explicit step-by-step reasoning for chart selection
     */
    private async generateReasoning(prompt: string, dataAnalysis?: DataAnalysis) {
        const trace = startTrace('openai.generateReasoning', {
            prompt,
            metrics: dataAnalysis?.availableMetrics?.length
        });
        const span = trace?.span({ name: 'openai.chat.completions', metadata: { model: 'gpt-4o' } });
        // Get semantic context for enhanced prompting
        const semanticContext = dataAnalysis ? 
            this.ecommerceSemantic.getSemanticContextForQuery(prompt, dataAnalysis) : 
            null;

        let reasoningPrompt = `You are an ecommerce data visualization expert with deep knowledge of business metrics and KPIs. Think step-by-step about this visualization request.

USER REQUEST: "${prompt}"

Think through this systematically:

STEP 1 - ANALYZE USER INTENT & BUSINESS CONTEXT:
- What is the user trying to understand or discover?
- Are they looking for trends, comparisons, compositions, or patterns?
- What specific keywords indicate their analytical intent?
- Are they asking for temporal analysis, categorical comparison, or compositional breakdown?
- What business domain does this relate to (sales, marketing, profitability, unit economics, cash flow)?
- What business decisions might this analysis support?

STEP 2 - EVALUATE AVAILABLE DATA:
- What types of metrics are available?
- Which metrics best match the user's request?
- What are the data characteristics (temporal, categorical, scalar)?
- What are the data quality considerations?

STEP 3 - CONSIDER CHART VISUALIZATION PRINCIPLES:
- line: Best for continuous data, trends over time, temporal patterns
  → Use when: User wants to see progression, growth, decline, patterns over time
  → Data requirements: Time series data, continuous values
- bar: Best for categorical comparisons, discrete values, direct comparison
  → Use when: User wants to compare different categories or discrete values
  → Data requirements: Categorical data, discrete measurements
- stacked-bar: Best for composition analysis, part-to-whole relationships
  → Use when: User wants to see both total values AND how they break down
  → Data requirements: Multiple related categories that logically stack
- heatmap: Best for patterns across two dimensions, correlation analysis
  → Use when: User wants to see patterns, intensity, or relationships across multiple dimensions
  → Data requirements: Multi-dimensional data with meaningful correlations
- waterfall: Best for cumulative changes, sequential impact analysis
  → Use when: User wants to see how values build up or break down step by step
  → Data requirements: Sequential changes, positive/negative contributions

STEP 4 - MATCH DATA TO VISUALIZATION:
- Which chart type best serves the data characteristics AND user intent?
- How does the data structure align with visualization requirements?
- What specific metric should be used and why?
- What date range is most appropriate for the analysis?

STEP 5 - FINAL DECISION:
- Based on steps 1-4, what is your recommended chart type?
- Explain how this choice serves both the data structure and user intent
- What are the key factors that led to this decision?

Please provide your reasoning for each step clearly and explicitly.`;

        if (dataAnalysis) {
            reasoningPrompt += `\n\nAVAILABLE DATA:\n${dataAnalysis.dataContext}`;

            // Add semantic context and business intelligence
            if (semanticContext) {
                reasoningPrompt += `\n\nBUSINESS CONTEXT & DOMAIN KNOWLEDGE:`;
                
                if (semanticContext.suggestedMetrics && semanticContext.suggestedMetrics.length > 0) {
                    reasoningPrompt += `\n\nSEMANTIC METRIC SUGGESTIONS:`;
                    semanticContext.suggestedMetrics.slice(0, 5).forEach(suggestion => {
                        reasoningPrompt += `\n- ${suggestion.metricId}: ${suggestion.reason} (relevance: ${Math.round(suggestion.relevanceScore * 100)}%)`;
                        if (suggestion.businessContext) {
                            reasoningPrompt += `\n  Business Context: ${suggestion.businessContext}`;
                        }
                    });
                }

                if (semanticContext.domainContext) {
                    reasoningPrompt += `\n\nDOMAIN INSIGHTS:`;
                    if (semanticContext.domainContext.category) {
                        reasoningPrompt += `\n- Primary business domain: ${semanticContext.domainContext.category}`;
                    }
                    if (semanticContext.domainContext.relatedMetrics && semanticContext.domainContext.relatedMetrics.length > 0) {
                        reasoningPrompt += `\n- Related ecommerce metrics: ${semanticContext.domainContext.relatedMetrics.slice(0, 5).join(', ')}`;
                    }
                    if (semanticContext.domainContext.businessQuestions && semanticContext.domainContext.businessQuestions.length > 0) {
                        reasoningPrompt += `\n- Key business questions this analysis might answer:`;
                        semanticContext.domainContext.businessQuestions.slice(0, 3).forEach(question => {
                            reasoningPrompt += `\n  • ${question}`;
                        });
                    }
                }

                if (semanticContext.analysisEnrichment) {
                    if (semanticContext.analysisEnrichment.benchmarkContext) {
                        reasoningPrompt += `\n\nINDUSTRY BENCHMARKS:`;
                        reasoningPrompt += `\n- ${semanticContext.analysisEnrichment.benchmarkContext}`;
                    }
                    if (semanticContext.analysisEnrichment.businessInsights && semanticContext.analysisEnrichment.businessInsights.length > 0) {
                        reasoningPrompt += `\n\nBUSINESS INSIGHTS:`;
                        semanticContext.analysisEnrichment.businessInsights.forEach(insight => {
                            reasoningPrompt += `\n- ${insight}`;
                        });
                    }
                }
            }

            reasoningPrompt += `\n\nMETRICS:`;
            dataAnalysis.availableMetrics.slice(0, 10).forEach(metric => {
                let metricLine = `\n- ${metric.name}: ${metric.description} (${metric.type}, ${metric.valueType})`;
                
                // Add semantic enhancements if available
                if (metric.semanticCategory) {
                    metricLine += ` [${metric.semanticCategory}]`;
                }
                if (metric.isBusinessKPI) {
                    metricLine += ` ⭐ Key Business KPI`;
                }
                if (metric.businessContext) {
                    metricLine += `\n  Business Context: ${metric.businessContext}`;
                }
                
                reasoningPrompt += metricLine;
            });

            // Add chart suggestions to help guide reasoning
            if (dataAnalysis.suggestedChartTypes.length > 0) {
                reasoningPrompt += `\n\nCHART SUGGESTIONS FROM DATA ANALYSIS:`;
                dataAnalysis.suggestedChartTypes.forEach(suggestion => {
                    reasoningPrompt += `\n- ${suggestion.chartType}: ${suggestion.reason} (confidence: ${suggestion.confidence})`;
                    reasoningPrompt += `\n  Best for: ${suggestion.bestForMetrics.join(', ')}`;
                });
                reasoningPrompt += `\n\nNote: These are suggestions based on data characteristics. Consider them alongside user intent and business context.`;
            }

            // Add data quality warnings for reasoning
            const qualityIssues = this.identifyDataQualityIssues(dataAnalysis);
            if (qualityIssues.length > 0) {
                reasoningPrompt += `\n\nDATA QUALITY CONCERNS:`;
                qualityIssues.forEach(issue => {
                    reasoningPrompt += `\n- ${issue}`;
                });
            }
        }

        const reasoningResponse = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0.3, // Slightly higher for reasoning creativity
            messages: [{
                role: 'user',
                content: reasoningPrompt
            }]
        });

        const reasoning = reasoningResponse.choices[0].message.content;
        console.log('\n=== GPT-4 RUNTIME REASONING PROCESS ===');
        console.log(reasoning);
        console.log('=== END REASONING ===\n');

        try {
            (span as any)?.end({ output: reasoning });
            (trace as any)?.end({ output: { reasoning } });
        } catch { }
        return reasoning;
    }

    /**
     * Make final decision based on reasoning
     */
    private async makeReasonedDecision(prompt: string, dataAnalysis?: DataAnalysis, reasoning?: string) {
        const trace = startTrace('openai.makeReasonedDecision', { prompt });
        const span = trace?.span({ name: 'openai.chat.completions', metadata: { model: 'gpt-4o', tools: true } });
        
        // Get semantic context for enhanced decision making
        const semanticContext = dataAnalysis ? 
            this.ecommerceSemantic.getSemanticContextForQuery(prompt, dataAnalysis) : 
            null;
            
        let decisionPrompt = `Based on the following reasoning, create a precise chart specification that leverages ecommerce domain knowledge.

ORIGINAL REQUEST: "${prompt}"

MY REASONING:
${reasoning}

Now, create a structured chart specification that implements the decision from your reasoning while considering business context.

CHART TYPE OPTIONS WITH BUSINESS USE CASES:
- line: Time series trends (perfect for revenue growth, customer acquisition trends, marketing performance over time)
- bar: Categorical comparisons (ideal for channel performance, product comparisons, regional analysis)
- stacked-bar: Composition analysis (excellent for revenue breakdown by product, cost composition, marketing spend allocation)
- heatmap: Pattern visualization (great for seasonal patterns, customer behavior across segments, performance correlations)
- waterfall: Sequential changes (perfect for profit & loss analysis, cash flow changes, conversion funnel analysis)

BUSINESS DECISION CRITERIA:
- Prioritize metrics that directly impact business decisions
- Consider the audience: executive summary vs operational deep-dive
- Ensure the visualization answers key business questions
- Select timeframes that align with business planning cycles

Select the chart type, metric, and date range that best implements your reasoning above.`;

        if (dataAnalysis) {
            // Add semantic insights to decision making
            if (semanticContext && semanticContext.suggestedMetrics && semanticContext.suggestedMetrics.length > 0) {
                decisionPrompt += `\n\nRECOMMENDED BUSINESS METRICS (in priority order):`;
                semanticContext.suggestedMetrics.slice(0, 5).forEach((suggestion, index) => {
                    decisionPrompt += `\n${index + 1}. ${suggestion.metricId} (${Math.round(suggestion.relevanceScore * 100)}% relevance)`;
                    if (suggestion.businessContext) {
                        decisionPrompt += ` - ${suggestion.businessContext}`;
                    }
                });
            }

            decisionPrompt += `\n\nAVAILABLE METRICS:`;
            dataAnalysis.availableMetrics.forEach(metric => {
                let metricDescription = `\n- ${metric.name}: ${metric.description}`;
                
                // Highlight business-critical metrics
                if (metric.isBusinessKPI) {
                    metricDescription += ` ⭐ CRITICAL BUSINESS KPI`;
                }
                if (metric.semanticCategory) {
                    metricDescription += ` [${metric.semanticCategory}]`;
                }
                
                decisionPrompt += metricDescription;
            });

            // Add business context considerations
            if (semanticContext && semanticContext.analysisEnrichment && semanticContext.analysisEnrichment.businessInsights) {
                decisionPrompt += `\n\nBUSINESS CONTEXT CONSIDERATIONS:`;
                semanticContext.analysisEnrichment.businessInsights.forEach(insight => {
                    decisionPrompt += `\n- ${insight}`;
                });
            }
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0,
            messages: [{
                role: 'user',
                content: decisionPrompt
            }],
            tools: TOOL_SCHEMA,
            tool_choice: { type: 'function', function: { name: 'create_chart' } }
        });

        // Parse the tool call arguments into a chart spec object
        const toolCall = response.choices[0].message.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
            const chartSpec = JSON.parse(toolCall.function.arguments);
            console.log('Chart decision based on reasoning:', chartSpec);
            try {
                (span as any)?.end({ output: chartSpec });
                (trace as any)?.end({ output: { chartSpec } });
            } catch { }
            return chartSpec;
        } else {
            const err = new Error('OpenAI did not return a valid tool call response');
            try {
                (span as any)?.end({ level: 'ERROR', statusMessage: String(err) });
                (trace as any)?.end({ level: 'ERROR', statusMessage: String(err) });
            } catch { }
            throw err;
        }
    }

    /**
     * Identify data quality issues that should influence chart selection
     */
    private identifyDataQualityIssues(dataAnalysis: DataAnalysis): string[] {
        const issues: string[] = [];

        dataAnalysis.availableMetrics.forEach(metric => {
            const unknownRatio = (metric.groupingDimensions?.filter(d =>
                d.toLowerCase().includes('unknown') ||
                d.toLowerCase().includes('undefined') ||
                d.toLowerCase().includes('null') ||
                d.trim() === '' ||
                d.toLowerCase().includes('category')
            ).length || 0) / (metric.groupingDimensions?.length || 1);

            if (unknownRatio > 0.3) {
                issues.push(`${metric.name} has ${Math.round(unknownRatio * 100)}% unknown/unlabeled categories`);
            }

            if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) === 1) {
                issues.push(`${metric.name} has only one category - stacking not beneficial`);
            }

            if (metric.hasGrouping && (metric.groupingDimensions?.length || 0) > 8) {
                issues.push(`${metric.name} has ${metric.groupingDimensions?.length} categories - too many for effective stacking`);
            }
        });

        return issues;
    }
} 