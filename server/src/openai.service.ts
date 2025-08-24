import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAnalysis } from './data/data-analysis.service';
import { ReasoningSummary } from './dto/chat.dto';
import { startTrace } from './observability/langfuse';

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

        // Step 3: Generate condensed reasoning summary
        const reasoningSummary = this.generateReasoningSummary(
            prompt,
            chartSpec,
            reasoningResponse,
            dataAnalysis
        );

        return {
            ...chartSpec,
            aiReasoning: reasoningResponse,
            reasoning_summary: reasoningSummary
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
        let reasoningPrompt = `You are a data visualization expert. Think step-by-step about this visualization request.

USER REQUEST: "${prompt}"

Think through this systematically:

STEP 1 - ANALYZE USER INTENT:
- What is the user trying to understand or discover?
- Are they looking for trends, comparisons, compositions, or patterns?
- What specific keywords indicate their analytical intent?
- Are they asking for temporal analysis, categorical comparison, or compositional breakdown?

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

            reasoningPrompt += `\n\nMETRICS:`;
            dataAnalysis.availableMetrics.slice(0, 10).forEach(metric => {
                const displayName = metric.businessName || metric.displayName || metric.name;
                reasoningPrompt += `\n- ${displayName}: ${metric.description} (${metric.type}, ${metric.valueType})`;
                // Include technical name for reference if different from display name
                if (displayName !== metric.name) {
                    reasoningPrompt += ` [Technical: ${metric.name}]`;
                }
            });

            // Add chart suggestions with evidence-based confidence to help guide reasoning
            if (dataAnalysis.suggestedChartTypes.length > 0) {
                reasoningPrompt += `\n\nCHART SUGGESTIONS FROM DATA ANALYSIS:`;
                dataAnalysis.suggestedChartTypes.forEach(suggestion => {
                    const confidenceLevel = this.getConfidenceLevelName(suggestion.confidence);
                    reasoningPrompt += `\n- ${suggestion.chartType}: ${suggestion.reason}`;
                    reasoningPrompt += `\n  Confidence: ${confidenceLevel} (${suggestion.confidence.toFixed(2)})`;

                    // Add evidence details if available
                    if (suggestion.evidence) {
                        reasoningPrompt += `\n  Evidence: Intent alignment ${(suggestion.evidence.intentAlignment * 100).toFixed(0)}%, Data fit ${(suggestion.evidence.dataCompatibility * 100).toFixed(0)}%`;
                    }

                    // Convert technical metric names to business names for better readability
                    const businessMetricNames = suggestion.bestForMetrics.map(metricName => {
                        const metric = dataAnalysis.availableMetrics.find(m => m.name === metricName);
                        return metric?.businessName || metric?.displayName || metricName;
                    });
                    reasoningPrompt += `\n  Best for: ${businessMetricNames.join(', ')}`;
                });
                reasoningPrompt += `\n\nNote: These suggestions balance data characteristics with user intent. Higher intent alignment indicates better fit for your analytical goals.`;
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
        let decisionPrompt = `Based on the following reasoning, create a precise chart specification.

ORIGINAL REQUEST: "${prompt}"

MY REASONING:
${reasoning}

Now, create a structured chart specification that implements the decision from your reasoning.

CHART TYPE OPTIONS:
- line: Time series trends
- bar: Categorical comparisons  
- stacked-bar: Composition analysis
- heatmap: Pattern visualization
- waterfall: Sequential changes

Select the chart type, metric, and date range that best implements your reasoning above.

IMPORTANT: When selecting a metric, use the TECHNICAL name (shown in brackets) for the "metric" field in your response, not the business name.`;

        if (dataAnalysis) {
            decisionPrompt += `\n\nAVAILABLE METRICS:`;
            dataAnalysis.availableMetrics.forEach(metric => {
                const displayName = metric.businessName || metric.displayName || metric.name;
                decisionPrompt += `\n- ${displayName}: ${metric.description}`;
                // Include technical name for reference if different from display name
                if (displayName !== metric.name) {
                    decisionPrompt += ` [Technical: ${metric.name}]`;
                }
            });
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

    /**
     * Generate condensed reasoning summary from verbose reasoning
     */
    private generateReasoningSummary(
        prompt: string,
        chartSpec: any,
        verboseReasoning: string,
        dataAnalysis?: DataAnalysis
    ): ReasoningSummary {
        // Extract intent from reasoning or prompt
        const intent = this.extractIntent(prompt, verboseReasoning);

        // Extract key rationale points from verbose reasoning
        const rationalePoints = this.extractRationalePoints(verboseReasoning, dataAnalysis);

        // Calculate confidence from reasoning
        const confidence = this.extractConfidence(verboseReasoning, dataAnalysis);

        // Structure key decisions
        const decisions = [
            {
                name: "chart_type",
                choice: chartSpec.chartType,
                why: this.getChartTypeRationale(chartSpec.chartType, verboseReasoning)
            },
            {
                name: "metric_selection",
                choice: chartSpec.metric,
                why: "best match for user intent"
            }
        ];

        if (chartSpec.groupBy) {
            decisions.push({
                name: "grouping",
                choice: chartSpec.groupBy,
                why: "enables comparison analysis"
            });
        }

        return {
            intent,
            rationale_points: rationalePoints,
            confidence: Math.round(confidence * 100) / 100,
            decisions
        };
    }

    private extractIntent(prompt: string, reasoning: string): string {
        const promptLower = prompt.toLowerCase();

        // Check for temporal patterns
        if (/trend|over time|timeline|growth|decline|progression/.test(promptLower)) {
            return "trend_comparison";
        }

        // Check for comparison patterns  
        if (/compare|vs|versus|difference|between/.test(promptLower)) {
            return "categorical_comparison";
        }

        // Check for composition patterns
        if (/breakdown|composition|parts|segments|split/.test(promptLower)) {
            return "compositional_breakdown";
        }

        // Check for overview patterns
        if (/overview|summary|dashboard|insights/.test(promptLower)) {
            return "performance_overview";
        }

        // Default based on reasoning content
        if (reasoning.includes('time series') || reasoning.includes('temporal')) {
            return "trend_comparison";
        }

        return "data_exploration";
    }

    private extractRationalePoints(reasoning: string, dataAnalysis?: DataAnalysis): string[] {
        const points = [];

        // Check for temporal signals
        if (/time series|temporal|trends over time/.test(reasoning)) {
            points.push("time series patterns detected");
        }

        // Check for data quality mentions
        if (reasoning.includes('data quality') || reasoning.includes('complete')) {
            points.push("high data completeness");
        }

        // Check for granularity mentions
        if (/monthly|daily|weekly/.test(reasoning)) {
            const granularity = reasoning.match(/(monthly|daily|weekly)/)?.[0];
            if (granularity) {
                points.push(`${granularity} granularity available`);
            }
        }

        // Check for comparison signals
        if (/comparison|compare|categories/.test(reasoning)) {
            points.push("categorical comparison needed");
        }

        // Check for composition signals  
        if (/composition|breakdown|stacked/.test(reasoning)) {
            points.push("composition analysis required");
        }

        // Add data-driven points
        if (dataAnalysis?.availableMetrics) {
            const metricCount = dataAnalysis.availableMetrics.length;
            if (metricCount > 10) {
                points.push("rich metric set available");
            }
        }

        // Ensure we have at least 2-3 points
        if (points.length < 2) {
            points.push("data characteristics analyzed");
            points.push("visualization requirements assessed");
        }

        return points.slice(0, 4); // Keep it concise
    }

    /**
     * Extract evidence-based confidence from reasoning and data analysis
     */
    private extractConfidence(reasoning: string, dataAnalysis?: DataAnalysis): number {
        let confidence = 0.6; // Base confidence - more conservative

        // Intent clarity indicators
        if (reasoning.includes('clear') || reasoning.includes('obvious') || reasoning.includes('specific')) {
            confidence += 0.15;
        }
        if (reasoning.includes('aligns with') || reasoning.includes('serves the intent')) {
            confidence += 0.1;
        }

        // Data quality and match indicators
        if (reasoning.includes('perfect match') || reasoning.includes('ideal') || reasoning.includes('excellent fit')) {
            confidence += 0.15;
        }
        if (reasoning.includes('good fit') || reasoning.includes('suitable')) {
            confidence += 0.1;
        }

        // Uncertainty and conflict indicators
        if (reasoning.includes('uncertain') || reasoning.includes('unclear') || reasoning.includes('ambiguous')) {
            confidence -= 0.2;
        }
        if (reasoning.includes('limited') || reasoning.includes('may not') || reasoning.includes('might not')) {
            confidence -= 0.15;
        }

        // Use data analysis suggestions as evidence
        if (dataAnalysis?.suggestedChartTypes?.length > 0) {
            const topSuggestion = dataAnalysis.suggestedChartTypes[0];
            if (topSuggestion.confidence > 0.8) {
                confidence += 0.1; // Boost for high-confidence data suggestions
            }
        }

        // Data quality based on metric richness
        if (dataAnalysis) {
            const richMetrics = dataAnalysis.availableMetrics.filter(m =>
                m.hasTimeData || m.hasGrouping || m.description?.length > 20
            );
            const qualityScore = richMetrics.length / Math.max(1, dataAnalysis.availableMetrics.length);
            confidence += qualityScore * 0.1;
        }

        // Clamp to meaningful confidence levels
        return Math.max(0.2, Math.min(0.95, confidence));
    }

    /**
     * Convert confidence score to human-readable level
     */
    private getConfidenceLevelName(confidence: number): string {
        if (confidence >= 0.85) return 'Excellent';
        if (confidence >= 0.7) return 'Good';
        if (confidence >= 0.55) return 'Acceptable';
        if (confidence >= 0.35) return 'Poor';
        return 'Unsuitable';
    }

    private getChartTypeRationale(chartType: string, reasoning: string): string {
        // Extract specific rationale from reasoning if available
        if (reasoning.includes('temporal') || reasoning.includes('time series')) {
            return "temporal data structure";
        }

        if (reasoning.includes('comparison') || reasoning.includes('categories')) {
            return "categorical comparison";
        }

        // Default rationales by chart type
        const rationales: Record<string, string> = {
            'line': 'optimal for temporal trends',
            'bar': 'best for categorical comparison',
            'stacked-bar': 'shows composition breakdown',
            'heatmap': 'reveals pattern relationships',
            'waterfall': 'displays sequential changes'
        };

        return rationales[chartType] || 'matched to data characteristics';
    }
} 