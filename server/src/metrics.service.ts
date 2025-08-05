import { Injectable } from '@nestjs/common';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { IrisApiService } from './iris-api.service';

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

        const categories = rawData.map(item => item.connector || item.label || item.name || 'Unknown');

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
} 