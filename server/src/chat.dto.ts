import { IsEnum, IsString, IsOptional, Matches } from 'class-validator';

/**
 * DTO for chat requests
 * Validates that the incoming request has a valid prompt string
 */
export class ChatDto {
    @IsString()
    prompt: string;
}

/**
 * DTO for chart specifications
 * Defines the structure and validation rules for chart configuration
 */
export class ChartSpecDto {
    @IsEnum(['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'])
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';

    @IsString()
    metric: string;

    @IsOptional()
    @IsString()
    groupBy?: string;

    @Matches(/^\d{4}(-\d{2})?$/) // Matches YYYY or YYYY-MM format
    dateRange: string;
}