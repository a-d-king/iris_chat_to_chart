import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAnalysis } from './data-analysis.service';

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
     * Send a prompt to GPT and get back a structured chart specification
     * @param prompt - Natural language description of the desired chart
     * @param dataAnalysis - Analysis of available data for context
     * @returns Promise<ChartSpecDto> - Structured chart specification
     */
    async prompt(prompt: string, dataAnalysis?: DataAnalysis) {
        let primaryPrompt = `You are a data visualization expert. Analyze this request and create the most appropriate chart specification.

USER REQUEST: "${prompt}"

CHART TYPE SELECTION GUIDELINES:
- **line**: Best for time series trends, showing change over time. Use for single or multiple metrics over dates.
- **bar**: Best for comparing values across categories or discrete time periods. Use when emphasis is on comparison, not trends.
- **stacked-bar**: Best for showing composition and part-to-whole relationships over categories or time.
- **heatmap**: Best for showing intensity/correlation patterns across two dimensions (e.g., time vs categories).
- **waterfall**: Best for showing cumulative effect of sequential positive/negative changes.

DATA STRUCTURE MAPPING:
- **timeSeries metrics**: Work best with line charts (trends) or bar charts (period comparison)
- **groupedSeries metrics**: Ideal for stacked-bar (composition) or multi-line charts (comparison)
- **scalar metrics**: Use bar charts for single values or combine with other metrics

ANALYSIS APPROACH:
1. First, identify the user's analytical intent (trend analysis, comparison, composition, etc.)
2. Consider the temporal aspect - are they asking about changes over time?
3. Match the intent with the most suitable chart type
4. Choose date ranges that make sense for the analysis (broader for trends, specific for snapshots)

USER INTENT KEYWORDS:
- "trend/trending/over time/growth/decline" → line chart
- "compare/comparison/vs/versus/against" → bar chart  
- "breakdown/composition/parts/segments" → stacked-bar chart
- "pattern/correlation/intensity" → heatmap chart
- "impact/effect/contribution/waterfall" → waterfall chart`;

        if (dataAnalysis) {
            primaryPrompt += `\n\nAVAILABLE DATA CONTEXT:\n${dataAnalysis.dataContext}`;

            // Add data quality warnings
            const qualityIssues = this.identifyDataQualityIssues(dataAnalysis);
            if (qualityIssues.length > 0) {
                primaryPrompt += `\n\nDATA QUALITY CONCERNS:`;
                qualityIssues.forEach(issue => {
                    primaryPrompt += `\n- ${issue}`;
                });
                primaryPrompt += `\n\nChart Selection Impact: Prefer simpler chart types when data quality is poor.`;
            }

            primaryPrompt += `\n\nAVAILABLE METRICS:`;
            dataAnalysis.availableMetrics.forEach(metric => {
                primaryPrompt += `\n- **${metric.name}**: ${metric.description}`;
                primaryPrompt += `\n  └ Type: ${metric.type}, Values: ${metric.valueType}`;

                // Add chart type suggestions based on metric type
                if (metric.type === 'timeSeries') {
                    primaryPrompt += ` → Recommended: line (trends) or bar (periods)`;
                } else if (metric.type === 'groupedSeries') {
                    primaryPrompt += ` → Recommended: stacked-bar (composition) or line (comparison)`;
                } else if (metric.type === 'scalar') {
                    primaryPrompt += ` → Recommended: bar (single value)`;
                }
            });

            if (dataAnalysis.suggestedChartTypes.length > 0) {
                primaryPrompt += `\n\nAUTO-GENERATED SUGGESTIONS:`;
                dataAnalysis.suggestedChartTypes.forEach(suggestion => {
                    primaryPrompt += `\n- ${suggestion.chartType}: ${suggestion.reason} (confidence: ${suggestion.confidence})`;
                });
            }

            primaryPrompt += `\n\nEXAMPLES OF GOOD SELECTIONS:
- "Show revenue trends" → line chart with revenue metric, full date range
- "Compare channels" → stacked-bar chart with revenue grouped by channel
- "June performance" → bar chart with key metrics, dateRange: "2025-06"
- "User growth over time" → line chart with user metrics, broad date range`;
        }

        primaryPrompt += `\n\nCHART SELECTION RULES:
- **AVOID stacked-bar when**: Only 1 category, >40% "Unknown" categories, unclear category labels
- **PREFER bar over stacked-bar when**: Categories don't logically stack together, data quality is poor
- **USE line charts when**: Clear temporal progression, trend analysis is the goal
- **FALLBACK to bar**: When other chart types have data quality issues

MARKETING EXPENSES SPECIFIC:
- If showing expenses by channel/type: Use bar chart for clear comparison
- If showing expenses over time: Use line chart for trend analysis  
- Only use stacked-bar if showing expense composition AND have clean category labels

IMPORTANT: 
- Choose the chart type that best matches the user's analytical intent
- Select appropriate date ranges (specific months for snapshots, full year for trends)
- If the request is ambiguous, default to the most informative visualization
- Prioritize clarity and insight over complexity
- When data quality is poor, prefer simpler chart types that remain readable`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            // Deterministic responses
            temperature: 0,
            messages: [{
                role: 'user',
                content: primaryPrompt
            }],
            tools: TOOL_SCHEMA,
            tool_choice: { type: 'function', function: { name: 'create_chart' } }
        });

        console.log('OpenAI Response:', JSON.stringify(response.choices[0].message, null, 2));

        // Parse the tool call arguments into a chart spec object
        const toolCall = response.choices[0].message.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
            console.log('Tool call successful, parsing arguments');
            return JSON.parse(toolCall.function.arguments);
        } else {
            throw new Error('OpenAI did not return a valid tool call response');
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