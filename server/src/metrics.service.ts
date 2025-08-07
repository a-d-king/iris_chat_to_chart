import { Injectable } from '@nestjs/common';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { IrisApiService } from './iris-api.service';

export interface DataAggregationOptions {
    groupBy?: string[];
    timeGranularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
    aggregationType?: 'sum' | 'average' | 'median' | 'min' | 'max';
    includeComparisons?: boolean; // vs previous period
    includePercentages?: boolean; // % of total
    includeMovingAverage?: boolean;
    movingAveragePeriods?: number;
}

/**
 * Service for handling metrics data operations with caching
 */
@Injectable()
export class MetricsService {
    private cache: Map<string, any> = new Map();
    private dataAnalysis: any;

    constructor(
        private dataAnalysisService: DataAnalysisService,
        private irisApiService: IrisApiService
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
                console.log('🌐 Loading data from Iris Finance API...');
                const data = await this.irisApiService.fetchMetrics(dateRange);

                this.cache.set(cacheKey, data);
                this.dataAnalysis = this.dataAnalysisService.analyzeData(data);
                console.log(`✅ Detected ${this.dataAnalysis.availableMetrics.length} metrics in the dataset`);

            } catch (error) {
                console.error('❌ Error loading metrics data from API:', error);
                throw new Error('Failed to load metrics data from Iris Finance API');
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
     * Enhanced slice with aggregation and advanced transformations
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY or YYYY-MM)
     * @param options - Advanced aggregation and transformation options
     * @returns Promise<any> - The processed data ready for charting
     */
    async sliceWithAggregation(metric: string, dateRange: string, options: DataAggregationOptions = {}) {
        const baseData = await this.slice(metric, dateRange, options.groupBy?.[0]);

        if (!baseData || !baseData.values) {
            return baseData;
        }

        // Apply time granularity aggregation
        if (options.timeGranularity && baseData.dates) {
            return this.applyTimeAggregation(baseData, options);
        }

        // Apply statistical aggregations
        if (options.aggregationType && options.aggregationType !== 'sum') {
            return this.applyStatisticalAggregation(baseData, options);
        }

        // Add comparisons and percentages
        let result = baseData;
        if (options.includeComparisons) {
            result = await this.addPeriodComparisons(result, metric, dateRange);
        }

        if (options.includePercentages) {
            result = this.addPercentageCalculations(result);
        }

        if (options.includeMovingAverage) {
            result = this.addMovingAverage(result, options.movingAveragePeriods || 3);
        }

        return result;
    }

    /**
     * Validate data quality before processing
     * @param metric - The metric name
     * @param dateRange - Date range filter
     * @returns Promise<{isValid: boolean, issues: string[]}> - Validation result
     */
    async validateDataQuality(metric: string, dateRange: string): Promise<{ isValid: boolean, issues: string[] }> {
        const analysis = await this.getDataAnalysis(dateRange);
        const metricInfo = analysis.availableMetrics.find((m: MetricInfo) =>
            m.name.toLowerCase() === metric.toLowerCase());

        if (!metricInfo) {
            return { isValid: false, issues: [`Metric '${metric}' not found`] };
        }

        const issues = analysis.dataQuality.issues.filter((issue: string) =>
            issue.includes(metricInfo.name));

        const metricOutliers = analysis.dataQuality.outliers.filter((outlier: any) =>
            outlier.metric === metricInfo.name);

        if (metricOutliers.length > 0) {
            issues.push(`${metricOutliers.length} outliers detected in ${metricInfo.name}`);
        }

        if (analysis.dataQuality.completeness < 0.7) {
            issues.push(`Low data completeness (${Math.round(analysis.dataQuality.completeness * 100)}%)`);
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Slice metrics data based on the specified parameters
     * @param metric - The metric name to retrieve
     * @param dateRange - Date range filter (YYYY or YYYY-MM)
     * @param groupBy - Optional grouping dimension (unused in current implementation)
     * @returns Promise<any> - The sliced data ready for charting
     */
    async slice(metric: string, dateRange: string, groupBy?: string) {
        try {
            const data = await this.load(dateRange);
            const analysis = this.dataAnalysis;

            // Validate inputs
            if (!metric || metric.trim() === '') {
                throw new Error('Metric name is required');
            }

            if (!dateRange || dateRange.trim() === '') {
                throw new Error('Date range is required');
            }

            // Validate date range format - support YYYY, YYYY-MM, YYYY-MM-DD, and custom ranges
            const isValidFormat =
                /^\d{4}(-\d{2})?$/.test(dateRange) ||                          // YYYY or YYYY-MM
                /^\d{4}-\d{2}-\d{2}$/.test(dateRange) ||                       // YYYY-MM-DD
                /^\d{4}-\d{2}-\d{2}T.*,\d{4}-\d{2}-\d{2}T.*$/.test(dateRange); // Custom ISO range

            if (!isValidFormat) {
                throw new Error('Date range must be in YYYY, YYYY-MM, YYYY-MM-DD, or custom range format');
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
                throw new Error(
                    `Metric "${metric}" not found in dataset. Available metrics: ${availableMetrics.join(', ')}`
                );
            }

            // Handle different data structures based on metric type
            switch (metricInfo.type) {
                case 'timeSeries':
                    return this.sliceTimeSeries(data, metricInfo, dateRange);
                case 'groupedSeries':
                    return this.sliceGroupedSeries(data, metricInfo, dateRange);
                case 'scalar':
                    return this.sliceScalar(data, metricInfo);
                case 'dynamicKeyObject':
                    return this.sliceDynamicKeyObject(data, metricInfo);
                case 'embeddedMetrics':
                    return this.sliceEmbeddedMetrics(data, metricInfo);
                case 'array':
                    return this.sliceArray(data, metricInfo);
                default:
                    throw new Error(`Unsupported metric type: ${metricInfo.type}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error in metrics slice:', {
                metric,
                dateRange,
                groupBy,
                error: errorMessage
            });

            if (errorMessage.includes('not found') || errorMessage.includes('required') || errorMessage.includes('format')) {
                throw error;
            } else {
                throw new Error(`Failed to process metric "${metric}": ${errorMessage}`);
            }
        }
    }

    /**
     * Extract time series data
     */
    private sliceTimeSeries(data: any, metricInfo: MetricInfo, dateRange: string): any {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || !Array.isArray(rawData)) {
            return [];
        }

        // Filter by date range if specified
        let filteredData = rawData;
        if (dateRange) {
            filteredData = rawData.filter((item: any) => {
                if (!item.date) return false;

                // Handle custom ISO date ranges (e.g., "2025-05-06T00:00:00.000Z,2025-08-04T23:59:59.999Z")
                if (dateRange.includes(',')) {
                    const [startISO, endISO] = dateRange.split(',');
                    const startDate = startISO.split('T')[0]; // Extract YYYY-MM-DD part
                    const endDate = endISO.split('T')[0];     // Extract YYYY-MM-DD part
                    const itemDate = item.date.split('T')[0]; // Extract YYYY-MM-DD part from item

                    return itemDate >= startDate && itemDate <= endDate;
                }

                // Handle YYYY-MM-DD format
                if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange)) {
                    return item.date.startsWith(dateRange);
                }

                // Handle month-specific filter (e.g., "2025-06")
                if (dateRange.includes('-')) {
                    return item.date && item.date.startsWith(dateRange);
                } else {
                    // Year filter (e.g., "2025")
                    return item.date && item.date.startsWith(dateRange);
                }
            });
        }

        // Convert to AG Chart format
        return {
            dates: filteredData.map((item: any) => item.date),
            values: [{
                label: metricInfo.description,
                values: filteredData.map((item: any) => item.value)
            }]
        };
    }

    /**
     * Extract grouped series data
     */
    private sliceGroupedSeries(data: any, metricInfo: MetricInfo, dateRange: string): any {
        // Handle nested path metrics (like dataBySalesConnectors.grossSales)
        if (metricInfo.keyPath && metricInfo.keyPath.includes('.')) {
            return this.sliceNestedGroupedSeries(data, metricInfo, dateRange);
        }

        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || !rawData.dates || !rawData.values) {
            return [];
        }

        // Filter by date range if specified
        let dates = rawData.dates;
        let values = rawData.values;

        if (dateRange) {
            const filteredIndices: number[] = [];
            dates.forEach((date: string, index: number) => {
                // Handle custom ISO date ranges
                if (dateRange.includes(',')) {
                    const [startISO, endISO] = dateRange.split(',');
                    const startDate = startISO.split('T')[0];
                    const endDate = endISO.split('T')[0];
                    const itemDate = date.split('T')[0];

                    if (itemDate >= startDate && itemDate <= endDate) {
                        filteredIndices.push(index);
                    }
                }
                // Handle YYYY-MM-DD format
                else if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange)) {
                    if (date.startsWith(dateRange)) {
                        filteredIndices.push(index);
                    }
                }
                // Handle month/year formats
                else if (dateRange.includes('-')) {
                    if (date.startsWith(dateRange)) {
                        filteredIndices.push(index);
                    }
                } else {
                    if (date.startsWith(dateRange)) {
                        filteredIndices.push(index);
                    }
                }
            });

            dates = filteredIndices.map(i => dates[i]);
            values = values.map((series: any) => ({
                label: series.label,
                values: filteredIndices.map(i => series.values[i])
            }));
        }

        return {
            dates,
            values
        };
    }

    /**
     * Extract nested grouped series data (for metrics like dataBySalesConnectors.grossSales)
     */
    private sliceNestedGroupedSeries(data: any, metricInfo: MetricInfo, dateRange: string): any {
        const pathParts = metricInfo.keyPath!.split('.');
        const containerPath = pathParts.slice(0, -1).join('.');
        const metricKey = pathParts[pathParts.length - 1];

        const containerData = this.getNestedValue(data, containerPath);

        if (!Array.isArray(containerData)) {
            return [];
        }

        // Special case: If this is a time series array (has date/value objects) and we're extracting 'value'
        // then convert it to proper time series format instead of treating as grouped series
        if (metricKey === 'value' && containerData.length > 0 &&
            containerData[0].date && containerData[0].value !== undefined) {

            // Filter by date range if specified
            let filteredData = containerData;
            if (dateRange) {
                filteredData = containerData.filter((item: any) => {
                    if (!item.date) return false;

                    // Handle custom ISO date ranges
                    if (dateRange.includes(',')) {
                        const [startISO, endISO] = dateRange.split(',');
                        const startDate = startISO.split('T')[0];
                        const endDate = endISO.split('T')[0];
                        const itemDate = item.date.split('T')[0];

                        return itemDate >= startDate && itemDate <= endDate;
                    }

                    // Handle YYYY-MM-DD format
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateRange)) {
                        return item.date.startsWith(dateRange);
                    }

                    // Handle month/year formats
                    if (dateRange.includes('-')) {
                        return item.date && item.date.startsWith(dateRange);
                    } else {
                        return item.date && item.date.startsWith(dateRange);
                    }
                });
            }

            // Return as time series format
            return {
                dates: filteredData.map((item: any) => item.date),
                values: [{
                    label: metricInfo.description,
                    values: filteredData.map((item: any) => item.value)
                }]
            };
        }

        // Original logic for true grouped series (like dataBySalesConnectors)
        const categories = containerData.map(item => item.connector || item.label || item.name || 'Unknown');
        const values = containerData.map(item => (item as any)[metricKey] || 0);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: values
            }]
        };
    }

    /**
     * Extract scalar data
     */
    private sliceScalar(data: any, metricInfo: MetricInfo) {
        const value = this.getNestedValue(data, metricInfo.name);

        return {
            dates: ['Total'],
            values: [{
                label: metricInfo.description,
                values: [value]
            }]
        };
    }

    /**
     * Extract data from dynamic key objects (like cashDetails, creditCardDetails)
     */
    private sliceDynamicKeyObject(data: any, metricInfo: MetricInfo): any {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!rawData || typeof rawData !== 'object') {
            return [];
        }

        const entries = Object.entries(rawData);
        if (entries.length === 0) {
            return [];
        }

        // If this is a container metric, return summary of all accounts
        if (!metricInfo.keyPath?.includes('.') || metricInfo.keyPath.split('.').length === 1) {
            const categories = entries.map(([key, value]: [string, any]) =>
                value.name || value.officialName || key
            );

            // Get the first numeric property as the default metric
            const firstEntry = entries[0][1];
            const firstNumericKey = Object.keys(firstEntry).find(key =>
                typeof (firstEntry as any)[key] === 'number'
            );

            if (!firstNumericKey) {
                return [];
            }

            const values = entries.map(([_, value]: [string, any]) => (value as any)[firstNumericKey] || 0);

            return {
                dates: categories,
                values: [{
                    label: `${firstNumericKey} by account`,
                    values: values
                }]
            };
        }

        // If this is a specific metric within the dynamic object
        const pathParts = metricInfo.keyPath.split('.');
        const metricKey = pathParts[pathParts.length - 1];

        const categories = entries.map(([key, value]: [string, any]) =>
            value.name || value.officialName || key
        );
        const values = entries.map(([_, value]: [string, any]) => (value as any)[metricKey] || 0);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: values
            }]
        };
    }

    /**
     * Extract data from embedded metrics (like dataBySalesConnectors)
     */
    private sliceEmbeddedMetrics(data: any, metricInfo: MetricInfo): any {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            return [];
        }

        // Improved category extraction with better fallbacks
        const categories = rawData.map((item, index) => {
            const label = item.connector || item.label || item.name;

            // If we still don't have a good label, try to extract from other fields
            if (!label || label.toLowerCase().includes('unknown')) {
                // Look for other meaningful identifiers
                const fallback = item.channel || item.type || item.id ||
                    Object.keys(item).find(key =>
                        key !== 'values' &&
                        key !== 'date' &&
                        typeof item[key] === 'string' &&
                        item[key].length > 0 &&
                        !item[key].toLowerCase().includes('unknown') &&
                        !item[key].toLowerCase().includes('undefined') &&
                        !item[key].toLowerCase().includes('null')
                    );
                return fallback ? item[fallback] : `Category ${index + 1}`;
            }

            return label;
        });

        // Get all numeric keys from the first item
        const firstItem = rawData[0];
        const numericKeys = Object.keys(firstItem).filter(key =>
            typeof firstItem[key] === 'number' && key !== 'date'
        );

        if (numericKeys.length === 0) {
            return [];
        }

        // Create series for each numeric metric
        const values = numericKeys.map(key => ({
            label: key,
            values: rawData.map(item => (item as any)[key] || 0)
        }));

        return {
            dates: categories,
            values: values
        };
    }

    /**
     * Extract data from simple arrays
     */
    private sliceArray(data: any, metricInfo: MetricInfo): any {
        const rawData = this.getNestedValue(data, metricInfo.name);

        if (!Array.isArray(rawData) || rawData.length === 0) {
            return [];
        }

        // Generate simple indices as categories (Item 1, Item 2, etc.)
        const categories = rawData.map((_, index) => `Item ${index + 1}`);

        return {
            dates: categories,
            values: [{
                label: metricInfo.description,
                values: rawData.map(value => typeof value === 'number' ? value : 0)
            }]
        };
    }

    /**
     * Helper method to get nested values from object using dot notation
     */
    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => {
            return current && current[key] !== undefined ? current[key] : undefined;
        }, obj);
    }

    /**
     * Apply time-based aggregation (weekly, monthly, quarterly)
     */
    private applyTimeAggregation(data: any, options: DataAggregationOptions): any {
        if (!data.dates || !data.values) return data;

        const { timeGranularity, aggregationType = 'sum' } = options;
        const aggregatedData: { [key: string]: { values: number[][], count: number } } = {};

        // Group dates by time period
        data.dates.forEach((date: string, index: number) => {
            const key = this.getTimePeriodKey(date, timeGranularity!);

            if (!aggregatedData[key]) {
                aggregatedData[key] = { values: [], count: 0 };
            }

            data.values.forEach((series: any, seriesIndex: number) => {
                if (!aggregatedData[key].values[seriesIndex]) {
                    aggregatedData[key].values[seriesIndex] = [];
                }
                if (Array.isArray(aggregatedData[key].values[seriesIndex])) {
                    (aggregatedData[key].values[seriesIndex] as number[]).push(series.values[index]);
                }
            });
            aggregatedData[key].count++;
        });

        // Apply aggregation function
        const aggregatedDates = Object.keys(aggregatedData).sort();
        const aggregatedValues = data.values.map((series: any, seriesIndex: number) => ({
            label: series.label,
            values: aggregatedDates.map(key => {
                const values = aggregatedData[key].values[seriesIndex] as number[] || [];
                return this.applyAggregationFunction(values, aggregationType);
            })
        }));

        return {
            dates: aggregatedDates,
            values: aggregatedValues
        };
    }

    /**
     * Apply statistical aggregation functions
     */
    private applyStatisticalAggregation(data: any, options: DataAggregationOptions): any {
        if (!data.values || options.aggregationType === 'sum') return data;

        const { aggregationType } = options;
        const processedValues = data.values.map((series: any) => ({
            label: series.label,
            values: series.values.map((value: number) =>
                this.applyAggregationFunction([value], aggregationType!))
        }));

        return { ...data, values: processedValues };
    }

    /**
     * Add period-over-period comparisons
     */
    private async addPeriodComparisons(data: any, metric: string, dateRange: string): Promise<any> {
        try {
            // Calculate previous period
            const previousPeriod = this.calculatePreviousPeriod(dateRange);
            const previousData = await this.slice(metric, previousPeriod);

            if (!previousData || !previousData.values) {
                return data; // Return original if no comparison data
            }

            // Add comparison series
            const comparisonValues = data.values.map((series: any, index: number) => {
                const previousSeries = previousData.values[index];
                if (!previousSeries) return series;

                const changes = series.values.map((current: number, i: number) => {
                    const previous = previousSeries.values[i];
                    if (!previous || previous === 0) return 0;
                    return ((current - previous) / previous) * 100;
                });

                return {
                    label: `${series.label} (vs Previous Period)`,
                    values: changes
                };
            });

            return {
                ...data,
                values: [...data.values, ...comparisonValues]
            };
        } catch (error) {
            console.warn('Failed to add period comparisons:', error);
            return data;
        }
    }

    /**
     * Add percentage calculations (% of total)
     */
    private addPercentageCalculations(data: any): any {
        if (!data.values || data.values.length === 0) return data;

        const percentageValues = data.values.map((series: any) => {
            const total = series.values.reduce((sum: number, val: number) => sum + (val || 0), 0);

            if (total === 0) return series;

            return {
                label: `${series.label} (%)`,
                values: series.values.map((val: number) =>
                    total > 0 ? Math.round((val / total) * 100 * 100) / 100 : 0)
            };
        });

        return {
            ...data,
            values: [...data.values, ...percentageValues]
        };
    }

    /**
     * Add moving average calculations
     */
    private addMovingAverage(data: any, periods: number): any {
        if (!data.values || periods <= 1) return data;

        const movingAverageValues = data.values.map((series: any) => ({
            label: `${series.label} (${periods}-period MA)`,
            values: series.values.map((_: any, index: number) => {
                const start = Math.max(0, index - periods + 1);
                const subset = series.values.slice(start, index + 1);
                return subset.reduce((sum: number, val: number) => sum + (val || 0), 0) / subset.length;
            })
        }));

        return {
            ...data,
            values: [...data.values, ...movingAverageValues]
        };
    }

    /**
     * Helper methods for aggregation
     */
    private getTimePeriodKey(date: string, granularity: string): string {
        const d = new Date(date);

        switch (granularity) {
            case 'weekly':
                const weekStart = new Date(d);
                weekStart.setDate(d.getDate() - d.getDay());
                return weekStart.toISOString().split('T')[0];

            case 'monthly':
                return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

            case 'quarterly':
                const quarter = Math.floor(d.getMonth() / 3) + 1;
                return `${d.getFullYear()}-Q${quarter}`;

            default:
                return date;
        }
    }

    private applyAggregationFunction(values: number[], type: string): number {
        const validValues = values.filter(v => v != null && !isNaN(v));
        if (validValues.length === 0) return 0;

        switch (type) {
            case 'sum':
                return validValues.reduce((sum, val) => sum + val, 0);
            case 'average':
                return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
            case 'median':
                const sorted = [...validValues].sort((a, b) => a - b);
                const mid = Math.floor(sorted.length / 2);
                return sorted.length % 2 === 0
                    ? (sorted[mid - 1] + sorted[mid]) / 2
                    : sorted[mid];
            case 'min':
                return Math.min(...validValues);
            case 'max':
                return Math.max(...validValues);
            default:
                return validValues[0] || 0;
        }
    }

    private calculatePreviousPeriod(dateRange: string): string {
        // Simple implementation - can be enhanced for more complex periods
        if (dateRange.includes('-')) {
            const parts = dateRange.split('-');
            if (parts.length === 2) {
                // Monthly: 2025-06 -> 2025-05
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]);
                const prevMonth = month === 1 ? 12 : month - 1;
                const prevYear = month === 1 ? year - 1 : year;
                return `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
            }
        } else {
            // Yearly: 2025 -> 2024
            return String(parseInt(dateRange) - 1);
        }
        return dateRange;
    }
} 