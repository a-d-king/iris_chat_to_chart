import { Injectable } from '@nestjs/common';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { IrisApiService } from './iris-api.service';
import { ChartDataSlicer, ChartData } from './data/chart-data-slicer';
import { DateFilterUtil } from './utils/date-filter.util';
import { ErrorHandlerService } from './common/error-handler.service';

/**
 * Service for handling metrics data operations with caching
 * Refactored to use specialized utilities for data slicing and error handling
 */
@Injectable()
export class MetricsService {
    private cache: Map<string, any> = new Map();
    private dataAnalysis: any;

    constructor(
        private dataAnalysisService: DataAnalysisService,
        private irisApiService: IrisApiService,
        private chartDataSlicer: ChartDataSlicer,
        private errorHandler: ErrorHandlerService
    ) { }

    /**
     * Load metrics data from Iris Finance API with caching to improve performance
     * @param dateRange Optional date range for API calls
     * @returns Promise<any> - The loaded metrics data
     */
    async load(dateRange?: string) {
        // Create cache key based on date range
        const cacheKey = dateRange || 'default';

        if (!this.cache.has(cacheKey)) {
            try {
                this.errorHandler.logInfo('data_loading', 'Loading data from Iris Finance API', {
                    component: 'MetricsService',
                    metadata: { dateRange }
                });
                
                const data = await this.irisApiService.fetchMetrics(dateRange);

                this.cache.set(cacheKey, data);
                this.dataAnalysis = this.dataAnalysisService.analyzeData(data);
                
                this.errorHandler.logInfo('data_analysis', `Detected ${this.dataAnalysis.availableMetrics.length} metrics in the dataset`, {
                    component: 'MetricsService',
                    metadata: { metricsCount: this.dataAnalysis.availableMetrics.length, dateRange }
                });

            } catch (error) {
                this.errorHandler.handleExternalApiError('IrisFinanceAPI', 'fetchMetrics', error, {
                    operation: 'load',
                    component: 'MetricsService',
                    metadata: { dateRange }
                });
            }
        }
        return this.cache.get(cacheKey);
    }

    /**
     * Get data analysis results
     * @param dateRange Optional date range for API calls
     * @returns Data analysis including available metrics and suggestions
     */
    async getDataAnalysis(dateRange?: string) {
        await this.load(dateRange);
        return this.dataAnalysis;
    }

    /**
     * Slice metrics data based on the specified parameters using the chart data slicer
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY, YYYY-MM, YYYY-MM-DD, or custom range)
     * @param groupBy - Optional grouping dimension (unused in current implementation)
     * @returns Promise<ChartData> - The sliced data ready for charting
     */
    async slice(metric: string, dateRange: string, groupBy?: string): Promise<ChartData> {
        try {
            const data = await this.load(dateRange);
            const analysis = this.dataAnalysis;

            // Validate inputs using centralized error handling
            if (!metric || metric.trim() === '') {
                this.errorHandler.handleValidationError('metric', metric, 'Metric name is required');
            }

            if (!dateRange || dateRange.trim() === '') {
                this.errorHandler.handleValidationError('dateRange', dateRange, 'Date range is required');
            }

            // Validate date range format using utility
            if (!DateFilterUtil.isValidDateRangeFormat(dateRange)) {
                this.errorHandler.handleValidationError(
                    'dateRange',
                    dateRange,
                    'Date range must be in YYYY, YYYY-MM, YYYY-MM-DD, or custom range format'
                );
            }

            // Find the matching metric with flexible matching
            let metricInfo = analysis.availableMetrics.find((m: MetricInfo) =>
                m.name.toLowerCase() === metric.toLowerCase()
            );

            // If exact match not found, try partial matching
            if (!metricInfo) {
                metricInfo = analysis.availableMetrics.find((m: MetricInfo) =>
                    m.name.toLowerCase().includes(metric.toLowerCase()) ||
                    metric.toLowerCase().includes(m.name.toLowerCase())
                );
            }

            if (!metricInfo) {
                const availableMetrics = analysis.availableMetrics.map((m: MetricInfo) => m.name);
                this.errorHandler.handleDataProcessingError(
                    'metric_lookup',
                    'metric',
                    new Error(`Metric "${metric}" not found in dataset. Available metrics: ${availableMetrics.join(', ')}`)
                );
            }

            // Use the chart data slicer to handle different metric types
            return this.chartDataSlicer.slice(data, metricInfo!, dateRange);
        } catch (error) {
            // If it's already a handled error, re-throw it
            if (error instanceof Error && (error.name === 'BadRequestException' || error.name === 'NotFoundException')) {
                throw error;
            }

            // Handle unexpected errors
            this.errorHandler.handleDataProcessingError('data_slicing', 'metric data', error, {
                operation: 'slice',
                component: 'MetricsService',
                metadata: { metric, dateRange, groupBy }
            });
        }
    }
}