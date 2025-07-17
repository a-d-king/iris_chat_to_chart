import { Injectable } from '@nestjs/common';
import fs from 'fs/promises';
import path from 'path';
import { DataAnalysisService, MetricInfo } from './data-analysis.service';
import { DATA_SOURCE_FILE } from './app.controller';

/**
 * Service for handling metrics data operations with caching
 */
@Injectable()
export class MetricsService {
    private cache: any;
    private dataAnalysis: any;

    constructor(private dataAnalysisService: DataAnalysisService) { }

    /**
     * Load metrics data from available JSON file with caching to improve performance
     * @returns Promise<any> - The loaded metrics data
     */
    async load() {
        if (!this.cache) {
            try {
                const raw = await fs.readFile(
                    path.join(__dirname, '..', DATA_SOURCE_FILE),
                    'utf-8'
                );

                this.cache = JSON.parse(raw);

                this.dataAnalysis = this.dataAnalysisService.analyzeData(this.cache);
                console.log(`Detected ${this.dataAnalysis.availableMetrics.length} metrics in the dataset`);

            } catch (error) {
                console.error('Error loading metrics data:', error);
                throw new Error('Failed to load metrics data');
            }
        }
        return this.cache;
    }

    /**
     * Get data analysis results
     * @returns Data analysis including available metrics and suggestions
     */
    async getDataAnalysis() {
        await this.load();
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
            const data = await this.load();
            const analysis = this.dataAnalysis;

            // Validate inputs
            if (!metric || metric.trim() === '') {
                throw new Error('Metric name is required');
            }

            if (!dateRange || dateRange.trim() === '') {
                throw new Error('Date range is required');
            }

            // Validate date range format
            if (!/^\d{4}(-\d{2})?$/.test(dateRange)) {
                throw new Error('Date range must be in YYYY or YYYY-MM format');
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
                if (dateRange.includes('-')) {
                    // Month-specific filter (e.g., "2025-06")
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
                if (dateRange.includes('-')) {
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

        // Convert array of objects to grouped series format
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