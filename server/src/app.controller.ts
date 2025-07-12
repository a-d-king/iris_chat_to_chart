import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ChatDto } from './chat.dto';
import { OpenAiService } from './openai.service';
import { MetricsService } from './metrics.service';

/**
 * Main application controller
 * Handles the chat endpoint that coordinates between OpenAI and metrics data
 */
@Controller()
export class AppController {
    constructor(
        private ai: OpenAiService,
        private metrics: MetricsService
    ) { }

    /**
     * POST /chat endpoint
     * Takes a natural language prompt, converts it to a chart spec via OpenAI,
     * fetches the relevant data, and returns the complete chart configuration
     * @param body - Chat request containing the user's prompt
     * @returns Promise<object> - Chart specification with data
     */
    @Post('chat')
    async chat(@Body(new ValidationPipe()) body: ChatDto) {
        try {
            // Step 1: Convert natural language prompt to structured chart spec
            const spec = await this.ai.prompt(body.prompt);

            // Step 2: Fetch the relevant data based on the chart spec
            const data = await this.metrics.slice(
                spec.metric,
                spec.dateRange,
                spec.groupBy
            );

            // Step 3: Return combined spec and data for the frontend
            return {
                ...spec,
                data,
                isMockData: !process.env.OPENAI_API_KEY // Indicate if we're using mock data
            };
        } catch (error) {
            console.error('Error processing chat request:', error);
            throw new Error('Failed to process chat request');
        }
    }
} 