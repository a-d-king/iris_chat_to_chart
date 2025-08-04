import { IsEnum, IsString, IsOptional, Matches, IsNumber, Min, Max, IsBoolean, IsArray } from 'class-validator';

/**
 * DTO for chat requests
 * Validates that the incoming request has a valid prompt string
 */
export class ChatDto {
    @IsString()
    prompt: string;

    @IsOptional()
    @IsString()
    dateRange?: string;
}

/**
 * DTO for feedback submissions
 * Validates feedback data for chart quality ratings
 */
export class FeedbackDto {
    @IsString()
    requestId: string;

    @IsEnum([1, 2, 3, 4, 5])
    rating: 1 | 2 | 3 | 4 | 5; // 1=heavy dislike, 2=dislike, 3=neutral, 4=like, 5=heavy like

    @IsOptional()
    @IsString()
    comment?: string;

    @IsOptional()
    @IsString()
    chartId?: string; // For dashboard charts
}

/**
 * DTO for dashboard requests - supports generating multiple charts
 */
export class DashboardDto {
    @IsString()
    prompt: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(8)
    maxCharts?: number = 5;

    @IsOptional()
    @IsString()
    dateRange?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    channels?: string[];

    @IsOptional()
    @IsBoolean()
    generateInsights?: boolean = true;
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

    // Matches YYYY or YYYY-MM format
    @Matches(/^\d{4}(-\d{2})?$/)
    dateRange: string;
}

/**
 * Extended chart specification for dashboards
 */
export class DashboardChartDto extends ChartSpecDto {
    @IsString()
    id: string;

    @IsString()
    title: string;

    @IsNumber()
    row: number;

    @IsNumber()
    col: number;

    @IsNumber()
    @Min(1)
    @Max(4)
    span: number = 1;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    insights?: string[];
}