import { IsEnum, IsString, IsOptional, Matches, IsNumber, Min, Max, IsBoolean, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for chat requests
 * Validates that the incoming request has a valid prompt string
 */
export class ChatDto {
    @IsString()
    @ApiProperty({ description: 'Natural language prompt', example: 'Show revenue trend for 2025' })
    prompt: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: 'Date range in YYYY or YYYY-MM or custom range (startISO,endISO)', example: '2025-06' })
    dateRange?: string;
}

/**
 * DTO for feedback submissions
 * Validates feedback data for chart quality ratings
 */
export class FeedbackDto {
    @IsString()
    @ApiProperty({ description: 'Audit request identifier' })
    requestId: string;

    @IsEnum([1, 2, 3, 4, 5])
    @ApiProperty({ enum: [1, 2, 3, 4, 5], description: '1 = heavy dislike, 2 = dislike, 3 = neutral, 4 = like, 5 = heavy like' })
    rating: 1 | 2 | 3 | 4 | 5;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    comment?: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional()
    chartId?: string;
}

/**
 * DTO for dashboard requests - supports generating multiple charts
 */
export class DashboardDto {
    @IsString()
    @ApiProperty({ description: 'Natural language prompt for dashboard' })
    prompt: string;

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(8)
    @ApiPropertyOptional({ minimum: 1, maximum: 8, default: 5 })
    maxCharts?: number = 5;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: 'Date range in YYYY or YYYY-MM or custom range (startISO,endISO)' })
    dateRange?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ApiPropertyOptional({ type: [String] })
    channels?: string[];

    @IsOptional()
    @IsBoolean()
    @ApiPropertyOptional({ default: true })
    generateInsights?: boolean = true;
}

/**
 * DTO for chart specifications
 * Defines the structure and validation rules for chart configuration
 */
export class ChartSpecDto {
    @IsEnum(['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'])
    @ApiProperty({ enum: ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'] })
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';

    @IsString()
    @ApiProperty({ description: 'Metric path/name' })
    metric: string;

    @IsOptional()
    @IsString()
    @ApiPropertyOptional({ description: 'Optional grouping dimension' })
    groupBy?: string;

    // Matches YYYY or YYYY-MM format
    @Matches(/^[0-9]{4}(-[0-9]{2})?$/)
    @ApiProperty({ pattern: 'YYYY[-MM]' })
    dateRange: string;
}

/**
 * Extended chart specification for dashboards
 */
export class DashboardChartDto extends ChartSpecDto {
    @IsString()
    @ApiProperty()
    id: string;

    @IsString()
    @ApiProperty()
    title: string;

    @IsNumber()
    @ApiProperty()
    row: number;

    @IsNumber()
    @ApiProperty()
    col: number;

    @IsNumber()
    @Min(1)
    @Max(4)
    @ApiProperty({ minimum: 1, maximum: 4, default: 1 })
    span: number = 1;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @ApiPropertyOptional({ type: [String] })
    insights?: string[];
}

// Response DTOs for documentation of responses
export class ChatResponseDto {
    @ApiProperty({ enum: ['line', 'bar', 'stacked-bar', 'heatmap', 'waterfall'] })
    chartType: 'line' | 'bar' | 'stacked-bar' | 'heatmap' | 'waterfall';

    @ApiProperty()
    metric: string;

    @ApiPropertyOptional()
    groupBy?: string;

    @ApiProperty({ description: 'YYYY or YYYY-MM or custom range (startISO,endISO)' })
    dateRange: string;

    @ApiProperty({ description: 'Chart-ready data object' })
    data: any;

    @ApiProperty()
    requestId: string;

    @ApiProperty()
    originalPrompt: string;

    @ApiProperty()
    dataAnalysis: {
        totalMetrics: number;
        suggestedChartTypes: string[];
        runtimeReasoning: boolean;
    };

    @ApiPropertyOptional()
    reasoning?: any;
}

export class DashboardResponseDto {
    @ApiProperty()
    dashboardId: string;

    @ApiProperty({ type: [DashboardChartDto] })
    charts: (DashboardChartDto & { data: any })[];

    @ApiProperty()
    metadata: {
        totalCharts: number;
        responseTimeMs: number;
        suggestedInsights: string[];
    };

    @ApiProperty()
    requestId: string;
}