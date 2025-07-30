import { IsEnum, IsString, IsOptional, Matches, IsNumber, Min, Max, IsBoolean, IsArray, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for chat requests
 * Validates that the incoming request has a valid prompt string
 */
export class ChatDto {
    @IsString()
    prompt: string;
}

/**
 * Enhanced data scope configuration
 */
export class DataScopeDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    metrics?: string[];

    @IsOptional()
    @IsObject()
    timeRange?: {
        type: 'absolute' | 'relative';
        start?: string;
        end?: string;
        period?: 'last7days' | 'last30days' | 'lastQuarter' | 'ytd' | 'custom';
    };

    @IsOptional()
    @IsObject()
    filters?: {
        channels?: string[];
        products?: string[];
        regions?: string[];
        customFilters?: Record<string, any>;
    };
}

/**
 * Comparison configuration
 */
export class ComparisonDto {
    @IsBoolean()
    enabled: boolean;

    @IsOptional()
    @IsEnum(['time-over-time', 'segment-comparison', 'benchmark'])
    type?: 'time-over-time' | 'segment-comparison' | 'benchmark';

    @IsOptional()
    @IsString()
    baseline?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    segments?: string[];
}

/**
 * Visualization preferences
 */
export class VisualizationDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    preferredChartTypes?: string[];

    @IsOptional()
    @IsEnum(['grid', 'stacked', 'tabs'])
    layout?: 'grid' | 'stacked' | 'tabs';

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(12)
    maxCharts?: number;

    @IsOptional()
    @IsBoolean()
    includeKPIs?: boolean;

    @IsOptional()
    @IsBoolean()
    includeTrends?: boolean;
}

/**
 * Dashboard context and purpose
 */
export class ContextDto {
    @IsOptional()
    @IsEnum(['executive', 'analyst', 'operational', 'custom'])
    audience?: 'executive' | 'analyst' | 'operational' | 'custom';

    @IsOptional()
    @IsEnum(['reporting', 'monitoring', 'investigation', 'presentation'])
    purpose?: 'reporting' | 'monitoring' | 'investigation' | 'presentation';

    @IsOptional()
    @IsEnum(['realtime', 'daily', 'weekly', 'monthly'])
    updateFrequency?: 'realtime' | 'daily' | 'weekly' | 'monthly';
}

/**
 * Rich dashboard requirements structure
 */
export class DashboardRequirementsDto {
    @IsString()
    intent: string;

    @IsEnum(['performance', 'comparison', 'trend', 'breakdown', 'correlation', 'custom'])
    analysisType: 'performance' | 'comparison' | 'trend' | 'breakdown' | 'correlation' | 'custom';

    @ValidateNested()
    @Type(() => DataScopeDto)
    dataScope: DataScopeDto;

    @ValidateNested()
    @Type(() => ComparisonDto)
    comparison: ComparisonDto;

    @ValidateNested()
    @Type(() => VisualizationDto)
    visualization: VisualizationDto;

    @ValidateNested()
    @Type(() => ContextDto)
    context: ContextDto;
}

/**
 * Enhanced DTO for dashboard requests with rich context
 */
export class EnhancedDashboardDto {
    @IsString()
    prompt: string;

    @ValidateNested()
    @Type(() => DashboardRequirementsDto)
    requirements: DashboardRequirementsDto;

    @IsOptional()
    @IsBoolean()
    generateInsights?: boolean = true;
}

/**
 * Legacy DTO for dashboard requests - keeping for fallback
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