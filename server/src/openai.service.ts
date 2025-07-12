import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { DataAnalysis } from './data-analysis.service';

// Initialize OpenAI client
const openai = new OpenAI();

/**
 * OpenAI tool schema for chart creation
 * Defines the structure that GPT should follow when generating chart specifications
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
        // Build enhanced prompt with data context
        let enhancedPrompt = `Please analyze this request and generate a chart specification: ${prompt}`;

        if (dataAnalysis) {
            enhancedPrompt += `\n\nContext about available data:\n${dataAnalysis.dataContext}`;

            enhancedPrompt += `\n\nAvailable metrics:\n`;
            dataAnalysis.availableMetrics.forEach(metric => {
                enhancedPrompt += `- ${metric.name}: ${metric.description} (${metric.type}, ${metric.valueType})\n`;
            });

            if (dataAnalysis.suggestedChartTypes.length > 0) {
                enhancedPrompt += `\n\nChart type recommendations:\n`;
                dataAnalysis.suggestedChartTypes.forEach(suggestion => {
                    enhancedPrompt += `- ${suggestion.chartType}: ${suggestion.reason} (confidence: ${suggestion.confidence})\n`;
                });
            }
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            temperature: 0, // Use deterministic responses
            messages: [{
                role: 'user',
                content: enhancedPrompt
            }],
            tools: TOOL_SCHEMA,
            tool_choice: { type: 'function', function: { name: 'create_chart' } }
        });

        // Debug logging
        console.log('🔍 OpenAI Response:', JSON.stringify(response.choices[0].message, null, 2));

        // Parse the tool call arguments into a chart spec object
        const toolCall = response.choices[0].message.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
            console.log('✅ Tool call successful, parsing arguments');
            return JSON.parse(toolCall.function.arguments);
        } else {
            throw new Error('OpenAI did not return a valid tool call response');
        }
    }
} 