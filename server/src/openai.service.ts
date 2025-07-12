import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI() : null;

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
 * If OpenAI API key is not available, returns mock data for testing
 * @param prompt - Natural language description of the desired chart
 * @returns Promise<ChartSpecDto> - Structured chart specification
 */
    async prompt(prompt: string) {
        // If OpenAI is not available, return mock data based on the prompt
        if (!openai) {
            console.log('🤖 OpenAI API key not found, returning mock data for prompt:', prompt);
            return this.getMockChartSpec(prompt);
        }

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                temperature: 0, // Use deterministic responses
                messages: [{
                    role: 'user',
                    content: `Please analyze this request and generate a chart specification: ${prompt}`
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
                console.log('🤖 No tool call found, falling back to mock data for prompt:', prompt);
                return this.getMockChartSpec(prompt);
            }
        } catch (error) {
            console.error('OpenAI API error:', error);
            console.log('🤖 Falling back to mock data for prompt:', prompt);
            return this.getMockChartSpec(prompt);
        }
    }

    /**
     * Generate mock chart specifications for testing without OpenAI API
     * @param prompt - User's natural language prompt
     * @returns Mock chart specification
     */
    private getMockChartSpec(prompt: string) {
        const lowercasePrompt = prompt.toLowerCase();

        // Determine chart type based on prompt keywords
        let chartType = 'line';
        if (lowercasePrompt.includes('bar')) {
            chartType = lowercasePrompt.includes('stack') ? 'stacked-bar' : 'bar';
        } else if (lowercasePrompt.includes('heatmap')) {
            chartType = 'heatmap';
        } else if (lowercasePrompt.includes('waterfall')) {
            chartType = 'waterfall';
        }

        // Determine metric based on prompt keywords
        let metric = 'revenue';
        if (lowercasePrompt.includes('user')) {
            metric = 'users';
        } else if (lowercasePrompt.includes('sales')) {
            metric = 'sales';
        } else if (lowercasePrompt.includes('conversion')) {
            metric = 'conversion';
        }

        // Determine grouping based on prompt keywords
        let groupBy = undefined;
        if (lowercasePrompt.includes('region')) {
            groupBy = 'region';
        } else if (lowercasePrompt.includes('country')) {
            groupBy = 'country';
        }

        // Determine date range based on prompt keywords
        let dateRange = '2023';
        if (lowercasePrompt.includes('2024')) {
            dateRange = '2024';
        } else if (lowercasePrompt.includes('2022')) {
            dateRange = '2022';
        }

        const mockSpec = {
            chartType,
            metric,
            dateRange,
            ...(groupBy && { groupBy })
        };

        console.log('🎯 Generated mock chart spec:', mockSpec);
        return mockSpec;
    }
} 